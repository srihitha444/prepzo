import { randomUUID } from "crypto";
import { getContentModel, generateWithRetry } from "@/lib/gemini";
import { getPaperByCode, getPapersForLevel, type CaLevel, type CaPaper } from "@/lib/ca-syllabus";
import type { ContentType } from "@/lib/ca/templates";

export type BlockStatus = "auto" | "needs_confirmation" | "unidentified" | "skipped";

export interface ContentBlock {
  block_id: string;
  content_type: ContentType;
  topic: string;
  raw_content: string;
  paper: string | null;
  paper_name: string | null;
  confidence: number;
  status: BlockStatus;
  student_confirmed: boolean;
}

export interface ContentMap {
  blocks: ContentBlock[];
  papers_detected: string[];
  unidentified_blocks: number;
}

interface StudentProfile {
  ca_level: CaLevel | null;
  ca_groups: string[] | null;
  ca_papers: string[] | null;
}

// Confidence thresholds from docs/ca-platform/03_CONTENT_MAPPING.md.
function statusForConfidence(confidence: number): BlockStatus {
  if (confidence >= 85) return "auto";
  if (confidence >= 40) return "needs_confirmation";
  return "unidentified";
}

function candidatePapers(profile: StudentProfile): CaPaper[] {
  if (profile.ca_papers && profile.ca_papers.length > 0) {
    return profile.ca_papers.map((code) => getPaperByCode(code)).filter((p): p is CaPaper => Boolean(p));
  }
  if (!profile.ca_level) return [];
  return getPapersForLevel(profile.ca_level, profile.ca_groups || []);
}

interface RawBlock {
  content_type?: string;
  topic?: string;
  raw_content?: string;
  paper_code?: string | null;
  confidence?: number;
}

function isContentType(value: unknown): value is ContentType {
  return value === "text" || value === "table" || value === "formula" || value === "legal" || value === "diagram";
}

export async function extractAndMapContent(params: {
  fileBuffer: Buffer;
  mimeType: string;
  profile: StudentProfile;
}): Promise<ContentMap> {
  const { fileBuffer, mimeType, profile } = params;
  const papers = candidatePapers(profile);

  if (papers.length === 0) {
    throw new Error("Student has not selected any CA papers yet — cannot map content.");
  }

  const paperList = papers.map((p) => `${p.code}: ${p.name}`).join("\n");

  const prompt = `You are analysing a CA ${profile.ca_level} student's uploaded study notes.

Extract all content from this document and split it into topic-sized blocks. Each block becomes one study session downstream (flashcards and practice questions are generated per block, one session per block) — so a block must be sized like a realistic 15-20 minute study sitting (roughly enough content to support 6-14 flashcards), never one block per sub-heading. A 150-200 page book should produce roughly 10-15 blocks total; scale proportionally for shorter or longer documents. Splitting on every heading is wrong even if the source document itself has many small sub-headings — group by studyable topic, not by heading.

Grouping rules:
- Merge small related sub-topics (a single definition, a short case-law note, a brief distinction — anything that alone would only support 1-3 flashcards) into their parent/chapter topic's block rather than giving each one its own block.
- Keep dense, high-weightage topics (e.g. free consent, sale-of-goods remedies, partnership relations) as their own focused block even if it runs longer than others — merging those in dilutes recall.
- It's fine for a genuinely small, self-contained topic to stay small if merging it anywhere would be illogical — don't force-pad unrelated content together just to hit a size target.
- Only merge sub-topics that share the same content_type and would map to the same paper. Never combine content spanning two different papers into one block, and never merge a table into prose (or vice versa) just to reach a size target.

For each block:
- Classify content_type as one of: text, table, formula, legal, diagram
- Identify a short topic label (e.g. "Depreciation", "Section 11 - Free Consent")
- Extract the content itself into raw_content (preserve table structure as markdown, preserve exact section numbers and Act names for legal content, preserve formulas as plain text)
- Map the block to the single best-matching paper from this list, using keyword signals (e.g. journal/ledger/depreciation -> Accounting; contract/offer/acceptance -> Business Laws; ratio/probability -> Quantitative Aptitude; demand/supply/GDP -> Economics; AS/Ind AS/Schedule III -> Advanced Accounting; SEBI/FEMA/NCLT -> Corporate Law; income tax/GST -> Taxation; cost sheet/budgeting -> Costing; SA/audit -> Auditing; NPV/IRR/WACC -> Financial Management):
${paperList}
- Give a confidence score 0-100 for the paper mapping. Score below 40 if you cannot confidently identify the paper at all.

Ignore and do not create blocks for: page headers/footers, logos/watermarks, table of contents, index pages, bibliography, blank pages, signature blocks, "intentionally left blank" notices.

Return strict JSON only, matching this shape:
{
  "blocks": [
    {
      "content_type": "text" | "table" | "formula" | "legal" | "diagram",
      "topic": "string",
      "raw_content": "string",
      "paper_code": "one of the codes above, or null if unidentifiable",
      "confidence": 0-100
    }
  ]
}`;

  const model = getContentModel();
  const result = await generateWithRetry(model, [
    { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
    { text: prompt },
  ]);

  const text = result.response.text();
  let parsed: { blocks?: RawBlock[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned non-JSON content during extraction");
  }

  const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const papersDetected = new Set<string>();
  let unidentifiedCount = 0;

  const blocks: ContentBlock[] = rawBlocks
    .filter((b) => typeof b.raw_content === "string" && b.raw_content.trim().length > 0)
    .map((b): ContentBlock => {
      const confidence = typeof b.confidence === "number" ? Math.max(0, Math.min(100, Math.round(b.confidence))) : 0;
      const contentType = isContentType(b.content_type) ? b.content_type : "text";
      const paper = b.paper_code ? getPaperByCode(b.paper_code) : undefined;
      const status = paper ? statusForConfidence(confidence) : "unidentified";

      if (status === "unidentified") unidentifiedCount += 1;
      if (paper && status === "auto") papersDetected.add(paper.code);

      return {
        block_id: randomUUID(),
        content_type: contentType,
        topic: b.topic || "Untitled",
        raw_content: b.raw_content || "",
        paper: paper?.code ?? null,
        paper_name: paper?.name ?? null,
        confidence,
        status,
        student_confirmed: false,
      };
    });

  return {
    blocks,
    papers_detected: Array.from(papersDetected),
    unidentified_blocks: unidentifiedCount,
  };
}
