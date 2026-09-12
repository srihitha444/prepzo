import type { ContentMap } from "@/lib/ca/extraction";

const DEFAULT_CHAR_BUDGET = 40_000;

interface NoteRow {
  id: string;
  title: string;
  content_map: ContentMap | null;
}

/**
 * Pulls the student's own extracted note content to ground the AI Teacher's
 * answers in, instead of only generic syllabus knowledge. Source is
 * user_notes.content_map.blocks[] (the raw extracted text) rather than the
 * generated questions/flashcards derived from it — the source material is
 * more authoritative for doubt-clearing.
 *
 * With noteId: scoped to that one upload (mirrors the ?note= pattern used
 * by Practice/Flashcards/Mock Test). Without it: pulls across all of the
 * student's notes, most recent first, up to charBudget — CA note volume
 * per student is realistically small, so ~40k chars comfortably fits
 * inside Gemini's context window at negligible extra cost; the cap just
 * guards the tail case of a student with many uploads.
 */
export async function fetchNoteContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  noteId?: string,
  charBudget: number = DEFAULT_CHAR_BUDGET,
  /**
   * Restrict to specific blocks within the note — the topics a student
   * ticked in the generate picker. Undefined means every usable block,
   * which is what AI Teacher always wants (it shouldn't be blinkered to a
   * subset mid-conversation) and what a whole-note cheatsheet wants.
   */
  blockIds?: string[]
): Promise<string | null> {
  let query = supabase
    .from("user_notes")
    .select("id, title, content_map")
    .eq("user_id", userId)
    .not("content_map", "is", null);

  query = noteId ? query.eq("id", noteId) : query.order("created_at", { ascending: false });

  const { data } = await query;
  const notes = (data || []) as NoteRow[];
  if (notes.length === 0) return null;

  let remaining = charBudget;
  const sections: string[] = [];
  const wanted = blockIds && blockIds.length > 0 ? new Set(blockIds) : null;

  outer: for (const note of notes) {
    const blocks = note.content_map?.blocks || [];
    for (const block of blocks) {
      if (block.status === "skipped" || !block.raw_content?.trim()) continue;
      if (wanted && !wanted.has(block.block_id)) continue;

      const header = `[Note: "${note.title}" · Paper: ${block.paper_name || "unspecified"} · Topic: ${block.topic}]`;
      const section = `${header}\n${block.raw_content.trim()}`;

      if (section.length > remaining) {
        if (remaining > 200) sections.push(section.slice(0, remaining));
        break outer;
      }
      sections.push(section);
      remaining -= section.length;
    }
  }

  return sections.length > 0 ? sections.join("\n\n---\n\n") : null;
}
