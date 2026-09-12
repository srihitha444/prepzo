import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import {
  DEFAULT_ITEMS_PER_BLOCK,
  generateForBlocks,
  splitCountAcrossBlocks,
  type GenerateMode,
} from "@/lib/ca/generateContent";
import { appendToPool, getPools, poolItemTexts, type PooledItem } from "@/lib/ca/generationCache";
import { isRetryableGeminiError } from "@/lib/gemini";
import type { CaLevel } from "@/lib/ca-syllabus";
import type { ContentBlock, ContentMap } from "@/lib/ca/extraction";

export const maxDuration = 60;

// Guard rails on the student-chosen total. The floor keeps a stray 0 from
// silently producing nothing; the ceiling is about the single Gemini call
// this route makes — asking for hundreds of items in one request would
// blow the response budget rather than fail cleanly.
const MIN_TOTAL = 1;
const MAX_TOTAL = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { note_id?: string; mode?: GenerateMode; block_ids?: string[]; count?: number } = await request.json();
    const { note_id, mode } = body;

    if (!note_id || (mode !== "questions" && mode !== "flashcards")) {
      return NextResponse.json({ error: "note_id and a valid mode are required" }, { status: 400 });
    }

    const service = await createServiceClient();

    const { data: note, error: noteError } = await service
      .from("user_notes")
      .select("id, user_id, processed, content_map, file_hash")
      .eq("id", note_id)
      .single();
    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    if (note.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!note.processed) {
      return NextResponse.json({ error: "This note hasn't finished processing yet" }, { status: 400 });
    }

    const { data: profile } = await service.from("profiles").select("ca_level").eq("id", user.id).single();
    if (!profile?.ca_level) {
      return NextResponse.json({ error: "CA onboarding not completed" }, { status: 400 });
    }
    const caLevel = profile.ca_level as CaLevel;

    const contentMap = note.content_map as ContentMap | null;
    const autoBlocks = (contentMap?.blocks || []).filter((b) => b.status === "auto");
    if (autoBlocks.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // The student picks which topics to generate from. Absent a selection,
    // fall back to every auto block (the old whole-note behaviour).
    const selectedIds = Array.isArray(body.block_ids) ? new Set(body.block_ids) : null;
    const blocks = selectedIds ? autoBlocks.filter((b) => selectedIds.has(b.block_id)) : autoBlocks;
    if (blocks.length === 0) {
      return NextResponse.json({ error: "None of the selected topics are available to generate from" }, { status: 400 });
    }

    // The student also picks how many. Default keeps pre-selection callers
    // working: roughly what the old fixed per-block rules produced.
    const requestedTotal =
      typeof body.count === "number" && Number.isFinite(body.count)
        ? Math.min(MAX_TOTAL, Math.max(MIN_TOTAL, Math.floor(body.count)))
        : blocks.length * DEFAULT_ITEMS_PER_BLOCK;

    const table = mode === "questions" ? "questions" : "flashcards";

    // How much this student already holds per block. Pools are append-only,
    // so their existing rows correspond to the front of each pool — taking
    // from that offset onward is what stops a repeat request handing them
    // back items they already have.
    const { data: existingRows } = await service
      .from(table)
      .select("block_id")
      .eq("note_id", note_id)
      .in(
        "block_id",
        blocks.map((b) => b.block_id)
      );
    const heldByBlock = new Map<string, number>();
    for (const row of existingRows || []) {
      heldByBlock.set(row.block_id, (heldByBlock.get(row.block_id) || 0) + 1);
    }

    const wantByBlock = splitCountAcrossBlocks(blocks, requestedTotal);
    const pools = await getPools(
      service,
      blocks.map((b) => b.block_id),
      mode
    );

    // Phase 1 — serve whatever the shared pool can already cover.
    const fromPool: { block: ContentBlock; items: PooledItem[] }[] = [];
    const shortfallByBlock: Record<string, number> = {};
    const existingTextsByBlock: Record<string, string[]> = {};

    for (const block of blocks) {
      const want = wantByBlock[block.block_id] || 0;
      if (want <= 0) continue;

      const pool = pools.get(block.block_id) || [];
      const held = heldByBlock.get(block.block_id) || 0;
      const available = pool.slice(held, held + want);

      if (available.length > 0) fromPool.push({ block, items: available });
      const shortfall = want - available.length;
      if (shortfall > 0) {
        shortfallByBlock[block.block_id] = shortfall;
        // Everything already in the pool, so the top-up generates genuinely
        // new items rather than rediscovering the same handful.
        if (pool.length > 0) existingTextsByBlock[block.block_id] = poolItemTexts(pool);
      }
    }

    // Phase 2 — generate only the shortfall.
    const blocksNeedingWork = blocks.filter((b) => (shortfallByBlock[b.block_id] || 0) > 0);
    let generatedQuestions: Awaited<ReturnType<typeof generateForBlocks>>["questions"] = [];
    let generatedFlashcards: Awaited<ReturnType<typeof generateForBlocks>>["flashcards"] = [];

    if (blocksNeedingWork.length > 0) {
      const result = await generateForBlocks({
        noteId: note_id,
        level: caLevel,
        blocks: blocksNeedingWork,
        mode,
        countByBlock: shortfallByBlock,
        existingByBlock: existingTextsByBlock,
      });
      generatedQuestions = result.questions;
      generatedFlashcards = result.flashcards;
    }

    // Phase 3 — everything newly generated joins the shared pool, so the
    // next student asking for this much pays nothing.
    const newlyGenerated: { blockId: string; items: PooledItem[] }[] = [];
    const groupBy = (rows: { block_id: string }[]) => {
      const map = new Map<string, PooledItem[]>();
      for (const row of rows) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { note_id: _noteId, block_id: blockId, ...pooled } = row as Record<string, unknown> & {
          note_id: string;
          block_id: string;
        };
        map.set(blockId, [...(map.get(blockId) || []), pooled as PooledItem]);
      }
      return map;
    };
    const pooledNew = groupBy(mode === "questions" ? generatedQuestions : generatedFlashcards);
    for (const [blockId, items] of pooledNew) newlyGenerated.push({ blockId, items });

    await Promise.all(
      newlyGenerated.map(({ blockId, items }) =>
        appendToPool(service, { fileHash: note.file_hash, caLevel, blockId, mode, newItems: items })
      )
    );

    // Phase 4 — insert this student's own rows: pool items rehydrated with
    // their note/block, plus whatever was generated fresh. Copies, not
    // shared rows, so ownership and spaced-repetition progress stay theirs.
    const rehydrated = fromPool.flatMap(({ block, items }) =>
      items.map((item) => ({ ...item, note_id, block_id: block.block_id }))
    );

    let count = 0;
    if (mode === "questions") {
      const rows = [...rehydrated, ...generatedQuestions];
      if (rows.length > 0) {
        const { error } = await service
          .from("questions")
          .insert(rows.map((q) => ({ ...q, exam: "CA", is_active: true, is_pyq: false })));
        if (error) throw new Error(`Failed to save generated questions: ${error.message}`);
        count = rows.length;
      }
    } else {
      const rows = [...rehydrated, ...generatedFlashcards];
      if (rows.length > 0) {
        const { error } = await service
          .from("flashcards")
          .insert(rows.map((f) => ({ ...f, exam: "CA", is_active: true })));
        if (error) throw new Error(`Failed to save generated flashcards: ${error.message}`);
        count = rows.length;
      }
    }

    return NextResponse.json({
      success: true,
      count,
      from_cache: rehydrated.length,
      newly_generated: count - rehydrated.length,
    });
  } catch (error) {
    console.error("CA notes generate error:", error);
    if (isRetryableGeminiError(error)) {
      return NextResponse.json(
        { error: "Generation is experiencing high demand right now. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}
