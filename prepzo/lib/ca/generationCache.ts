import type { GenerateMode, GeneratedFlashcardRow, GeneratedQuestionRow } from "@/lib/ca/generateContent";

/**
 * Shared, accumulating pools of generated questions/flashcards, one per
 * (block, mode).
 *
 * The pool only ever grows. If student A generated 10 questions for a block
 * and student B asks for 20, B is served A's 10 and pays for 10 more, which
 * are appended — so the pool now holds 20 and the next student asking for
 * 20 pays nothing, while a later request for 5 is served from the same
 * pool. Whoever pays to deepen the pool deepens it for everyone, including
 * retroactively for students who already generated from it.
 *
 * Rows are never shared directly with a student: the caller COPIES pool
 * items into that student's own questions/flashcards rows, so they own
 * their content and their spaced-repetition progress and the owner-scoped
 * RLS policy keeps working unchanged.
 *
 * Keying on block_id ties a pool to one specific cached content_map. When
 * an extraction entry is refreshed (the rules changed), its blocks get new
 * ids and the old pools simply stop being reachable — no deletion needed.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any;

/** What a pool holds — generation output minus the per-student fields. */
export type PooledQuestion = Omit<GeneratedQuestionRow, "note_id" | "block_id">;
export type PooledFlashcard = Omit<GeneratedFlashcardRow, "note_id" | "block_id">;
export type PooledItem = PooledQuestion | PooledFlashcard;

export interface Pool {
  blockId: string;
  mode: GenerateMode;
  items: PooledItem[];
}

export async function getPools(
  supabase: ServiceClient,
  blockIds: string[],
  mode: GenerateMode
): Promise<Map<string, PooledItem[]>> {
  const pools = new Map<string, PooledItem[]>();
  if (blockIds.length === 0) return pools;

  const { data, error } = await supabase
    .from("ca_generation_cache")
    .select("block_id, items")
    .in("block_id", blockIds)
    .eq("mode", mode);

  if (error) {
    // Degrade to "no cache" rather than failing the student's request —
    // generating fresh is always correct, just more expensive.
    console.error("[generationCache] Could not read pools:", error);
    return pools;
  }

  for (const row of data || []) {
    pools.set(row.block_id, Array.isArray(row.items) ? (row.items as PooledItem[]) : []);
  }
  return pools;
}

/**
 * Appends newly generated items to a block's pool, creating it if absent.
 *
 * Read-modify-write rather than an atomic array append, so two students
 * generating for the same block at the same moment can interleave and one
 * write can overwrite the other's additions. That costs a little duplicated
 * generation work in a rare race and never produces wrong content, which is
 * the right trade here — the alternative is a Postgres function or a lock,
 * for a collision window of a few seconds on the same block of the same
 * document.
 */
export async function appendToPool(
  supabase: ServiceClient,
  params: {
    fileHash: string | null;
    caLevel: string;
    blockId: string;
    mode: GenerateMode;
    newItems: PooledItem[];
  }
): Promise<void> {
  const { fileHash, caLevel, blockId, mode, newItems } = params;
  // No hash means this document can never be matched by another student, so
  // there is nothing to share and no reason to store it centrally. This is
  // also what keeps un-hashable uploads out of the shared table entirely.
  if (!fileHash || newItems.length === 0) return;

  const { data: existing } = await supabase
    .from("ca_generation_cache")
    .select("id, items")
    .eq("block_id", blockId)
    .eq("mode", mode)
    .maybeSingle();

  const merged = [...(Array.isArray(existing?.items) ? (existing.items as PooledItem[]) : []), ...newItems];

  const { error } = await supabase.from("ca_generation_cache").upsert(
    {
      file_hash: fileHash,
      ca_level: caLevel,
      block_id: blockId,
      mode,
      items: merged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "block_id,mode" }
  );

  if (error) console.error("[generationCache] Could not append to pool:", error);
}

/** The item text a top-up run needs, so it doesn't regenerate near-duplicates. */
export function poolItemTexts(items: PooledItem[]): string[] {
  return items.map((item) =>
    "question_text" in item ? String(item.question_text) : `${String(item.front_text)} / ${String(item.back_text)}`
  );
}
