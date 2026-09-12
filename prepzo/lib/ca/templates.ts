import type { CaLevel, CaPaper } from "@/lib/ca-syllabus";

export type ContentType = "text" | "table" | "formula" | "legal" | "diagram";

export type FormatClass =
  | "foundation-descriptive" // F1, F2 — descriptive only
  | "foundation-mcq" // F3, F4 — MCQ only, negative marking
  | "intermediate-mixed" // I1-I6 — 30% MCQ / 70% descriptive
  | "final-mixed"; // N1-N6 — 30% MCQ / 70% descriptive, higher marks

// Mirrors docs/ca-platform/04_QUESTIONS.md / 05_FLASHCARDS.md, which group
// all 16 CA papers into these 4 rule classes rather than defining each
// paper's template independently. `CaPaper.format` + level is enough to
// derive the class — see lib/ca-syllabus.ts.
export function getFormatClass(paper: CaPaper, level: CaLevel): FormatClass {
  if (level === "Foundation") {
    return paper.format === "objective" ? "foundation-mcq" : "foundation-descriptive";
  }
  return level === "Final" ? "final-mixed" : "intermediate-mixed";
}

/**
 * How a block's requested question count splits across MCQ and descriptive.
 * Only the mixed (Intermediate/Final) classes split at all — Foundation is
 * one or the other by paper, never both.
 */
export function splitQuestionCount(formatClass: FormatClass, count: number): { mcq: number; descriptive: number } {
  if (formatClass === "foundation-mcq") return { mcq: count, descriptive: 0 };
  if (formatClass === "foundation-descriptive") return { mcq: 0, descriptive: count };
  // Intermediate/Final papers are 30% objective / 70% descriptive (see
  // lib/ca-syllabus.ts objectivePercent). Round the MCQ share rather than
  // floor it so a request for 2 still yields one of each instead of two
  // descriptives, but never let either side round away to nothing when the
  // student asked for at least 2.
  const mcq = count <= 1 ? 0 : Math.max(1, Math.round(count * 0.3));
  return { mcq, descriptive: Math.max(0, count - mcq) };
}

/**
 * Question-generation rules for a given format class + content type, as
 * prompt text. Gemini fills content; this string fixes mark values and
 * format requirements.
 *
 * `count` is the number of questions to produce for this block, derived
 * from the student's own requested total (they choose how much to
 * generate, and it's split across the blocks they selected) — it is NOT
 * fixed per content type any more. What stays fixed is everything that
 * makes the output exam-shaped: mark bands, the MCQ/descriptive ratio,
 * ILAC and journal-entry formats, and the shared case-study passage at
 * Inter/Final. Those encode the real ICAI paper; only the quantity was
 * ever meant to be the platform's decision, and now it isn't.
 */
