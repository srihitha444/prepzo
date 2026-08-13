import { GoogleGenerativeAI, type GenerativeModel, type GenerateContentResult } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | null = null;
let _contentModel: GenerativeModel | null = null;
let _chatModel: GenerativeModel | null = null;

function getGemini(): GoogleGenerativeAI {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY");
    }
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _genAI;
}

// "gemini-flash-latest" is Google's rolling alias for their current
// recommended flash model, rather than a dated snapshot (e.g.
// "gemini-2.5-flash") that Google can and does retire for new API keys —
// confirmed live: this key gets a 404 "no longer available to new users"
// on gemini-2.5-flash but resolves gemini-flash-latest to Gemini 3.6 Flash.
const MODEL = "gemini-flash-latest";

// Used for extraction, content-type/paper mapping, question/flashcard
// generation, and descriptive answer evaluation — anywhere the response
// must be strict JSON. See docs/ca-platform/10_GOOGLE_CLOUD.md for the
// full model selection rationale.
export function getContentModel(): GenerativeModel {
  if (!_contentModel) {
    _contentModel = getGemini().getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });
  }
  return _contentModel;
}

// Used for AI Teacher chat, which returns free-form conversational text,
// not JSON. Same underlying model as getContentModel() — the spec's
// separate, cheaper gemini-3.1-flash-lite can't be verified without
// knowing it's actually available on this key, so this reuses the one
// model already confirmed to work.
export function getChatModel(): GenerativeModel {
  if (!_chatModel) {
    _chatModel = getGemini().getGenerativeModel({ model: MODEL });
  }
  return _chatModel;
}

const RETRYABLE_STATUS_CODES = new Set([503, 429]);
const RETRY_DELAYS_MS = [800, 2000];

export function isRetryableGeminiError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return typeof status === "number" && RETRYABLE_STATUS_CODES.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps model.generateContent() with a short retry-with-backoff for
 * transient errors (503 "high demand", 429 rate limit) — common on shared
 * model aliases like gemini-flash-latest, and they usually clear within a
 * couple of seconds, so this beats surfacing the raw error to the student
 * on the first hiccup. Non-retryable errors (bad request, missing key,
 * etc.) still throw immediately.
 */
export async function generateWithRetry(
  model: GenerativeModel,
  request: Parameters<GenerativeModel["generateContent"]>[0]
): Promise<GenerateContentResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await model.generateContent(request);
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === RETRY_DELAYS_MS.length) throw error;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}
