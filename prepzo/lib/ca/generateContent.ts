import { randomUUID } from "crypto";
import { getContentModel, generateWithRetry } from "@/lib/gemini";
import { getPaperByCode, type CaLevel } from "@/lib/ca-syllabus";
import { buildFlashcardRules, buildQuestionRules, getFormatClass } from "@/lib/ca/templates";
import type { ContentBlock } from "@/lib/ca/extraction";

export type GenerateMode = "questions" | "flashcards";

/** Used when the caller doesn't specify a per-block count. */
export const DEFAULT_ITEMS_PER_BLOCK = 3;

/**
 * Splits the student's requested total across the blocks they selected.
 * Larger blocks (more source text) carry proportionally more, since they
 * genuinely support more distinct questions, but every selected block gets
 * at least one — a student who ticked a topic expects something from it.
 */
export function splitCountAcrossBlocks(blocks: ContentBlock[], total: number): Record<string, number> {
  const result: Record<string, number> = {};
  if (blocks.length === 0) return result;
  if (total <= blocks.length) {
    // Not enough to go round — one each, in order, until the total runs out.
    blocks.forEach((b, i) => {
      result[b.block_id] = i < total ? 1 : 0;
    });
    return result;
  }

  const weights = blocks.map((b) => Math.max(1, b.raw_content.length));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let assigned = 0;
  blocks.forEach((b, i) => {
    const share = Math.max(1, Math.floor((total * weights[i]) / totalWeight));
    result[b.block_id] = share;
    assigned += share;
  });

  // Rounding leaves a remainder either way — settle it on the largest
  // block rather than spreading fractions around.
  const largest = blocks.reduce((a, b) => (a.raw_content.length >= b.raw_content.length ? a : b));
  result[largest.block_id] += total - assigned;
  if (result[largest.block_id] < 1) result[largest.block_id] = 1;
  return result;
}

export interface GeneratedQuestionRow {
  question_type: "mcq" | "descriptive";
  subject: string;
  paper: string;
  topic: string;
  content_type: ContentBlock["content_type"];
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
  section_references: string[] | null;
  note_id: string;
  block_id: string;
  // A shared case-study/scenario passage (intermediate-mixed/final-mixed
  // MCQs — see buildQuestionRules in templates.ts) linking this question to
  // the other MCQs generated under the same passage. Captured once per
  // group in code (see generateForBlocks below) and copied identically to
  // every question in the group, never re-derived per question, so it can't
  // drift between them. Null for a standalone question.
  case_study_passage: string | null;
  case_study_group_id: string | null;
}

export interface GeneratedFlashcardRow {
  flashcard_type: string;
  subject: string;
  paper: string;
  topic: string;
  front_text: string;
  back_text: string;
  section_reference: string | null;
  note_id: string;
  block_id: string;
}

export interface RawQuestion {
  question_type?: string;
  question_text?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: string;
  marks?: number;
  model_answer?: string;
  mark_allocation?: unknown;
  difficulty?: string;
  explanation?: string;
  section_references?: string[];
  negative_marking_value?: number;
}

interface RawFlashcard {
  flashcard_type?: string;
  front_text?: string;
  back_text?: string;
  section_reference?: string;
}

interface RawCaseStudyGroup {
  passage?: string;
  questions?: RawQuestion[];
}

interface RawBlockResult {
  block_id?: string;
  questions?: RawQuestion[];
  flashcards?: RawFlashcard[];
  case_studies?: RawCaseStudyGroup[];
}

const VALID_FLASHCARD_TYPES = new Set([
  "definition",
  "section",
  "formula",
  "accounting_rule",
  "standard",
  "comparison",
]);

export function isValidQuestion(q: RawQuestion): boolean {
  if (!q.question_text) return false;
  if (q.question_type === "mcq") {
    return Boolean(q.option_a && q.option_b && q.option_c && q.option_d && q.correct_option && /^[A-D]$/.test(q.correct_option));
  }
  if (q.question_type === "descriptive") {
    return typeof q.marks === "number" && Boolean(q.model_answer);
  }
  return false;
}

export function normalizeDifficulty(value: string | undefined): "Easy" | "Medium" | "Hard" | null {
  if (value === "Easy" || value === "Medium" || value === "Hard") return value;
  return null;
}

const GENERATED_QUESTION_SHAPE = `{
          "question_type": "mcq" | "descriptive",
          "question_text": "string",
          "option_a": "string or omit for descriptive",
          "option_b": "string or omit for descriptive",
          "option_c": "string or omit for descriptive",
          "option_d": "string or omit for descriptive",
          "correct_option": "A|B|C|D or omit for descriptive",
          "negative_marking_value": 0.25 for foundation-mcq else 0,
          "marks": "number, descriptive only",
          "model_answer": "string, descriptive only",
          "mark_allocation": "array, descriptive only",
          "difficulty": "Easy|Medium|Hard, mcq only",
          "explanation": "string",
          "section_references": ["string"]
        }`;

