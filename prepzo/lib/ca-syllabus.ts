export type CaLevel = "Foundation" | "Intermediate" | "Final";
export type CaExamFormat = "descriptive" | "objective" | "mixed";

export interface CaPaper {
  code: string;
  name: string;
  format: CaExamFormat;
  objectivePercent: number | null;
  negativeMarking: boolean;
  marks: number;
  isCaseStudy?: boolean;
}

export interface CaGroup {
  name: "Group 1" | "Group 2";
  papers: CaPaper[];
}

export interface CaLevelSyllabus {
  level: CaLevel;
  totalMarks: number;
  groups: CaGroup[] | null;
  papers: CaPaper[];
}

export const CA_SYLLABUS: Record<CaLevel, CaLevelSyllabus> = {
  Foundation: {
    level: "Foundation",
    totalMarks: 400,
    groups: null,
    papers: [
      { code: "F1", name: "Accounting", format: "descriptive", objectivePercent: null, negativeMarking: false, marks: 100 },
      { code: "F2", name: "Business Laws", format: "descriptive", objectivePercent: null, negativeMarking: false, marks: 100 },
      { code: "F3", name: "Quantitative Aptitude", format: "objective", objectivePercent: 100, negativeMarking: true, marks: 100 },
      { code: "F4", name: "Business Economics", format: "objective", objectivePercent: 100, negativeMarking: true, marks: 100 },
    ],
  },
  Intermediate: {
    level: "Intermediate",
    totalMarks: 600,
    groups: [
      {
        name: "Group 1",
        papers: [
          { code: "I1", name: "Advanced Accounting", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
          { code: "I2", name: "Corporate and Other Laws", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
          { code: "I3", name: "Taxation", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
        ],
      },
      {
        name: "Group 2",
        papers: [
          { code: "I4", name: "Cost and Management Accounting", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
          { code: "I5", name: "Auditing and Ethics", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
          { code: "I6", name: "Financial Management and Strategic Management", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
        ],
      },
    ],
    papers: [],
  },
  Final: {
    level: "Final",
    totalMarks: 600,
    groups: [
      {
        name: "Group 1",
        papers: [
          { code: "N1", name: "Financial Reporting", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
          { code: "N2", name: "Advanced Financial Management", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
          { code: "N3", name: "Advanced Auditing, Assurance and Professional Ethics", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
        ],
      },
      {
        name: "Group 2",
        papers: [
          { code: "N4", name: "Direct Tax Laws & International Taxation", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
          { code: "N5", name: "Indirect Tax Laws", format: "mixed", objectivePercent: 30, negativeMarking: false, marks: 100 },
          { code: "N6", name: "Integrated Business Solutions", format: "mixed", objectivePercent: 40, negativeMarking: false, marks: 100, isCaseStudy: true },
        ],
      },
    ],
    papers: [],
  },
};

// Flatten groups into the top-level `papers` array for Intermediate/Final.
for (const level of Object.values(CA_SYLLABUS)) {
  if (level.groups) {
    level.papers = level.groups.flatMap((g) => g.papers);
  }
}

export function getPapersForLevel(level: string, groups?: string[]): CaPaper[] {
  const syllabus = CA_SYLLABUS[level as CaLevel];
  if (!syllabus) return [];
  if (!syllabus.groups) return syllabus.papers;
  if (!groups || groups.length === 0) return [];
  return syllabus.groups
    .filter((g) => groups.includes(g.name))
    .flatMap((g) => g.papers);
}

export function getPaperByCode(code: string): CaPaper | undefined {
  for (const level of Object.values(CA_SYLLABUS)) {
    const found = level.papers.find((p) => p.code === code);
    if (found) return found;
  }
  return undefined;
}

export function formatLabel(paper: CaPaper): string {
  if (paper.isCaseStudy) return "Case Study";
  if (paper.format === "descriptive") return paper.negativeMarking ? "Descriptive" : "Descriptive · No negative marking";
  if (paper.format === "objective") return "Objective (MCQ) · Negative marking";
  return `${100 - (paper.objectivePercent ?? 0)}% Descriptive + ${paper.objectivePercent}% MCQ`;
}
