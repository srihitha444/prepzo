import jsPDF from "jspdf";

// Browser-only (fetch + FileReader) — only ever called from a client
// component's event handler, never at import time.

const PAGE_MARGIN = 48;
const LINE_HEIGHT = 16;
const INDENT_STEP = 14;
const PREPZO_URL = "https://prepzo.study";
const LOGO_SRC = "/prepzo-icon.png";

async function loadImageAsDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// A markdown table's separator row, e.g. "|---|---|" or "| --- | --- |".
function isTableSeparatorRow(line: string): boolean {
  return /^\|?[\s:-]+\|[\s:|-]*\|?$/.test(line) && line.includes("-");
}

function isThematicBreak(trimmed: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed);
}

// Strips inline markdown emphasis so it matches what QuestionText.tsx (the
// preview's real markdown renderer) shows: **bold**/*italic* become plain
// text, not literal asterisks — jsPDF has no rich-text runs here, so styling
// is dropped rather than rendered.
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1");
}

function leadingIndentLevel(rawLine: string): number {
  const spaces = rawLine.match(/^ */)?.[0].length ?? 0;
  return Math.min(Math.floor(spaces / 2), 3);
}

/**
 * Renders a cheatsheet to a downloadable PDF, client-side — no server round
 * trip, and jsPDF's doc.link()/textWithLink() give a direct API for the one
 * interactive element needed (a clickable Prepzo logo/wordmark linking back
 * to prepzo.study), simpler here than pdf-lib's manual annotation-dictionary
 * construction. Content formatting is a small manual line-by-line walk, not
 * a markdown-to-PDF library — headings/bullets/ordered lists/tables/rules
 * get distinct treatment mirroring QuestionText.tsx's ReactMarkdown output,
 * with nesting inferred from leading whitespace since there's no real AST.
 */
export async function exportCheatsheetPdf(title: string, content: string): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  try {
    const logoDataUrl = await loadImageAsDataUrl(LOGO_SRC);
    const logoSize = 28;
    doc.addImage(logoDataUrl, "PNG", PAGE_MARGIN, y, logoSize, logoSize);
    doc.link(PAGE_MARGIN, y, logoSize, logoSize, { url: PREPZO_URL });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 138);
    doc.textWithLink("Prepzo", PAGE_MARGIN + logoSize + 8, y + logoSize / 2 + 4, { url: PREPZO_URL });
    y += logoSize + 24;
  } catch {
    // Logo failed to load (offline, blocked request, etc) — export the
    // content anyway rather than blocking the whole download on a fetch.
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(title, maxWidth) as string[];
  doc.text(titleLines, PAGE_MARGIN, y);
  y += titleLines.length * 22 + 16;

  function ensureSpace(height: number) {
    if (y + height > pageHeight - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  }

  function writeLine(text: string, opts: { bold?: boolean; size?: number; indent?: number } = {}) {
    const { bold = false, size = 11, indent = 0 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(15, 23, 42);
    const wrapped = doc.splitTextToSize(text, maxWidth - indent) as string[];
    for (const line of wrapped) {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, PAGE_MARGIN + indent, y);
      y += LINE_HEIGHT;
    }
  }

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      y += LINE_HEIGHT * 0.5;
      continue;
    }
    if (isTableSeparatorRow(trimmed)) {
      continue;
    }
    if (isThematicBreak(trimmed)) {
      ensureSpace(LINE_HEIGHT);
      y += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
      y += 12;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      ensureSpace(LINE_HEIGHT * 1.5);
      writeLine(stripInlineMarkdown(trimmed.slice(4)), { bold: true, size: 12 });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      ensureSpace(LINE_HEIGHT * 1.8);
      y += 6;
      writeLine(stripInlineMarkdown(trimmed.slice(3)), { bold: true, size: 14 });
      continue;
    }
    if (trimmed.startsWith("# ")) {
      ensureSpace(LINE_HEIGHT * 2);
      y += 8;
      writeLine(stripInlineMarkdown(trimmed.slice(2)), { bold: true, size: 16 });
      continue;
    }
    if (trimmed.startsWith("|")) {
      const cells = trimmed.split("|").map((c) => stripInlineMarkdown(c.trim())).filter(Boolean);
      writeLine(cells.join("   |   "), { indent: 6, size: 10 });
      continue;
    }

    const level = leadingIndentLevel(line);
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

    if (bulletMatch) {
      writeLine(`•  ${stripInlineMarkdown(bulletMatch[1])}`, { indent: INDENT_STEP + level * INDENT_STEP });
      continue;
    }
    if (orderedMatch) {
      writeLine(`${orderedMatch[1]}.  ${stripInlineMarkdown(orderedMatch[2])}`, { indent: INDENT_STEP + level * INDENT_STEP });
      continue;
    }

    const subPartIndent = /^\(?[ivxlc]+\)|^\(?[a-z]\)/i.test(trimmed) ? INDENT_STEP : 0;
    writeLine(stripInlineMarkdown(trimmed), { indent: Math.max(subPartIndent, level * INDENT_STEP) });
  }

  const safeTitle = title.replace(/[^\w\- ]/g, "").trim() || "cheatsheet";
  doc.save(`${safeTitle}.pdf`);
}
