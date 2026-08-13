"use client";

import { useState } from "react";
import { TutorSidebar } from "@/components/ca/TutorSidebar";
import { TutorChat } from "@/components/ca/TutorChat";
import { useAiTeacherSessions } from "@/hooks/useAiTeacherSessions";

export function TutorWorkspace({
  caLevel,
  currentTopic,
  recentAccuracy,
  initialNoteId,
  initialNoteTitle,
}: {
  caLevel: string | null;
  currentTopic: string | null;
  recentAccuracy: number | null;
  initialNoteId?: string;
  initialNoteTitle?: string | null;
}) {
  const { sessions, loading, refetch } = useAiTeacherSessions();
  const [activeNoteId, setActiveNoteId] = useState<string | undefined>(initialNoteId);

  const activeSession = sessions.find((s) => (s.noteId || undefined) === activeNoteId);
  const activeNoteTitle = activeNoteId
    ? activeSession?.title ?? (activeNoteId === initialNoteId ? initialNoteTitle : null)
    : null;

  return (
    <div className="flex gap-4">
      <TutorSidebar sessions={sessions} loading={loading} activeNoteId={activeNoteId} onSelect={setActiveNoteId} />
      <div className="min-w-0 flex-1">
        <TutorChat
          key={activeNoteId ?? "general"}
          caLevel={caLevel}
          currentTopic={currentTopic}
          recentAccuracy={recentAccuracy}
          noteId={activeNoteId}
          noteTitle={activeNoteTitle}
          initialSessionId={activeSession?.id}
          onSessionCreated={refetch}
        />
      </div>
    </div>
  );
}
