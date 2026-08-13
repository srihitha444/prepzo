import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { generateCheatsheet } from "@/lib/ca/generateCheatsheet";
import { isRetryableGeminiError } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { note_id?: string } = await request.json();
    const { note_id } = body;
    if (!note_id) {
      return NextResponse.json({ error: "note_id is required" }, { status: 400 });
    }

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

    const content = await generateCheatsheet({
      supabase: service,
      userId: user.id,
      noteId: note_id,
      noteTitle: note.title,
    });

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
