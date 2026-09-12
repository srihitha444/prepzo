"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import type { ContentBlock } from "@/lib/ca/extraction";

/**
 * Topic-and-quantity picker shown before generating anything from a note.
 *
 * Extraction is deliberately decoupled from generation (see §2.8 of
 * docs/ca-platform/BUILD_STATUS.md — uploading only extracts). This is the
 * step in between: the student sees the topics that were found, ticks the
 * ones they want, says how many items to produce, and only then is Gemini
 * called — for exactly what they asked for, not for the whole document.
 */
export type GenerateSelectorMode = "questions" | "flashcards" | "cheatsheet";

const MODE_LABEL: Record<GenerateSelectorMode, string> = {
  questions: "questions",
  flashcards: "flashcards",
  cheatsheet: "a cheatsheet",
};

export function GenerateSelector({
  blocks,
  mode,
  onGenerate,
  onClose,
}: {
  blocks: ContentBlock[];
  mode: GenerateSelectorMode;
  onGenerate: (blockIds: string[], count: number) => Promise<{ count: number; from_cache?: number }>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(blocks.map((b) => b.block_id)));
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);

  const label = MODE_LABEL[mode];
  // A cheatsheet is one document, not N items — asking "how many?" would be
  // meaningless, so the quantity control is questions/flashcards only.
  const hasQuantity = mode !== "cheatsheet";
  const allSelected = selected.size === blocks.length;

  function toggle(blockId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  async function handleGenerate() {
    if (selected.size === 0) {
      toast.error("Pick at least one topic first.");
      return;
    }
    setBusy(true);
    try {
      const result = await onGenerate(Array.from(selected), count);
      if (hasQuantity && result.count === 0) {
        toast("Nothing new to generate for those topics.");
      } else {
        toast.success(hasQuantity ? `Generated ${result.count} ${label}!` : "Cheatsheet created!");
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFF] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">
            Found {blocks.length} topic{blocks.length === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">Choose what to turn into {label}.</p>
        </div>
        <button
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="shrink-0 rounded-lg p-1 text-[#64748B] hover:bg-white hover:text-[#0F172A] disabled:opacity-50"
        >
          <X size={16} />
        </button>
      </div>

      <button
        onClick={() => setSelected(allSelected ? new Set() : new Set(blocks.map((b) => b.block_id)))}
        disabled={busy}
        className="mt-3 text-xs font-semibold text-[#1E3A8A] hover:underline disabled:opacity-50"
      >
        {allSelected ? "Clear all" : "Select all"}
      </button>

      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
        {blocks.map((block) => (
          <label
            key={block.block_id}
            className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-3 py-2 hover:bg-[#EFF6FF]"
          >
            <input
              type="checkbox"
              checked={selected.has(block.block_id)}
              onChange={() => toggle(block.block_id)}
              disabled={busy}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#1E3A8A]"
            />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-[#0F172A]">{block.topic}</span>
              <span className="block truncate text-[11px] text-[#64748B]">{block.paper_name || "Unassigned"}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] pt-3">
        {hasQuantity && (
          <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
            How many {label}?
            <input
              type="number"
              min={1}
              max={60}
              value={count}
              disabled={busy}
              onChange={(e) => setCount(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
            />
          </label>
        )}
        <span className="text-xs text-[#64748B]">
          {hasQuantity ? "across" : "from"} {selected.size} topic{selected.size === 1 ? "" : "s"}
        </span>
        <button
          onClick={handleGenerate}
          disabled={busy || selected.size === 0}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:bg-[#162D6B] disabled:opacity-50"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? "Generating..." : hasQuantity ? `Generate ${label}` : "Create cheatsheet"}
        </button>
      </div>
    </div>
  );
}
