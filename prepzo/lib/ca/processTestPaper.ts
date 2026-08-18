import { createServiceClient } from "@/lib/supabase/server";
import { extractTestPaperQuestions, type VerbatimQuestionRow } from "@/lib/ca/extractTestPaper";
import { withProcessingTimeout } from "@/lib/ca/processingTimeout";

const TEST_PAPERS_BUCKET = "ca-test-papers";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown processing error";
}

// The student no longer picks a paper at upload (see extractTestPaper.ts —
// the model classifies each question itself, since one document can
// genuinely span more than one paper). ca_test_papers.paper is still a
// single column used for the row's display label and to tag
// ca_mock_test_attempts, so it's set here to whichever paper the most
// extracted questions actually belong to.
function majorityPaper(questions: VerbatimQuestionRow[]): string | null {
  const counts = new Map<string, number>();
  for (const q of questions) counts.set(q.paper, (counts.get(q.paper) || 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [paper, count] of counts) {
    if (count > bestCount) {
      best = paper;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Runs after the upload response has already been sent (see the `after()`
 * call in app/api/ca/test-papers/upload/route.ts) — mirrors
 * lib/ca/processNote.ts's shape, but the pipeline itself is simpler: no
 * profile/onboarding lookup and no content_map save, just transcribe ->
 * insert questions -> mark done.
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
      .select("id, file_path, mime_type")
      .eq("id", testPaperId)
      .single();
    if (paperError || !paperRow) throw new Error("Test paper not found");

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(TEST_PAPERS_BUCKET)
      .download(paperRow.file_path);
    if (downloadError || !fileBlob) throw new Error("Could not download uploaded file from storage");

    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

    // Cheap check right before the expensive/slow step: if the student hit
    // "Cancel" while this was still queued (the row gets deleted, not just
    // flagged — see app/api/ca/test-papers/[id]/route.ts), skip the Gemini
    // call entirely. A cancel landing mid-extraction is still handled
    // below, at the write-back step.
    const { data: stillExists } = await supabase.from("ca_test_papers").select("id").eq("id", testPaperId).maybeSingle();
    if (!stillExists) return;

    const questions = await withProcessingTimeout(
      extractTestPaperQuestions({
        fileBuffer,
        mimeType: paperRow.mime_type,
        testPaperId,
      })
    );

    // Re-check after the slow call — a cancel could have landed while
    // Gemini was still running.
    const { data: stillExistsAfter } = await supabase.from("ca_test_papers").select("id").eq("id", testPaperId).maybeSingle();
    if (!stillExistsAfter) return;

    // Genuinely no extractable content (bad scan, wrong file, etc) — treated
    // the same as a processing failure (status 'failed', error surfaced in
    // TestPapersPanel) rather than silently marking "Ready" with 0 questions
    // and a dead-end Attempt button. A non-question-paper upload (notes,
    // etc) already throws its own specific error inside
    // extractTestPaperQuestions before reaching here.
    if (questions.length === 0) {
      throw new Error("Couldn't find any questions in this file — try a clearer scan or a different file.");
    }

    const { error: insertError } = await supabase
      .from("questions")
      .insert(questions.map((q) => ({ ...q, exam: "CA", is_active: true, is_pyq: false })));
    if (insertError) throw new Error(`Failed to save extracted questions: ${insertError.message}`);

    await supabase
      .from("ca_test_papers")
      .update({ paper: majorityPaper(questions), processed: true, processing_error: null, question_count: questions.length })
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