export function buildQuestionRules(
  formatClass: FormatClass,
  contentType: ContentType,
  paper: CaPaper,
  count: number
): string {
  const { mcq, descriptive } = splitQuestionCount(formatClass, count);

  switch (formatClass) {
    case "foundation-descriptive": {
      const noTables = paper.code.startsWith("F2"); // Business Laws: no tables, ever
      const emphasis: Record<ContentType, string> = {
        text: "Favour 2-mark (Define/State/short answer) and 4-mark (Explain with example) questions.",
        table: noTables
          ? "This paper never uses tables — ask about the underlying concept instead, with no table in the question body, at 2 and 4 marks."
          : "Embed the source table (or a re-derived equivalent) in the question body, at 4 and 8 marks (a full financial-statement preparation problem).",
        formula: "Make these numerical, at 4 marks (single-step) and 8 marks (multi-step), all requiring full workings in the model answer.",
        legal: "Spread across 2 marks (define/state the provision), 4 marks (explain with example) and 8 marks (case scenario applying the provision, ILAC format).",
        diagram: "Ask the student to describe what the diagram shows and interpret or apply it, at 4 marks.",
      };
      const formatNote = noTables
        ? "All model answers must follow ILAC format (Issue, Law, Application, Conclusion), always cite the section number and Act name and year."
        : "All model answers must follow ICAI journal-entry format (Dr/Cr, To/By prefixes, double-underlined totals, narration in brackets) and use Indian number format (1,00,000 not 100,000).";
      return `Generate exactly ${descriptive} descriptive questions. ${emphasis[contentType]} Vary the marks across the questions rather than making them all the same weight. ${formatNote} No MCQs under any circumstances.`;
    }

    case "foundation-mcq": {
      const emphasis: Record<ContentType, string> = {
        text: "Test conceptual understanding.",
        table: "Base them on the statistical/tabular data in this block.",
        formula: "Mix direct application (calculate the answer), reverse (find a missing variable) and conceptual (what a variable means) — roughly evenly.",
        legal: "Test conceptual understanding of this provision.",
        diagram: "Interpret the diagram (demand/supply curve, production graph, etc). The question text must describe what the diagram shows — the student should not need to see the original image.",
      };
      return `Generate exactly ${mcq} MCQs. ${emphasis[contentType]} Every MCQ: exactly 4 options (A-D), one correct answer, plausible distractors (common calculation errors, not obviously wrong), negative marking -0.25 for a wrong answer (set negative_marking_value to 0.25), full worked explanation, Indian number format. Across all MCQs from this block aim for a 40% easy / 40% medium / 20% hard difficulty split. No descriptive questions under any circumstances.`;
    }

    case "intermediate-mixed":
    case "final-mixed": {
      const isFinal = formatClass === "final-mixed";
      const descriptiveMarks: Record<ContentType, string> = {
        text: isFinal ? "5 to 8 marks" : "4 to 5 marks",
        table: isFinal ? "8 to 10 marks" : "5 to 8 marks",
        formula: isFinal ? "8 to 10 marks" : "5 to 8 marks",
        legal: isFinal ? "5 to 10 marks" : "4 to 8 marks",
        diagram: isFinal ? "5 to 8 marks" : "4 to 5 marks",
      };
      // The shared passage is what case_study_group_id/case_study_passage
      // exist for (Phase 8) — keep grouping MCQs under one passage rather
      // than emitting standalone MCQs, however many are asked for.
      const mcqScenario =
        mcq === 0
          ? "Generate no MCQs for this block."
          : isFinal
            ? `Generate ${mcq === 1 ? "1 shared case-study passage" : `${Math.max(1, Math.round(mcq / 2))} shared case-study passages`} — each a complex, multi-layered business situation — as case_studies groups, and distribute exactly ${mcq} MCQs across them so that every MCQ tests application of the passage it sits under (never two separate scenarios inside one group).`
            : `Generate ${mcq === 1 ? "1 shared scenario passage" : `${Math.max(1, Math.round(mcq / 2))} shared scenario passages`} — each a short paragraph describing a real business situation — as case_studies groups, and distribute exactly ${mcq} MCQs across them so that every MCQ tests application of the passage it sits under (not one-line recall, never two separate scenarios inside one group). No negative marking.`;
      const higherOrderNote = isFinal
        ? " Legal/standard answers must show awareness of recent amendments or judicial interpretations where relevant."
        : "";
      return (
        `${mcqScenario} ` +
        `Also generate exactly ${descriptive} descriptive questions, each worth ${descriptiveMarks[contentType]} (vary the weights rather than making them identical), each with a full model answer, mark_allocation array, and (for table/formula content) the source data embedded in the question body. ` +
        `Cite AS/Ind AS standard numbers, section numbers and Act names, or SA (Standard on Auditing) references wherever the content involves them.${higherOrderNote} Indian number format throughout, Schedule III format for company accounting statements.`
      );
    }
  }
}

/**
 * Flashcard-generation rules for a given content type, as prompt text.
 * Flashcard types (docs/ca-platform/05_FLASHCARDS.md) don't vary by format
 * class the way questions do — they vary by content type, with an extra
 * Standard flashcard for Inter/Final AS/Ind AS/SA references.
 */
export function buildFlashcardRules(contentType: ContentType, level: CaLevel, count: number): string {
  const standardNote =
    level !== "Foundation"
      ? " If this content references an AS, Ind AS, or SA standard by number, include at least one 'standard' flashcard (front: \"[Standard number]: [name]\", back: scope + key requirement + what it excludes + one memory tip)."
      : "";
  // Which flashcard TYPES to favour for this content — the mix stays
  // prescribed, the quantity comes from the student's request.
  const emphasis: Record<ContentType, string> = {
    text: "Favour 'definition' cards for key terms and concepts, plus 'comparison' cards wherever the text contrasts two concepts.",
    table: "Favour 'accounting_rule' cards explaining the format/rule the table illustrates, and 'definition' cards for the statement type (e.g. \"What is a Trial Balance?\"). Do not reproduce the table itself on a flashcard.",
    formula: "Favour 'formula' cards — the formula, each variable defined, any reverse formulas, and one fully worked example with Indian-format amounts. Cover every distinct formula before repeating a concept.",
    legal: "Favour 'section' cards (front: \"Section [X] — [Act name, year]\"; back: what it says, key condition, exception if any, one-sentence real-world example, and an exam tip), prioritising the most frequently examined sections, plus 'definition' cards for the overall concept.",
    diagram: "Favour 'definition' cards describing in words what the diagram shows and the concept it illustrates. Do not attempt to reproduce the diagram.",
  };
  return `Produce exactly ${count} flashcards. ${emphasis[contentType]}${standardNote} Front side max 15 words and never contains the answer. Back side max 150 words, Indian number format with the ₹ symbol, and ends with a short "Remember:" memory tip where natural.`;
}
