import { getChatModel, generateWithRetry } from "@/lib/gemini";
import { fetchNoteContext } from "@/lib/ca/tutorContext";

/**
 * Produces a condensed, editable study cheatsheet from a single note's
 * extracted content — key definitions, formulas, section/standard
 * references, must-remember points. Reuses fetchNoteContext (the same
 * source AI Teacher grounds its answers in) scoped to one note, rather than
 * re-deriving block text itself.
 */
export async function generateCheatsheet(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  noteId: string;
  noteTitle: string;
  /**
   * The topics the student ticked. Omitted = the whole note, which is how
   * this behaved before the picker existed and remains the default for any
   * caller that doesn't care.
   */
  blockIds?: string[];
}): Promise<string> {
  const { supabase, userId, noteId, noteTitle, blockIds } = params;

  const noteContent = await fetchNoteContext(supabase, userId, noteId, undefined, blockIds);
  if (!noteContent) {
    throw new Error(
      blockIds && blockIds.length > 0
        ? "The selected topics have no extracted content to build a cheatsheet from"
        : "This note has no extracted content to build a cheatsheet from"
    );
  }

  const prompt = `You are creating a condensed study cheatsheet for a CA (Chartered Accountancy) student from their own uploaded note, "${noteTitle}".

SOURCE CONTENT:
${noteContent}

Produce a concise, well-organized markdown cheatsheet covering, wherever the source content includes them:
- Key definitions
- Formulas
- Section/standard/act references (exact numbers, never invented) — including specific tax section codes (e.g. Income Tax Act, GST/CGST/SGST Act, Companies Act sections) where the source is a tax or law topic
- Monetary and numeric thresholds/limits — exemption limits, turnover/registration thresholds, deduction caps, rate slabs, due dates, penalty amounts — exact figures as printed, never invented or rounded
- Must-remember points and distinctions

Rules:
- Organize under headings matching the source's own topics — use markdown headings (## Topic name), not the note's original prose structure.
- Any tabular content (comparisons, rate tables, etc.) must be a proper markdown table — a header row, a \`|---|---|\` separator row, then one data row per line. Never flatten a table into a single run-on line of text separated by "|".
- If a point has multiple lettered/numbered sub-parts — (i)/(ii)/(iii), (a)/(b)/(c) — put each on its own line (a markdown list), never run together in one paragraph.
- Condensed, not comprehensive — this is a quick-reference sheet for revision, not a rewrite of the note. Favor short bullet points over full sentences.
- Indian number format (1,00,000 not 100,000) with ₹ symbol for amounts.
- Do not invent section numbers, standard numbers, or facts not present in the source content.

Return ONLY the markdown cheatsheet content — no preamble, no "Here is your cheatsheet" framing, no code fences around it.`;

  const model = getChatModel();
  const result = await generateWithRetry(model, prompt);
  const content = result.response.text().trim();

  if (!content) {
    throw new Error("Gemini returned an empty cheatsheet");
  }

  return content;
}
