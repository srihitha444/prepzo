import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { generateForBlocks, type GenerateMode } from "@/lib/ca/generateContent";
import { isRetryableGeminiError } from "@/lib/gemini";
import type { CaLevel } from "@/lib/ca-syllabus";
import type { ContentMap } from "@/lib/ca/extraction";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { note_id?: string; mode?: GenerateMode } = await request.json();
    const { note_id, mode } = body;

    if (!note_id || (mode !== "questions" && mode !== "flashcards")) {
      return NextResponse.json({ error: "note_id and a valid mode are required" }, { status: 400 });
    }

    const service = await createServiceClient();

    const { data: note, error: noteError } = await service
      .from("user_notes")
      .select("id, user_id, processed, content_map")
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

    const { data: profile } = await service.from("profiles").select("ca_level").eq("id", user.id).single();
    if (!profile?.ca_level) {
      return NextResponse.json({ error: "CA onboarding not completed" }, { status: 400 });
    }

    const contentMap = note.content_map as ContentMap | null;
    const autoBlocks = (contentMap?.blocks || []).filter((b) => b.status === "auto");
    if (autoBlocks.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Skip blocks this mode has already generated content for — a block
    // confirmed *after* the student already generated once (e.g. resolving
    // a "needs your confirmation" block later) must still be reachable, but
    // re-running generation over every auto block every time would
    // duplicate content for blocks already generated. Reusing which table
    // to check off `mode` keeps this correct if a block is regenerable
    // independently per content type.
    const table = mode === "questions" ? "questions" : "flashcards";
    const { data: existingRows } = await service.from(table).select("block_id").eq("note_id", note_id);
    const alreadyGenerated = new Set((existingRows || []).map((r) => r.block_id));
    const blocksToGenerate = autoBlocks.filter((b) => !alreadyGenerated.has(b.block_id));

    if (blocksToGenerate.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const { questions, flashcards } = await generateForBlocks({
      noteId: note_id,
      level: profile.ca_level as CaLevel,
      blocks: blocksToGenerate,
      mode,
    });

    let count = 0;
    if (mode === "questions" && questions.length > 0) {
      const { error } = await service
        .from("questions")
        .insert(questions.map((q) => ({ ...q, exam: "CA", is_active: true, is_pyq: false })));
      if (error) throw new Error(`Failed to save generated questions: ${error.message}`);
      count = questions.length;
    } else if (mode === "flashcards" && flashcards.length > 0) {
      const { error } = await service
        .from("flashcards")
        .insert(flashcards.map((f) => ({ ...f, exam: "CA", is_active: true })));
      if (error) throw new Error(`Failed to save generated flashcards: ${error.message}`);
      count = flashcards.length;
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("CA notes generate error:", error);
    if (isRetryableGeminiError(error)) {
      return NextResponse.json(
        { error: "Generation is experiencing high demand right now. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}
