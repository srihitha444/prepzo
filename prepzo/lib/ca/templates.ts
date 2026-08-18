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
 * Question-generation rules for a given format class + content type, as
 * prompt text. Gemini fills content; this string fixes the structure
 * (question counts, mark values, format requirements) so it has no
 * discretion over how many questions or what type to produce.
 */
export function buildQuestionRules(formatClass: FormatClass, contentType: ContentType, paper: CaPaper): string {
  switch (formatClass) {
    case "foundation-descriptive": {
      const noTables = paper.code.startsWith("F2"); // Business Laws: no tables, ever
      const rules: Record<ContentType, string> = {
        text: "Generate exactly 2 descriptive questions: one worth 2 marks (Define/State/short answer) and one worth 4 marks (Explain with example).",
        table: noTables
          ? "This paper never uses tables — generate 1 question of 2 marks and 1 of 4 marks about the underlying concept instead, with no table in the body."
          : "Generate exactly 2 descriptive questions, both embedding the source table (or a re-derived equivalent) in the question body: one worth 4 marks and one worth 8 marks (a full financial-statement preparation problem).",
        formula: "Generate exactly 2 numerical descriptive questions: one worth 4 marks (single-step) and one worth 8 marks (multi-step), both requiring full workings in the model answer.",
        legal: noTables
          ? "Generate exactly 3 descriptive questions: 2 marks (define/state the provision), 4 marks (explain with example), 8 marks (case scenario applying the provision, ILAC format)."
          : "Generate exactly 1 descriptive question worth 2 marks (define or state the provision).",
        diagram: "Generate 1 descriptive question worth 4 marks describing what the diagram shows and asking the student to interpret or apply it.",
      };
      const formatNote = noTables
        ? "All model answers must follow ILAC format (Issue, Law, Application, Conclusion), always cite the section number and Act name and year."
        : "All model answers must follow ICAI journal-entry format (Dr/Cr, To/By prefixes, double-underlined totals, narration in brackets) and use Indian number format (1,00,000 not 100,000).";
      return `${rules[contentType]} ${formatNote} No MCQs under any circumstances.`;
    }

    case "foundation-mcq": {
      const rules: Record<ContentType, string> = {
        text: "Generate exactly 2 MCQs testing conceptual understanding.",
        table: "Generate exactly 3 MCQs based on the statistical/tabular data in this block.",
        formula: "Generate exactly 3 MCQs: 1 direct application (calculate the answer), 1 reverse (find a missing variable), 1 conceptual (what a variable means).",
        legal: "Generate exactly 2 MCQs testing conceptual understanding of this provision.",
        diagram: "Generate exactly 2 MCQs interpreting the diagram (demand/supply curve, production graph, etc). The question text must describe what the diagram shows — the student should not need to see the original image.",
      };
      return `${rules[contentType]} Every MCQ: exactly 4 options (A-D), one correct answer, plausible distractors (common calculation errors, not obviously wrong), negative marking -0.25 for a wrong answer (set negative_marking_value to 0.25), full worked explanation, Indian number format. Across all MCQs from this block aim for a 40% easy / 40% medium / 20% hard difficulty split. No descriptive questions under any circumstances.`;
    }

    case "intermediate-mixed":
    case "final-mixed": {
      const isFinal = formatClass === "final-mixed";
      const descriptiveMarks: Record<ContentType, string> = {
        text: isFinal ? "5 marks and 8 marks" : "4 marks and 5 marks",
        table: isFinal ? "8 marks and 10 marks" : "5 marks and 8 marks",
        formula: isFinal ? "8 marks and 10 marks" : "5 marks and 8 marks",
        legal: isFinal ? "5 marks and 10 marks" : "4 marks and 8 marks",
        diagram: isFinal ? "5 marks and 8 marks" : "4 marks and 5 marks",
      };
      const mcqScenario = isFinal
        ? "Generate 1 shared case-study passage — a more complex, multi-layered business situation than a typical Inter question — as a case_studies group, then exactly 2 MCQs under it that both test application of that same passage (not two separate scenarios)."
        : "Generate 1 shared scenario passage — a short paragraph describing a real business situation — as a case_studies group, then exactly 2 MCQs under it that both test application of that same passage (not one-line recall, and not two separate scenarios). No negative marking.";
      const higherOrderNote = isFinal
        ? " Legal/standard answers must show awareness of recent amendments or judicial interpretations where relevant."
        : "";
      return (
        `${mcqScenario} ` +
        `Also generate 2 descriptive questions worth ${descriptiveMarks[contentType]} respectively, each with a full model answer, mark_allocation array, and (for table/formula content) the source data embedded in the question body. ` +
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
export function buildFlashcardRules(contentType: ContentType, level: CaLevel): string {
  const standardNote =
    level !== "Foundation"
      ? " If this content references an AS, Ind AS, or SA standard by number, also produce one 'standard' flashcard (front: \"[Standard number]: [name]\", back: scope + key requirement + what it excludes + one memory tip)."
      : "";
  const rules: Record<ContentType, string> = {
    text: "Produce 1 'definition' flashcard per key term or concept, plus 1 'comparison' flashcard if the text contrasts two concepts.",
    table: "Produce 1 'accounting_rule' flashcard explaining the format/rule the table illustrates, and 1 'definition' flashcard for the statement type (e.g. \"What is a Trial Balance?\"). Do not reproduce the table itself on the flashcard.",
    formula: "Produce 1 'formula' flashcard per distinct formula: the formula, each variable defined, any reverse formulas, and one fully worked example with Indian-format amounts.",
    legal: "Produce 1 'section' flashcard per section reference (front: \"Section [X] — [Act name, year]\"; back: what it says, key condition, exception if any, one-sentence real-world example, and an exam tip), plus 1 'definition' flashcard for the overall concept. Cap at 5 section flashcards for this block — prioritise the most frequently examined sections.",
    diagram: "Produce 1 'definition' flashcard describing in words what the diagram shows and the concept it illustrates. Do not attempt to reproduce the diagram.",
  };
  return `${rules[contentType]}${standardNote} Front side max 15 words and never contains the answer. Back side max 150 words, Indian number format with the ₹ symbol, and ends with a short "Remember:" memory tip where natural.`;
}
