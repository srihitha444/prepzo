import { GoogleGenerativeAI, type GenerativeModel, type GenerateContentResult } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | null = null;

function getGemini(): GoogleGenerativeAI {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY");
    }
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _genAI;
}

/**
 * Which Gemini model each task runs on.
 *
 * Everything used to run on one model, which made the AI Teacher — by far the
 * highest-volume call — cost the same per token as document extraction. At
 * measured usage that put every tier underwater: on the strongest Flash model
 * a single tutor message costs about Rs.0.99 post-promo, against a Rs.129/month
 * plan. Splitting by task is the single biggest cost lever available and
 * changes nothing a student sees.
 *
 * The split, and why:
 *   extraction  — STRONGEST. content_map is written once and never re-derived
 *                 (see lib/ca/processNote.ts), so every downstream feature
 *                 inherits its quality permanently. This is the one place not
 *                 to economise.
 *   generation  — cheaper. Working from already-extracted text, not vision.
 *   cheatsheet  — cheaper. Summarising text that has already been extracted.
 *   evaluation  — cheaper. Grading one answer against a model answer.
 *   tutor       — cheapest. Highest volume by an order of magnitude, and a
 *                 chat grounded in the student's own notes is close to the
 *                 ideal lightweight workload.
 *
 * Every task can be overridden by environment variable without a deploy, so a
 * model can be A/B'd for quality (GEMINI_MODEL_TUTOR=gemini-flash-latest to
 * put one back on the strong model).
 */
export type CaTask = "extraction" | "generation" | "cheatsheet" | "evaluation" | "tutor";

// Rolling aliases rather than dated snapshots, deliberately. Google retires
// dated versions for new keys — gemini-2.5-flash and gemini-2.5-flash-lite
// both now 404 with "no longer available to new users", and pinning one of
// those would take a feature down completely. The trade is that an alias can
// move to a differently-priced model, so the cost assumptions in
// docs/ca-platform/BUILD_STATUS.md should be rechecked when it does.
// As of 2026-09-29: gemini-flash-latest resolves to 3.8 Flash, and
// gemini-flash-lite-latest to 3.5 Flash-Lite.
const STRONG = "gemini-flash-latest";
const CHEAP = "gemini-flash-lite-latest";

const TASK_MODELS: Record<CaTask, string> = {
  extraction: process.env.GEMINI_MODEL_EXTRACTION || STRONG,
  generation: process.env.GEMINI_MODEL_GENERATION || CHEAP,
  cheatsheet: process.env.GEMINI_MODEL_CHEATSHEET || CHEAP,
  evaluation: process.env.GEMINI_MODEL_EVALUATION || CHEAP,
  tutor: process.env.GEMINI_MODEL_TUTOR || CHEAP,
};

export function modelNameFor(task: CaTask): string {
  return TASK_MODELS[task];
}

const _models = new Map<string, GenerativeModel>();

/**
 * `json` selects strict-JSON mode. Extraction, generation and evaluation parse
 * the response, so they need it; tutor and cheatsheet return prose and must
 * not have it.
 */
export function getModel(task: CaTask, options: { json?: boolean } = {}): GenerativeModel {
  const name = TASK_MODELS[task];
  const key = `${name}:${options.json ? "json" : "text"}`;
  let model = _models.get(key);
  if (!model) {
    model = getGemini().getGenerativeModel({
      model: name,
      ...(options.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    });
    _models.set(key, model);
  }
  return model;
}

const RETRYABLE_STATUS_CODES = new Set([503, 429]);
const RETRY_DELAYS_MS = [800, 2000];

// For background extraction/processing calls (lib/ca/extraction.ts,
// lib/ca/extractTestPaper.ts) — those now run inside a 165s processing
// budget (see lib/ca/processingTimeout.ts), not a synchronous request a
// student is staring at, so it's worth trading a slower failure for a much
// better chance of actually succeeding through a burst of 503 "high
// demand" errors, rather than giving up after ~3s like every interactive
// call site (chat, cheatsheet/question generation, evaluation) still does.
export const PATIENT_RETRY_DELAYS_MS = [2000, 5000, 10000, 20000];

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
 * etc.) still throw immediately. Pass PATIENT_RETRY_DELAYS_MS for calls
 * that have a large time budget and should try harder before giving up.
 */
/**
 * True when Google has retired the model out from under us. Distinct from a
 * transient 503: retrying the same name will never succeed, so the caller
 * falls back to the strong alias instead.
 */
export function isModelUnavailableError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const message = String((error as { message?: string })?.message ?? "");
  return status === 404 || /no longer available|not found|is not supported/i.test(message);
}

export async function generateWithRetry(
  model: GenerativeModel,
  request: Parameters<GenerativeModel["generateContent"]>[0],
  retryDelaysMs: number[] = RETRY_DELAYS_MS
): Promise<GenerateContentResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      return await model.generateContent(request);
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === retryDelaysMs.length) throw error;
      await sleep(retryDelaysMs[attempt]);
    }
  }
  throw lastError;
}

/**
 * Runs a task's model, falling back to the strong alias if the configured
 * model has been retired.
 *
 * The fallback is not hypothetical: Google has already retired
 * gemini-2.5-flash and gemini-2.5-flash-lite for this key, and both now 404.
 * A retired model is a total outage of whatever task points at it — silent,
 * because nothing else changes — so it is worth one extra attempt against an
 * alias that cannot be retired. Retrying the same dead name would never
 * succeed, which is why this is separate from the 503 backoff.
 */
export async function generateForTask(
  task: CaTask,
  request: Parameters<GenerativeModel["generateContent"]>[0],
  options: { json?: boolean; retryDelaysMs?: number[] } = {}
): Promise<GenerateContentResult> {
  const { json, retryDelaysMs } = options;
  try {
    return await generateWithRetry(getModel(task, { json }), request, retryDelaysMs);
  } catch (error) {
    const configured = modelNameFor(task);
    if (!isModelUnavailableError(error) || configured === STRONG) throw error;

    console.error(
      `[gemini] model "${configured}" for task "${task}" is unavailable — falling back to ${STRONG}. ` +
        `Update GEMINI_MODEL_${task.toUpperCase()} to stop paying the stronger model's rate.`
    );
    const fallback = getGemini().getGenerativeModel({
      model: STRONG,
      ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    });
    return generateWithRetry(fallback, request, retryDelaysMs);
  }
}
