// Vercel kills a serverless function outright once it exceeds maxDuration —
// code stops mid-statement, no catch block runs, so processing_queue/
// user_notes (or ca_test_papers) is left stuck on "processing" forever with
// no reason recorded. Racing the actual work against an application-level
// timeout that's comfortably shorter than maxDuration means the code itself
// gets a chance to give up gracefully and write a real, specific error
// before the platform would otherwise silently kill it.
//
// 165s, not the full 180s maxDuration configured on the upload routes —
// leaves ~15s of headroom for the download-from-storage step before this
// and the DB write-back after it, matching the same ratio the original
// 45s/60s pair used. Sending a whole PDF as inline multimodal data for
// extraction+classification is a genuinely heavy Gemini request; 45s
// turned out to be too little to ever finish for a real multi-page
// document even with nothing going wrong, not just as a slow-case margin.
export const PROCESSING_TIMEOUT_MS = 165_000;

export async function withProcessingTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Processing took longer than ${Math.round(PROCESSING_TIMEOUT_MS / 60_000)} minutes and was stopped automatically. This can happen with a large file or high AI demand — try again, or use a smaller/clearer file.`
        )
      );
    }, PROCESSING_TIMEOUT_MS);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
