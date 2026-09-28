import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { generateCheatsheet } from "@/lib/ca/generateCheatsheet";
import { isRetryableGeminiError } from "@/lib/gemini";
import { consumeQuota, releaseQuota, resolvePlan } from "@/lib/ca/usage";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { note_id?: string; block_ids?: string[] } = await request.json();
    const { note_id } = body;
    if (!note_id) {
      return NextResponse.json({ error: "note_id is required" }, { status: 400 });
    }
    // Which topics feed the cheatsheet. Still one cheatsheet per note —
    // this narrows the source content, it doesn't create a second row — so
    // regenerating from a different topic selection replaces the document,
    // exactly as regenerating from the whole note always did.
    const blockIds = Array.isArray(body.block_ids) && body.block_ids.length > 0 ? body.block_ids : undefined;

    const service = await createServiceClient();

    const { data: note, error: noteError } = await service
      .from("user_notes")
      .select("id, user_id, title, processed")
      .eq("id", note_id)
      .single();
    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    if (note.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!note.processed) {
      return NextResponse.json({ error: "This note hasn't finished processing yet" }, { status: 400 });
    }

    // Charged per generation, since each one is a Gemini call. In practice
    // that's once per note: the UI only offers "Create Cheatsheet" when the
    // note has none, and Regenerate was removed in Phase 7.
    const plan = await resolvePlan(service, user.id);
    const quota = await consumeQuota(service, user.id, plan.id, "cheatsheets");
    if (!quota.ok) {
      return NextResponse.json({ error: quota.message, quota_exhausted: true }, { status: 402 });
    }

    let content: string;
    try {
      content = await generateCheatsheet({
        supabase: service,
        userId: user.id,
        noteId: note_id,
        noteTitle: note.title,
        blockIds,
      });
    } catch (generationError) {
      // Nothing was produced, so the allowance shouldn't be spent.
      await releaseQuota(service, user.id, "cheatsheets", quota.periodStart);
      throw generationError;
    }

    // Upsert on (user_id, note_id) — this same call also powers "Regenerate",
    // deliberately overwriting whatever content (including edits) was there.
    const { data: cheatsheet, error: upsertError } = await service
      .from("ca_cheatsheets")
      .upsert({ user_id: user.id, note_id, content, updated_at: new Date().toISOString() }, { onConflict: "user_id,note_id" })
      .select("*")
      .single();
    if (upsertError || !cheatsheet) {
      throw new Error(`Failed to save cheatsheet: ${upsertError?.message}`);
    }

    return NextResponse.json({ success: true, cheatsheet });
  } catch (error) {
    console.error("CA cheatsheet generate error:", error);
    if (isRetryableGeminiError(error)) {
      return NextResponse.json(
        { error: "Cheatsheet generation is experiencing high demand right now. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate cheatsheet" },
      { status: 500 }
    );
  }
}
