"use client";

import { NotebookPen } from "lucide-react";
import type { CheatsheetSummary } from "@/hooks/useCaCheatsheets";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function CheatsheetSidebar({
  cheatsheets,
  loading,
  activeNoteId,
  onSelect,
}: {
  cheatsheets: CheatsheetSummary[];
  loading: boolean;
  activeNoteId: string | undefined;
  onSelect: (noteId: string) => void;
}) {
  return (
    <div className="flex h-[calc(100vh-8rem)] w-64 shrink-0 flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[var(--shadow-card)] md:h-[calc(100vh-6rem)]">
      <div className="border-b border-[#E2E8F0] px-4 py-3">
        <p className="text-xs font-semibold text-[#0F172A]">Your cheatsheets</p>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {loading ? (
          <p className="px-3 py-2 text-xs text-[#64748B]">Loading...</p>
        ) : cheatsheets.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[#64748B]">
            No cheatsheets yet — go to Upload and click &quot;Create Cheatsheet&quot; on a note.
          </p>
        ) : (
          cheatsheets.map((sheet) => (
            <button
              key={sheet.id}
              onClick={() => onSelect(sheet.noteId)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                activeNoteId === sheet.noteId ? "bg-[#DBEAFE] text-[#1E3A8A]" : "text-[#0F172A] hover:bg-[#F8FAFF]"
              }`}
            >
              <NotebookPen size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{sheet.title}</span>
                <span className="block truncate text-[#64748B]">{timeAgo(sheet.updatedAt)}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
