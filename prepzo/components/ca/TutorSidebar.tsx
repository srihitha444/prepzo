"use client";

import { MessageCircle, FileText } from "lucide-react";
import type { TutorSessionSummary } from "@/hooks/useAiTeacherSessions";

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

export function TutorSidebar({
  sessions,
  loading,
  activeNoteId,
  onSelect,
}: {
  sessions: TutorSessionSummary[];
  loading: boolean;
  activeNoteId: string | undefined;
  onSelect: (noteId: string | undefined) => void;
}) {
  const noteSessions = sessions.filter((s) => s.noteId);
  const generalSession = sessions.find((s) => !s.noteId);

  return (
    <div className="flex h-[calc(100vh-8rem)] w-64 shrink-0 flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[var(--shadow-card)] md:h-[calc(100vh-6rem)]">
      <div className="border-b border-[#E2E8F0] px-4 py-3">
        <p className="text-xs font-semibold text-[#0F172A]">Your chats</p>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        <button
          onClick={() => onSelect(undefined)}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
            activeNoteId === undefined ? "bg-[#DBEAFE] text-[#1E3A8A]" : "text-[#0F172A] hover:bg-[#F8FAFF]"
          }`}
        >
          <MessageCircle size={14} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate font-semibold">General</span>
        </button>

        {loading ? (
          <p className="px-3 py-2 text-xs text-[#64748B]">Loading chats...</p>
        ) : noteSessions.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[#64748B]">
            Chats you start from a note will show up here, named after that note.
          </p>
        ) : (
          noteSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect(session.noteId!)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                activeNoteId === session.noteId ? "bg-[#DBEAFE] text-[#1E3A8A]" : "text-[#0F172A] hover:bg-[#F8FAFF]"
              }`}
            >
              <FileText size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{session.title || "Untitled note"}</span>
                <span className="block truncate text-[#64748B]">{session.currentTopic || timeAgo(session.updatedAt)}</span>
              </span>
            </button>
          ))
        )}
      </div>

      {generalSession === undefined && (
        <div className="border-t border-[#E2E8F0] px-4 py-2.5">
          <p className="text-[11px] leading-snug text-[#64748B]">Ask anything to start the general chat.</p>
        </div>
      )}
    </div>
  );
}
