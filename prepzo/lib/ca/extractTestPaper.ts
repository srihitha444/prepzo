import { getContentModel, generateWithRetry } from "@/lib/gemini";
import { normalizeDifficulty, type RawQuestion } from "@/lib/ca/generateContent";
import type { CaPaper } from "@/lib/ca-syllabus";

export interface VerbatimQuestionRow {
  question_type: "mcq" | "descriptive";
  subject: string;
  paper: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_option: string | null;
  negative_marking_value: number;
  marks: number | null;
  model_answer: string | null;
  mark_allocation: unknown;
  difficulty: "Easy" | "Medium" | "Hard" | null;
  explanation: string | null;
  test_paper_id: string;
}

// Real papers are very often distributed as the question paper only, with no
// bundled answer key — that's expected, not a failure, so a missing
// correct_option/model_answer must NOT drop the row (it used to, which made
// answer-key-less uploads silently extract to 0 questions with no obvious
// error). useCaMockTest.ts treats a null correct_option as "ungraded":
// answerable, but excluded from scoring rather than auto-marked wrong.
// Same reasoning for a descriptive question's marks — a scan can obscure a
// small printed number, and the AI evaluator (lib/ca/evaluateAnswer.ts)
// already tolerates a missing marks value, so it's not required here either.
function isValidVerbatimQuestion(q: RawQuestion): boolean {
  if (!q.question_text) return false;
  if (q.question_type === "mcq") {
    return Boolean(q.option_a && q.option_b && q.option_c && q.option_d);
  }
  return q.question_type === "descriptive";
}

// The model can be inconsistent about casing ("MCQ" vs "mcq", "a" vs "A")
// even with an explicit schema — normalize rather than let a well-formed
// answer get silently rejected by a strict equality/regex check downstream.
function normalizeQuestionType(value: string | undefined): "mcq" | "descriptive" | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "mcq") return "mcq";
  if (normalized === "descriptive") return "descriptive";
  return null;
}

function normalizeCorrectOption(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-D]$/.test(normalized) ? normalized : null;
}

const RESULT_SHAPE = `{
  "questions": [
    {
      "question_type": "mcq" | "descriptive",
      "question_text": "string, exactly as printed",
      "option_a": "string or omit for descriptive",
      "option_b": "string or omit for descriptive",
      "option_c": "string or omit for descriptive",
      "option_d": "string or omit for descriptive",
      "correct_option": "A|B|C|D — only if an answer key/solution for this question is present in the document, else omit",
      "negative_marking_value": "number, only if the paper states negative marking, else 0",
      "marks": "number, descriptive only — as printed on the paper",
      "model_answer": "string, descriptive only — only if a model answer/solution is present in the document, else omit",
      "mark_allocation": "array like [{\\"step\\":\\"...\\",\\"marks\\":1}, ...], only if the source shows a marking breakdown, else omit",
      "difficulty": "Easy|Medium|Hard, mcq only, your best estimate — else omit",
      "explanation": "string, only if the source provides one, else omit"
    }
  ]
}`;

/**
 * Transcribes the actual questions from a real past/mock exam paper
 * verbatim — no generation, no rephrasing, no content-block splitting. This
 * is deliberately a separate, simpler pipeline from lib/ca/extraction.ts +
 * generateContent.ts (which synthesize new content from raw study notes):
 * a real paper is already exam-shaped, so the only job here is faithful
 * transcription, and the paper/subject is already known from what the
 * student picked at upload time rather than inferred.
 */
