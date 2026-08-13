"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, ChevronDown, ChevronUp, PenSquare, Layers, MessageCircle, Loader2, RefreshCw, NotebookPen } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { NotesUploadZone } from "@/components/ca/NotesUploadZone";
import { useCaNotes, type NoteStatus } from "@/hooks/useCaNotes";
import type { ContentBlock } from "@/lib/ca/extraction";
import type { CaPaper } from "@/lib/ca-syllabus";

const STATUS_LABEL: Record<NoteStatus, string> = {
  pending: "Queued",
  processing: "Processing",
  completed: "Ready",
  failed: "Failed",
};
const STATUS_VARIANT: Record<NoteStatus, "success" | "warning" | "muted" | "error"> = {
  pending: "muted",
  processing: "warning",
  completed: "success",
  failed: "error",
};

function BlockConfirmRow({
  block,
  papers,
  onConfirm,
  onSkip,
}: {
  block: ContentBlock;
  papers: CaPaper[];
  onConfirm: (paperCode: string) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [selected, setSelected] = useState(block.paper || papers[0]?.code || "");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3">
      <p className="text-xs font-semibold text-[#0F172A]">{block.topic}</p>
      <p className="mt-1 line-clamp-2 text-xs text-[#64748B]">{block.raw_content}</p>
      <div className="mt-2 flex items-center gap-2">
        <select
          value={selected}
          disabled={busy}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A]"
        >
          {papers.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !selected}
          onClick={() => run(() => onConfirm(selected))}
          className="shrink-0 rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          disabled={busy}
          onClick={() => run(onSkip)}
          className="shrink-0 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#64748B] transition-opacity disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function GenerateOrLinkAction({
  count,
  href,
  generateLabel,
  linkLabel,
  icon: Icon,
  needsReviewCount,
  onGenerate,
}: {
  count: number;
  href: string;
  generateLabel: string;
  linkLabel: string;
  icon: React.ComponentType<{ size?: number }>;
  needsReviewCount: number;
  onGenerate: () => Promise<{ count: number }>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const result = await onGenerate();
      if (result.count === 0) {
        toast(
          needsReviewCount > 0
            ? "Nothing new confirmed yet — review the blocks below first."
            : count > 0
              ? "Nothing new to generate — everything confirmed so far is already included."
              : "Couldn't find any content to generate from for this note."
        );
      } else {
        toast.success(`Generated ${result.count} ${count > 0 ? "more " : ""}item${result.count === 1 ? "" : "s"}!`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  if (count > 0) {
    // Confirming a block that was still "needs your confirmation" at the
    // time of the first generate click otherwise has no way to ever be
    // generated — this keeps that path open instead of the link becoming
    // the only, permanent option once count > 0.
    return (
      <div className="flex flex-1 items-center gap-1.5">
        <Link
          href={href}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#1E3A8A] hover:border-[#3B5FBF]"
        >
          <Icon size={13} /> {linkLabel}
        </Link>
        <button
          disabled={busy}
          onClick={handleClick}
          title="Generate more from any newly confirmed blocks"
          className="shrink-0 rounded-lg border border-[#E2E8F0] p-2 text-[#1E3A8A] transition-opacity hover:border-[#3B5FBF] disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>
    );
  }

  return (
    <button
      disabled={busy}
      onClick={handleClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#1E3A8A] transition-opacity hover:border-[#3B5FBF] disabled:opacity-50"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      {busy ? "Generating..." : generateLabel}
    </button>
  );
}

function CheatsheetAction({
  hasCheatsheet,
  href,
  onGenerate,
}: {
  hasCheatsheet: boolean;
  href: string;
  onGenerate: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  if (hasCheatsheet) {
    return (
      <Link
        href={href}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#1E3A8A] hover:border-[#3B5FBF]"
      >
        <NotebookPen size={13} /> View Cheatsheet
      </Link>
    );
  }

  async function handleClick() {
    setBusy(true);
    try {
      await onGenerate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create cheatsheet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      disabled={busy}
      onClick={handleClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#1E3A8A] transition-opacity hover:border-[#3B5FBF] disabled:opacity-50"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <NotebookPen size={13} />}
      {busy ? "Creating..." : "Create Cheatsheet"}
    </button>
  );
}

export function NotesPanel({ papers }: { papers: CaPaper[] }) {
  const { notes, loading, uploadNote, confirmBlock, generateContent, generateCheatsheet } = useCaNotes();
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  return (
    <>
      <div className="mt-6">
        <NotesUploadZone
          onUpload={async (file) => {
            await uploadNote(file);
          }}
        />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-[#0F172A]">Your notes</h2>

      {loading ? (
        <p className="text-sm text-[#64748B]">Loading...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-[#64748B]">No notes uploaded yet — drop one above to get started.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const blocks = note.content_map?.blocks || [];
            const needsReview = blocks.filter((b) => b.status === "needs_confirmation");
            const detectedCount = blocks.filter((b) => b.status !== "skipped").length;
            const isExpanded = expandedNoteId === note.id;
            const hasGeneratedContent = note.questions_count > 0 || note.flashcards_count > 0;

            return (
              <Card key={note.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1E3A8A]">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">{note.title}</p>
                    <p className="truncate text-xs text-[#64748B]">
                      {note.status === "completed"
                        ? hasGeneratedContent
                          ? `${note.questions_count} questions · ${note.flashcards_count} flashcards`
                          : `${detectedCount} block${detectedCount === 1 ? "" : "s"} detected — choose what to generate below`
                        : note.status === "failed"
                          ? note.processing_error || "Something went wrong"
                          : `${note.page_count} page${note.page_count === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[note.status]}>{STATUS_LABEL[note.status]}</Badge>
                </div>

                {note.status === "completed" && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#E2E8F0] pt-3">
                    <GenerateOrLinkAction
                      count={note.questions_count}
                      href={`/practice?note=${note.id}`}
                      generateLabel="Create Practice Session"
                      linkLabel="Practice questions"
                      icon={PenSquare}
                      needsReviewCount={needsReview.length}
                      onGenerate={() => generateContent(note.id, "questions")}
                    />
                    <GenerateOrLinkAction
                      count={note.flashcards_count}
                      href={`/flashcards?note=${note.id}`}
                      generateLabel="Generate Flashcards"
                      linkLabel="Study flashcards"
                      icon={Layers}
                      needsReviewCount={needsReview.length}
                      onGenerate={() => generateContent(note.id, "flashcards")}
                    />
                    <Link
                      href={`/tutor?note=${note.id}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#1E3A8A] hover:border-[#3B5FBF]"
                    >
                      <MessageCircle size={13} /> Ask AI Teacher
                    </Link>
                    <CheatsheetAction
                      hasCheatsheet={note.has_cheatsheet}
                      href={`/cheatsheet?note=${note.id}`}
                      onGenerate={() => generateCheatsheet(note.id)}
                    />
                  </div>
                )}

                {needsReview.length > 0 && (
                  <div className="mt-3 border-t border-[#E2E8F0] pt-3">
                    <button
                      onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#1E3A8A]"
                    >
                      {needsReview.length} block{needsReview.length === 1 ? "" : "s"} need your confirmation
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        {needsReview.map((block) => (
                          <BlockConfirmRow
                            key={block.block_id}
                            block={block}
                            papers={papers}
                            onConfirm={(paperCode) => confirmBlock(note.id, block.block_id, "confirm", paperCode)}
                            onSkip={() => confirmBlock(note.id, block.block_id, "skip")}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
