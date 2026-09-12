import { after, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { processNote } from "@/lib/ca/processNote";

// Re-runs extraction over an already-uploaded note, reusing the original
// file still sitting in the ca-notes bucket. Exists because content_map is
// written exactly once (lib/ca/processNote.ts) and nothing ever re-reads
// the source file afterward — so a note extracted before an extraction
// prompt fix keeps its older, worse content_map forever, and every
// downstream consumer (cheatsheet, question/flashcard generation, AI
// Teacher) keeps inheriting it. Before this route the only remedy was
// delete + re-upload, which also threw away the note's generated content.
//
// maxDuration mirrors notes/upload/route.ts for the same reason: after()
// runs the real Gemini extraction inside this function's execution budget,
// and processingTimeout.ts's 165s cutoff has to sit comfortably inside it.
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { note_id?: string; discard_generated?: boolean } = await request.json();
    const noteId = body.note_id;
    if (!noteId) {
      return NextResponse.json({ error: "note_id is required" }, { status: 400 });
    }

    const service = await createServiceClient();

    const { data: note, error: noteError } = await service
      .from("user_notes")
      .select("id, user_id, file_path")
      .eq("id", noteId)
      .single();
    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    if (note.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // processing_queue has no unique constraint on note_id, so read the
    // most recent row rather than assuming there's exactly one. Refusing
    // while one is in flight matters because both runs would race to write
    // content_map for the same note.
    const { data: queueRow } = await service
      .from("processing_queue")
      .select("id, status")
      .eq("note_id", noteId)
      .order("queued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (queueRow?.status === "pending" || queueRow?.status === "processing") {
      return NextResponse.json(
        { error: "This note is already being processed. Wait for it to finish before re-extracting." },
        { status: 409 }
      );
    }

    // Re-extraction assigns fresh block_ids (randomUUID per block in
    // lib/ca/extraction.ts), and notes/generate/route.ts decides what to
    // generate by diffing block_ids against rows already generated for the
    // note. So content produced from the OLD blocks can neither be matched
    // nor replaced — leave it active and the next "Create Practice
    // Session" silently adds a full duplicate set alongside it. Make the
    // caller acknowledge that rather than discovering it as duplicates.
    const [questionsResult, flashcardsResult] = await Promise.all([
      service.from("questions").select("id", { count: "exact", head: true }).eq("note_id", noteId).eq("is_active", true),
      service.from("flashcards").select("id", { count: "exact", head: true }).eq("note_id", noteId).eq("is_active", true),
    ]);
    const questionCount = questionsResult.count || 0;
    const flashcardCount = flashcardsResult.count || 0;

    if (questionCount + flashcardCount > 0 && !body.discard_generated) {
      return NextResponse.json(
        {
          error:
            "This note already has generated content built from its current blocks. Re-extracting replaces those blocks, so the existing content can no longer be matched to them.",
          questions: questionCount,
          flashcards: flashcardCount,
          hint: "Re-send with discard_generated: true to retire them and re-extract.",
        },
        { status: 409 }
      );
    }

    if (questionCount + flashcardCount > 0) {
      // Retired, not deleted. is_active = false is what every read path
      // already filters on, so these leave Practice/Flashcards immediately,
      // while the rows — and the spaced-repetition progress in
      // user_progress/user_flashcard_progress that references them by id —
      // stay intact and the change stays reversible.
      await service.from("questions").update({ is_active: false }).eq("note_id", noteId);
      await service.from("flashcards").update({ is_active: false }).eq("note_id", noteId);
    }

    // content_map is deliberately NOT cleared: processNote overwrites it
    // only on success, so a failed re-extraction leaves the note with its
    // previous working map instead of nothing at all.
    await service.from("user_notes").update({ processed: false, processing_error: null }).eq("id", noteId);

    if (queueRow) {
      await service
        .from("processing_queue")
        .update({
          status: "pending",
          error_message: null,
          queued_at: new Date().toISOString(),
          started_at: null,
          completed_at: null,
        })
        .eq("id", queueRow.id);
    } else {
      await service.from("processing_queue").insert({ note_id: noteId, user_id: user.id, status: "pending" });
    }

    after(() => processNote(noteId));

    return NextResponse.json({
      success: true,
      note_id: noteId,
      status: "queued",
      retired_questions: questionCount,
      retired_flashcards: flashcardCount,
    });
  } catch (error) {
    console.error("CA notes re-extract error:", error);
    return NextResponse.json({ error: "Re-extract failed" }, { status: 500 });
  }
}