export async function extractTestPaperQuestions(params: {
  fileBuffer: Buffer;
  mimeType: string;
  paper: CaPaper;
  testPaperId: string;
}): Promise<VerbatimQuestionRow[]> {
  const { fileBuffer, mimeType, paper, testPaperId } = params;

  const prompt = `You are transcribing a real ${paper.name} (CA) exam/mock paper. This is NOT study material to summarise or generate questions from — extract the actual questions exactly as they appear in the document, preserving original wording, numbers, and options.

Rules:
- Do not invent, rephrase, or paraphrase any question, option, or answer.
- Indian number format (1,00,000 not 100,000) with ₹ symbol for amounts, exactly as printed.
- If this document includes an answer key or model solutions (even on separate pages, or in a distinct section), match each answer to its question. If a particular question has no discoverable answer anywhere in the document, still include the question but omit correct_option/model_answer for it.
- Any tabular content in a question (balance sheets, ledgers, trial balances, journal entries) must be transcribed as a proper markdown table in question_text — a header row, a \`|---|---|\` separator row, then one data row per line (one row per account/line-item). Never flatten a table's rows and columns into a single run-on line of text separated by "|" — that loses the row/column structure entirely.
- If a question has multiple lettered/numbered sub-parts — (i)/(ii)/(iii), (a)/(b)/(c), or similar — put each sub-part on its own line (separate it from the next with a blank line) in question_text, keeping its original label exactly as printed. Never run sub-parts together into one continuous paragraph.
- Ignore page headers/footers, instructions/cover pages, and blank pages — extract only actual exam questions.

Return strict JSON only, matching this shape:
${RESULT_SHAPE}`;

  const model = getContentModel();
  const result = await generateWithRetry(model, [
    { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
    { text: prompt },
  ]);

  const text = result.response.text();
  let parsed: { questions?: RawQuestion[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error(`[extractTestPaperQuestions] non-JSON response for test paper ${testPaperId}:`, text.slice(0, 2000));
    throw new Error("Gemini returned non-JSON content during test paper extraction");
  }

  const rawItems = parsed.questions || [];
  const rows: VerbatimQuestionRow[] = [];
  const rejectionReasons: string[] = [];

  for (const raw of rawItems) {
    const questionType = normalizeQuestionType(raw.question_type);
    const q: RawQuestion = { ...raw, question_type: questionType ?? raw.question_type };
    if (!questionType) {
      rejectionReasons.push(`unrecognised question_type "${raw.question_type}"`);
      continue;
    }
    if (!isValidVerbatimQuestion(q)) {
      rejectionReasons.push(
        questionType === "mcq"
          ? "mcq missing one or more options"
          : "descriptive missing question_text"
      );
      continue;
    }
    const isMcq = questionType === "mcq";
    rows.push({
      question_type: isMcq ? "mcq" : "descriptive",
      subject: paper.name,
      paper: paper.code,
      question_text: q.question_text!,
      option_a: isMcq ? q.option_a ?? null : null,
      option_b: isMcq ? q.option_b ?? null : null,
      option_c: isMcq ? q.option_c ?? null : null,
      option_d: isMcq ? q.option_d ?? null : null,
      correct_option: isMcq ? normalizeCorrectOption(q.correct_option) : null,
      negative_marking_value: isMcq ? q.negative_marking_value ?? 0 : 0,
      marks: !isMcq ? q.marks ?? null : null,
      model_answer: !isMcq ? q.model_answer ?? null : null,
      mark_allocation: !isMcq ? q.mark_allocation ?? null : null,
      difficulty: isMcq ? normalizeDifficulty(q.difficulty) : null,
      explanation: q.explanation ?? null,
      test_paper_id: testPaperId,
    });
  }

  if (rows.length === 0) {
    // Surface exactly what happened rather than a generic "found nothing" —
    // this is the difference between "Gemini genuinely saw no questions on
    // the page" (rawItems.length === 0, likely a scan-quality/model issue)
    // and "Gemini extracted items but they didn't pass validation" (a
    // fixable bug in isValidVerbatimQuestion or the prompt schema).
    console.error(
      `[extractTestPaperQuestions] 0 valid rows for test paper ${testPaperId}. Raw item count: ${rawItems.length}. Raw response (first 3000 chars):`,
      text.slice(0, 3000)
    );
    if (rawItems.length === 0) {
      throw new Error(
        "Gemini did not detect any questions in this file. If it's a scanned document, try a clearer/higher-resolution scan."
      );
    }
    const reasonCounts = rejectionReasons.reduce<Record<string, number>>((acc, r) => {
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    const summary = Object.entries(reasonCounts)
      .map(([reason, count]) => `${count}× ${reason}`)
      .join("; ");
    throw new Error(`Gemini found ${rawItems.length} question(s) but none were usable: ${summary}`);
  }

  return rows;
}
