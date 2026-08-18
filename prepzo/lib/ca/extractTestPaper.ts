import { randomUUID } from "crypto";
import { getContentModel, generateWithRetry } from "@/lib/gemini";
import { normalizeDifficulty, type RawQuestion } from "@/lib/ca/generateContent";
import { CA_SYLLABUS, getPaperByCode } from "@/lib/ca-syllabus";

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
  // A shared case-study/scenario passage (e.g. ICAI Final Paper 6's
  // multi-disciplinary case studies) that this question is one of several
  // linked sub-questions for. Both are null for a normal standalone
  // question. The passage text is captured ONCE per group in code (see
  // extractTestPaperQuestions below) and copied verbatim to every row in
  // the group — never re-generated per question — so it can't drift
  // between sub-questions the way asking the model to repeat it would.
  case_study_passage: string | null;
  case_study_group_id: string | null;
}

interface RawVerbatimQuestion extends RawQuestion {
  paper_code?: string;
}

interface RawCaseStudyGroup {
  passage?: string;
  paper_code?: string;
  questions?: RawVerbatimQuestion[];
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

// The full CA paper universe (all 3 levels) — the student no longer picks a
// paper at upload, so the model classifies each question/case-study group
// against this list itself. Not scoped to the uploader's own registered
// papers: a student may reasonably attempt a paper outside their currently
// selected group (a friend's paper, another level's specimen paper, etc).
const ALL_PAPERS = Object.values(CA_SYLLABUS).flatMap((level) => level.papers);
const PAPER_REFERENCE = ALL_PAPERS.map((p) => `${p.code}: ${p.name}`).join("\n");

const QUESTION_SHAPE = `{
      "question_type": "mcq" | "descriptive",
      "question_text": "string, exactly as printed",
      "paper_code": "the matching code from the paper list above",
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
    }`;

const RESULT_SHAPE = `{
  "document_type": "question_paper" | "not_a_question_paper",
  "questions": [
    ${QUESTION_SHAPE}
  ],
  "case_studies": [
    {
      "passage": "string, the shared case/scenario text exactly as printed, in full",
      "paper_code": "the matching code from the paper list above for this whole case study",
      "questions": [
        ${QUESTION_SHAPE}
      ]
    }
  ]
}`;

/**
 * Transcribes the actual questions from a real past/mock exam paper
 * verbatim — no generation, no rephrasing, no content-block splitting. This
 * is deliberately a separate, simpler pipeline from lib/ca/extraction.ts +
 * generateContent.ts (which synthesize new content from raw study notes): a
 * real paper is already exam-shaped, so the only job here is faithful
 * transcription. The student no longer picks a paper at upload — the model
 * both (a) gates on whether this is actually a real question paper at all
 * (rejecting study notes/other material with a clear error rather than
 * mislabeling it) and (b) classifies each question/case-study group against
 * the full CA paper list, so a document mixing multiple papers doesn't get
 * every question wrongly tagged as whichever single paper a student picked.
 */
export async function extractTestPaperQuestions(params: {
  fileBuffer: Buffer;
  mimeType: string;
  testPaperId: string;
}): Promise<VerbatimQuestionRow[]> {
  const { fileBuffer, mimeType, testPaperId } = params;

  const prompt = `You are looking at a document a CA (Chartered Accountancy, India) student uploaded to attempt as a mock exam.

First, determine whether this document actually IS a real exam/mock/practice QUESTION PAPER — individually numbered questions the student is meant to answer (MCQs with options, or descriptive questions with marks) — as opposed to study notes, a textbook chapter, a syllabus, or any other non-exam material. If it is NOT a real question paper, respond immediately with {"document_type": "not_a_question_paper", "questions": [], "case_studies": []} and do not attempt extraction.

If it IS a real question paper, extract the actual questions exactly as they appear in the document, preserving original wording, numbers, and options — do not summarise, invent, rephrase, or paraphrase any question, option, or answer.

For every question (or case-study group), identify which ONE of these CA papers it belongs to and set paper_code to its exact code — the document may contain questions from more than one paper, so judge each one independently rather than assuming they're all the same paper:
${PAPER_REFERENCE}

Rules:
- Indian number format (1,00,000 not 100,000) with ₹ symbol for amounts, exactly as printed.
- If this document includes an answer key or model solutions (even on separate pages, or in a distinct section), match each answer to its question. If a particular question has no discoverable answer anywhere in the document, still include the question but omit correct_option/model_answer for it.
- Any tabular content in a question (balance sheets, ledgers, trial balances, journal entries) must be transcribed as a proper markdown table in question_text — a header row, a \`|---|---|\` separator row, then one data row per line (one row per account/line-item). Never flatten a table's rows and columns into a single run-on line of text separated by "|" — that loses the row/column structure entirely.
- If a question has multiple lettered/numbered sub-parts — (i)/(ii)/(iii), (a)/(b)/(c), or similar — put each sub-part on its own line (separate it from the next with a blank line) in question_text, keeping its original label exactly as printed. Never run sub-parts together into one continuous paragraph.
- Some papers (e.g. ICAI Final Paper 6, Integrated Business Solutions) present a case/scenario passage followed by several MCQs or descriptive questions that all depend on reading that same passage. When you see this pattern: put the passage text once under "case_studies[].passage" with the group's paper_code, and list ONLY that passage's sub-questions under "case_studies[].questions" — put every other, unrelated question under the top-level "questions" array instead. Each sub-question's own question_text must be just the sub-question itself (e.g. "Which of the following is correct regarding X?") — do NOT re-type or paraphrase the passage into it, and do NOT also duplicate that sub-question under the top-level "questions" array. If a question stands alone with no shared passage, it belongs in "questions", not in a case_studies group of its own.
- Ignore page headers/footers, instructions/cover pages, and blank pages — extract only actual exam questions.

Return strict JSON only, matching this shape:
${RESULT_SHAPE}`;

  const model = getContentModel();
  const result = await generateWithRetry(model, [
    { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
    { text: prompt },
  ]);

  const text = result.response.text();
  let parsed: { document_type?: string; questions?: RawVerbatimQuestion[]; case_studies?: RawCaseStudyGroup[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error(`[extractTestPaperQuestions] non-JSON response for test paper ${testPaperId}:`, text.slice(0, 2000));
    throw new Error("Gemini returned non-JSON content during test paper extraction");
  }

  if (parsed.document_type === "not_a_question_paper") {
    throw new Error(
      "This looks like study notes rather than a real exam/mock question paper. Mock Test only accepts actual printed past or mock papers — head to Upload to turn your notes into practice questions and flashcards instead."
    );
  }

  const standaloneItems = parsed.questions || [];
  const caseStudyGroups = parsed.case_studies || [];
  const rawItems = standaloneItems.length + caseStudyGroups.reduce((sum, g) => sum + (g.questions?.length || 0), 0);
  const rows: VerbatimQuestionRow[] = [];
  const rejectionReasons: string[] = [];

  // Shared by both standalone questions and every case-study group's
  // sub-questions — passage/groupId are null for a standalone question, and
  // the SAME passage string/groupId/paperCode are passed for every
  // sub-question in a group (computed once by the caller), never re-derived
  // per question — a sub-question's own paper_code is ignored in favour of
  // the group's, so the whole group can't end up split across papers.
  function pushRow(raw: RawVerbatimQuestion, passage: string | null, groupId: string | null, paperCode: string | undefined) {
    const questionType = normalizeQuestionType(raw.question_type);
    const q: RawVerbatimQuestion = { ...raw, question_type: questionType ?? raw.question_type };
    if (!questionType) {
      rejectionReasons.push(`unrecognised question_type "${raw.question_type}"`);
      return;
    }
    if (!isValidVerbatimQuestion(q)) {
      rejectionReasons.push(
        questionType === "mcq"
          ? "mcq missing one or more options"
          : "descriptive missing question_text"
      );
      return;
    }
    const paper = paperCode ? getPaperByCode(paperCode) : undefined;
    if (!paper) {
      rejectionReasons.push(`unrecognised paper_code "${paperCode}"`);
      return;
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
      case_study_passage: passage,
      case_study_group_id: groupId,
    });
  }

  for (const raw of standaloneItems) {
    pushRow(raw, null, null, raw.paper_code);
  }

  for (const group of caseStudyGroups) {
    if (!group.passage || !group.questions?.length) continue;
    const groupId = randomUUID();
    for (const raw of group.questions) {
      pushRow(raw, group.passage, groupId, group.paper_code);
    }
  }

  if (rows.length === 0) {
    // Surface exactly what happened rather than a generic "found nothing" —
    // this is the difference between "Gemini genuinely saw no questions on
    // the page" (rawItems === 0, likely a scan-quality/model issue)
    // and "Gemini extracted items but they didn't pass validation" (a
    // fixable bug in isValidVerbatimQuestion or the prompt schema).
    console.error(
      `[extractTestPaperQuestions] 0 valid rows for test paper ${testPaperId}. Raw item count: ${rawItems}. Raw response (first 3000 chars):`,
      text.slice(0, 3000)
    );
    if (rawItems === 0) {
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
    throw new Error(`Gemini found ${rawItems} question(s) but none were usable: ${summary}`);
  }

  return rows;
}
