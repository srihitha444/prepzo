import { createServiceClient } from "@/lib/supabase/server";
import { extractTestPaperQuestions } from "@/lib/ca/extractTestPaper";
import { getPaperByCode } from "@/lib/ca-syllabus";

const TEST_PAPERS_BUCKET = "ca-test-papers";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown processing error";
}

/**
 * Runs after the upload response has already been sent (see the `after()`
 * call in app/api/ca/test-papers/upload/route.ts) — mirrors
 * lib/ca/processNote.ts's shape, but the pipeline itself is simpler: no
 * profile/onboarding lookup (the paper was already chosen at upload) and no
 * content_map save, just transcribe -> insert questions -> mark done.
 */
export async function processTestPaper(testPaperId: string): Promise<void> {
  const supabase = await createServiceClient();

  await supabase
    .from("processing_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("test_paper_id", testPaperId);

  try {
    const { data: paperRow, error: paperError } = await supabase
      .from("ca_test_papers")
      .select("id, paper, file_path, mime_type")
      .eq("id", testPaperId)
      .single();
    if (paperError || !paperRow) throw new Error("Test paper not found");

    const paper = getPaperByCode(paperRow.paper);
    if (!paper) throw new Error("Unrecognised paper code");

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(TEST_PAPERS_BUCKET)
      .download(paperRow.file_path);
    if (downloadError || !fileBlob) throw new Error("Could not download uploaded file from storage");

    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

    const questions = await extractTestPaperQuestions({
      fileBuffer,
      mimeType: paperRow.mime_type,
      paper,
      testPaperId,
    });

    // Genuinely no extractable content (bad scan, wrong file, etc) — treated
    // the same as a processing failure (status 'failed', error surfaced in
    // TestPapersPanel) rather than silently marking "Ready" with 0 questions
    // and a dead-end Attempt button.
    if (questions.length === 0) {
      throw new Error("Couldn't find any questions in this file — try a clearer scan or a different file.");
    }

    const { error: insertError } = await supabase
      .from("questions")
      .insert(questions.map((q) => ({ ...q, exam: "CA", is_active: true, is_pyq: false })));
    if (insertError) throw new Error(`Failed to save extracted questions: ${insertError.message}`);

    await supabase
      .from("ca_test_papers")
      .update({ processed: true, processing_error: null, question_count: questions.length })
      .eq("id", testPaperId);
    await supabase
      .from("processing_queue")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("test_paper_id", testPaperId);
  } catch (error) {
    const message = errorMessage(error);
    console.error(`CA test paper processing failed for paper ${testPaperId}:`, error);
    await supabase.from("ca_test_papers").update({ processing_error: message }).eq("id", testPaperId);
    await supabase
      .from("processing_queue")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("test_paper_id", testPaperId);
  }
}
