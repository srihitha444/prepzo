import { getContentModel, generateWithRetry } from "@/lib/gemini";
import type { Question } from "@/lib/supabase/types";

export interface AnswerEvaluation {
  marks_awarded: number;
  marks_total: number;
  percentage: number;
  what_was_correct: string[];
  what_was_missed: string[];
  presentation_feedback: string;
  improvement_tips: string[];
  encouragement: string;
}

interface RawEvaluation {
  marks_awarded?: number;
  marks_total?: number;
  percentage?: number;
  what_was_correct?: string[];
  what_was_missed?: string[];
  presentation_feedback?: string;
  improvement_tips?: string[];
  encouragement?: string;
}

// Prompt template from docs/ca-platform/06_ANSWER_EVALUATION.md.
function buildPrompt(question: Question, studentAnswer: string): string {
  const markAllocation = question.mark_allocation
    ? JSON.stringify(question.mark_allocation)
    : "(none provided — allocate the question's total marks across the key points a correct answer should cover, using your own judgement.)";

  return `You are evaluating a CA student's answer to the following question.

QUESTION (${question.marks ?? "?"} marks):
${question.question_text}

MODEL ANSWER:
${question.model_answer || "(none provided — this question came from a real exam paper with no printed solution. Grade it yourself using your own CA syllabus knowledge of the correct answer, applying the same rigour ICAI would.)"}

MARK ALLOCATION:
${markAllocation}

STUDENT'S ANSWER:
${studentAnswer}

Evaluate the student's answer by:
1. Awarding marks for each correct point from the mark allocation
2. Identifying what the student correctly included
3. Identifying what was missed or incorrect
4. Noting any presentation issues (ICAI format problems)
5. Giving improvement suggestions

RULES:
- Be fair — if the student expressed the correct idea in different words, award the mark
- Be strict — vague or incomplete points do not earn full marks
- For accounting questions: check numbers are correct AND format is correct
- For law questions: check section references are correct
- For numerical questions: check working AND final answer
- Never give marks the student did not earn
- Tone: encouraging, constructive, never harsh

Return strict JSON only, matching this shape:
{
  "marks_awarded": number,
  "marks_total": number,
  "percentage": number,
  "what_was_correct": ["point 1", "point 2"],
  "what_was_missed": ["missed point 1 (worth N marks)"],
  "presentation_feedback": "string",
  "improvement_tips": ["tip 1", "tip 2"],
  "encouragement": "string"
}`;
}

function clampPercentage(marksAwarded: number, marksTotal: number, given?: number): number {
  if (typeof given === "number" && given >= 0 && given <= 100) return Math.round(given);
  if (marksTotal <= 0) return 0;
  return Math.round((marksAwarded / marksTotal) * 100);
}

export async function evaluateDescriptiveAnswer(question: Question, studentAnswer: string): Promise<AnswerEvaluation> {
  const model = getContentModel();
  const result = await generateWithRetry(model, buildPrompt(question, studentAnswer));
  const text = result.response.text();

  let parsed: RawEvaluation;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned non-JSON content during answer evaluation");
  }

  const marksTotal = parsed.marks_total ?? question.marks ?? 0;
  const marksAwarded = Math.max(0, Math.min(marksTotal, Math.round(parsed.marks_awarded ?? 0)));

  return {
    marks_awarded: marksAwarded,
    marks_total: marksTotal,
    percentage: clampPercentage(marksAwarded, marksTotal, parsed.percentage),
    what_was_correct: parsed.what_was_correct ?? [],
    what_was_missed: parsed.what_was_missed ?? [],
    presentation_feedback: parsed.presentation_feedback ?? "",
    improvement_tips: parsed.improvement_tips ?? [],
    encouragement: parsed.encouragement ?? "",
  };
}
