import { getContentModel, generateWithRetry } from "@/lib/gemini";
import { getPaperByCode, type CaLevel } from "@/lib/ca-syllabus";
import { buildFlashcardRules, buildQuestionRules, getFormatClass } from "@/lib/ca/templates";
import type { ContentBlock } from "@/lib/ca/extraction";

export type GenerateMode = "questions" | "flashcards";

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
  negative_marking: boolean;
  negative_marking_value: number;
  marks: number | null;
  model_answer: string | null;
  mark_allocation: unknown;
  difficulty: "Easy" | "Medium" | "Hard" | null;
  explanation: string | null;
  section_references: string[] | null;
  note_id: string;
  block_id: string;
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

interface RawBlockResult {
  block_id?: string;
  questions?: RawQuestion[];
  flashcards?: RawFlashcard[];
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

const RESULT_SHAPE_BY_MODE: Record<GenerateMode, string> = {
  questions: `{
  "results": [
    {
      "block_id": "the BLOCK id from above",
      "questions": [
        {
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
}): Promise<{ questions: GeneratedQuestionRow[]; flashcards: GeneratedFlashcardRow[] }> {
  const { noteId, level, blocks, mode } = params;
  const usable = blocks.filter((b) => b.paper);
  if (usable.length === 0) return { questions: [], flashcards: [] };

  const blockSections = usable
    .map((block) => {
      const paper = getPaperByCode(block.paper!);
      if (!paper) return null;
      const rules =
        mode === "questions"
          ? buildQuestionRules(getFormatClass(paper, level), block.content_type, paper)
          : buildFlashcardRules(block.content_type, level);
      const label = mode === "questions" ? "Questions to generate for this block" : "Flashcards to generate for this block";
      return `BLOCK ${block.block_id} (paper: ${paper.code} ${paper.name}, content_type: ${block.content_type}, topic: ${block.topic}):
"""
${block.raw_content}
"""
${label}: ${rules}`;
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
- Never invent section numbers or standard numbers not present in the source content
- Any tabular content (balance sheets, ledgers, trial balances, journal entries) must be a proper markdown table — a header row, a \`|---|---|\` separator row, then one data row per line. Never flatten a table's rows/columns into a single run-on line of text separated by "|".
- If a question has multiple lettered/numbered sub-parts — (i)/(ii)/(iii), (a)/(b)/(c), or similar — put each sub-part on its own line (separate it from the next with a blank line), keeping its label. Never run sub-parts together into one continuous paragraph.

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
      for (const q of blockResult.questions || []) {
        if (!isValidQuestion(q)) continue;
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
          negative_marking: isMcq ? (q.negative_marking_value ?? 0) > 0 : false,
          negative_marking_value: isMcq ? q.negative_marking_value ?? 0 : 0,
          marks: !isMcq ? q.marks ?? null : null,
          model_answer: !isMcq ? q.model_answer ?? null : null,
          mark_allocation: !isMcq ? q.mark_allocation ?? null : null,
          difficulty: isMcq ? normalizeDifficulty(q.difficulty) : null,
          explanation: q.explanation ?? null,
          section_references: q.section_references && q.section_references.length > 0 ? q.section_references : null,
          note_id: noteId,
          block_id: block.block_id,
        });
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