const RESULT_SHAPE_BY_MODE: Record<GenerateMode, string> = {
  questions: `{
  "results": [
    {
      "block_id": "the BLOCK id from above",
      "questions": [
        ${GENERATED_QUESTION_SHAPE}
      ],
      "case_studies": [
        {
          "passage": "string, the shared scenario/case passage — see this block's instructions for when to use this",
          "questions": [
            ${GENERATED_QUESTION_SHAPE}
          ]
        }
      ]
    }
  ]
}`,
  flashcards: `{
  "results": [
    {
      "block_id": "the BLOCK id from above",
      "flashcards": [
        { "flashcard_type": "definition|section|formula|accounting_rule|standard|comparison", "front_text": "string", "back_text": "string", "section_reference": "string or omit" }
      ]
    }
  ]
}`,
};

/**
 * Generates either questions OR flashcards (never both — see GenerateMode)
 * for a set of already-mapped content blocks in a single Gemini call, keyed
 * back to block_id so each row can be traced to its source. Split by mode
 * so a student choosing "Create Practice Session" doesn't also pay for
 * (and wait on) flashcards they didn't ask for, and vice versa. Invalid/
 * malformed rows from the model are dropped rather than failing the batch.
 */
export async function generateForBlocks(params: {
  noteId: string;
  level: CaLevel;
  blocks: ContentBlock[];
  mode: GenerateMode;
  /**
   * How many items to produce for each block, keyed by block_id — derived
   * from the total the student asked for, split across their selected
   * blocks (see splitCountAcrossBlocks). Blocks missing from the map fall
   * back to DEFAULT_ITEMS_PER_BLOCK.
   */
  countByBlock?: Record<string, number>;
  /**
   * Items already sitting in the shared pool for each block, so a top-up
   * run produces genuinely NEW items instead of near-duplicates of what a
   * previous student already generated. Keyed by block_id. Only the item
   * text is needed — enough for the model to avoid repeating itself,
   * without paying to send full payloads back.
   */
  existingByBlock?: Record<string, string[]>;
}): Promise<{ questions: GeneratedQuestionRow[]; flashcards: GeneratedFlashcardRow[] }> {
  const { noteId, level, blocks, mode, countByBlock, existingByBlock } = params;
  const usable = blocks.filter((b) => b.paper);
  if (usable.length === 0) return { questions: [], flashcards: [] };

  const blockSections = usable
    .map((block) => {
      const paper = getPaperByCode(block.paper!);
      if (!paper) return null;
      const count = countByBlock?.[block.block_id] ?? DEFAULT_ITEMS_PER_BLOCK;
      if (count <= 0) return null;
      const rules =
        mode === "questions"
          ? buildQuestionRules(getFormatClass(paper, level), block.content_type, paper, count)
          : buildFlashcardRules(block.content_type, level, count);
      const label = mode === "questions" ? "Questions to generate for this block" : "Flashcards to generate for this block";

      // Top-up run: the pool already holds items for this block, so the
      // source has been mined at least once. Show what exists (text only)
      // and require genuinely different items — otherwise generating from
      // the same passage twice converges on the same handful of questions.
      const existing = existingByBlock?.[block.block_id] || [];
      const existingNote = existing.length
        ? `\nAlready generated for this block — every new item must be clearly different from all of these, testing something these do not:\n${existing
            .map((t, i) => `${i + 1}. ${t}`)
            .join("\n")}`
        : "";

      return `BLOCK ${block.block_id} (paper: ${paper.code} ${paper.name}, content_type: ${block.content_type}, topic: ${block.topic}):
"""
${block.raw_content}
"""
${label}: ${rules}${existingNote}`;
    })
    .filter((s): s is string => Boolean(s));

  if (blockSections.length === 0) return { questions: [], flashcards: [] };

  const kind = mode === "questions" ? "CA exam questions" : "CA flashcards";
  const prompt = `You generate ${kind} from study note content. Follow the per-block instructions exactly — they fix how many items and what type/marks to produce; you only supply the content.

${blockSections.join("\n\n")}

Rules for every item:
- Indian number format (1,00,000 not 100,000) with ₹ symbol for amounts
${mode === "questions" ? `- mcq questions: correct_option is exactly one of "A","B","C","D"
- descriptive questions: include a mark_allocation array like [{"step":"...","marks":1}, ...] summing to the question's marks
- difficulty (mcq only) is one of "Easy","Medium","Hard"` : ""}
- Produce the exact number of items each block asks for. A block's source text may not support that many genuinely distinct items on its own — when you have exhausted what the source can test without repeating yourself, keep going using the block's TOPIC as the subject, drawing on standard Indian CA syllabus knowledge for that topic at the ${level} level. Items produced this way must still be unmistakably Indian CA content (Indian Acts, Indian standards, ₹ amounts) and pitched at ${level}, never generic or international.
- For any item that goes beyond the source content: test concepts, application, classification, treatment, sequence, which provision applies, and reasoning about a scenario. Do NOT build such an item around a specific monetary threshold, exemption limit, turnover/registration limit, deduction cap, tax rate, slab, due date or penalty amount unless that exact figure appears in the source content above — those change with each Finance Act and a wrong figure teaches the student something false. Structure and reasoning are safe to draw from knowledge; specific current-year numbers are not.
- Never invent section numbers or standard numbers not present in the source content, EXCEPT where you are drawing on the block's topic beyond the source — there, cite only long-standing, well-established section/standard numbers you are confident of, and omit the citation entirely rather than guessing at one
- Any tabular content (balance sheets, ledgers, trial balances, journal entries) must be a proper markdown table — a header row, a \`|---|---|\` separator row, then one data row per line. Never flatten a table's rows/columns into a single run-on line of text separated by "|".
- If a question has multiple lettered/numbered sub-parts — (i)/(ii)/(iii), (a)/(b)/(c), or similar — put each sub-part on its own line (separate it from the next with a blank line), keeping its label. Never run sub-parts together into one continuous paragraph.
${mode === "questions" ? `- When a block's instructions say to generate a shared case/scenario passage: put the passage once under that block's "case_studies[].passage", and list ONLY the MCQs testing it under "case_studies[].questions" — never duplicate the passage into each question's own question_text, and never also repeat those questions under the block's top-level "questions" array. A question with no shared passage belongs in "questions", not in a case_studies group of its own.` : ""}

Return strict JSON only, matching this shape:
${RESULT_SHAPE_BY_MODE[mode]}`;

  const model = getContentModel();
  const result = await generateWithRetry(model, prompt);
  const text = result.response.text();

  let parsed: { results?: RawBlockResult[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned non-JSON content during generation");
  }

  const questions: GeneratedQuestionRow[] = [];
  const flashcards: GeneratedFlashcardRow[] = [];
  const blocksById = new Map(usable.map((b) => [b.block_id, b]));

  for (const blockResult of parsed.results || []) {
    const block = blockResult.block_id ? blocksById.get(blockResult.block_id) : undefined;
    if (!block || !block.paper) continue;
    const paper = getPaperByCode(block.paper);
    if (!paper) continue;

    if (mode === "questions") {
      // Shared by both standalone questions and every case-study group's
      // questions — passage/groupId are null for a standalone question, and
      // the SAME passage string/groupId are passed for every question in a
      // group (computed once by the caller below), never re-derived per question.
      const pushQuestion = (q: RawQuestion, passage: string | null, groupId: string | null) => {
        if (!isValidQuestion(q)) return;
        const isMcq = q.question_type === "mcq";
        questions.push({
          question_type: isMcq ? "mcq" : "descriptive",
          subject: paper.name,
          paper: paper.code,
          topic: block.topic,
          content_type: block.content_type,
          question_text: q.question_text!,
          option_a: isMcq ? q.option_a ?? null : null,
          option_b: isMcq ? q.option_b ?? null : null,
          option_c: isMcq ? q.option_c ?? null : null,
          option_d: isMcq ? q.option_d ?? null : null,
          correct_option: isMcq ? q.correct_option ?? null : null,
          negative_marking_value: isMcq ? q.negative_marking_value ?? 0 : 0,
          marks: !isMcq ? q.marks ?? null : null,
          model_answer: !isMcq ? q.model_answer ?? null : null,
          mark_allocation: !isMcq ? q.mark_allocation ?? null : null,
          difficulty: isMcq ? normalizeDifficulty(q.difficulty) : null,
          explanation: q.explanation ?? null,
          section_references: q.section_references && q.section_references.length > 0 ? q.section_references : null,
          note_id: noteId,
          block_id: block.block_id,
          case_study_passage: passage,
          case_study_group_id: groupId,
        });
      };

      for (const q of blockResult.questions || []) {
        pushQuestion(q, null, null);
      }
      for (const group of blockResult.case_studies || []) {
        if (!group.passage || !group.questions?.length) continue;
        const groupId = randomUUID();
        for (const q of group.questions) {
          pushQuestion(q, group.passage, groupId);
        }
      }
    } else {
      for (const f of blockResult.flashcards || []) {
        if (!f.front_text || !f.back_text || !f.flashcard_type || !VALID_FLASHCARD_TYPES.has(f.flashcard_type)) continue;
        flashcards.push({
          flashcard_type: f.flashcard_type,
          subject: paper.name,
          paper: paper.code,
          topic: block.topic,
          front_text: f.front_text,
          back_text: f.back_text,
          section_reference: f.section_reference ?? null,
          note_id: noteId,
          block_id: block.block_id,
        });
      }
    }
  }

  return { questions, flashcards };
}
