import { createServiceClient } from "@/lib/supabase/server";
import { extractAndMapContent, type ContentMap } from "@/lib/ca/extraction";
import { withProcessingTimeout } from "@/lib/ca/processingTimeout";
import type { CaLevel } from "@/lib/ca-syllabus";

const NOTES_BUCKET = "ca-notes";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown processing error";
}

/**
 * Runs after the upload response has already been sent (see the `after()`
 * call in app/api/ca/notes/upload/route.ts). Has no request context to
 * report failures to, so every failure path — including a missing
 * GEMINI_API_KEY — is caught here and written to processing_queue /
 * user_notes instead of throwing.
 */
export async function processNote(noteId: string): Promise<void> {
  const supabase = await createServiceClient();

  await supabase
    .from("processing_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("note_id", noteId);

  try {
    const { data: note, error: noteError } = await supabase
      .from("user_notes")
      .select("id, user_id, file_path, mime_type")
      .eq("id", noteId)
      .single();
    if (noteError || !note) throw new Error("Note not found");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("ca_level, ca_groups, ca_papers")
      .eq("id", note.user_id)
      .single();
    if (profileError || !profile) throw new Error("Student profile not found");
    if (!profile.ca_level) throw new Error("Student has not completed CA onboarding yet");

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(NOTES_BUCKET)
      .download(note.file_path);
    if (downloadError || !fileBlob) throw new Error("Could not download uploaded file from storage");

    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

    // Cheap check right before the expensive/slow step: if the student hit
    // "Cancel" while this was still queued (the note row gets deleted, not
    // just flagged — see app/api/ca/notes/[id]/route.ts), skip the Gemini
    // call entirely rather than doing costly work for a note that's already
    // gone. A cancel that lands mid-extraction is still handled below, at
    // the write-back step.
    const { data: stillExists } = await supabase.from("user_notes").select("id").eq("id", noteId).maybeSingle();
    if (!stillExists) return;

    const contentMap: ContentMap = await withProcessingTimeout(
      extractAndMapContent({
        fileBuffer,
        mimeType: note.mime_type,
        profile: {
          ca_level: profile.ca_level as CaLevel,
          ca_groups: profile.ca_groups,
          ca_papers: profile.ca_papers,
        },
      })
    );

    // Re-check after the slow call — a cancel could have landed while
    // Gemini was still running. Writing to a deleted row would just be a
    // harmless no-op update, but returning early avoids it outright and
    // makes the intent explicit.
    const { data: stillExistsAfter } = await supabase.from("user_notes").select("id").eq("id", noteId).maybeSingle();
    if (!stillExistsAfter) return;

    await supabase.from("user_notes").update({ content_map: contentMap }).eq("id", noteId);

    // Extraction/mapping only — question and flashcard generation now happen
    // on demand (POST /api/ca/notes/generate) once the student chooses
    // "Create Practice Session" or "Generate Flashcards", instead of both
    // being generated automatically for every upload.
    await supabase.from("user_notes").update({ processed: true, processing_error: null }).eq("id", noteId);
    await supabase
      .from("processing_queue")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("note_id", noteId);
  } catch (error) {
    const message = errorMessage(error);
    console.error(`CA note processing failed for note ${noteId}:`, error);
    await supabase.from("user_notes").update({ processing_error: message }).eq("id", noteId);
    await supabase
      .from("processing_queue")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("note_id", noteId);
  }
}
