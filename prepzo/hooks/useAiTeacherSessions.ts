"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface TutorSessionSummary {
  id: string;
  noteId: string | null;
  title: string | null;
  currentTopic: string | null;
  messagesCount: number;
  updatedAt: string;
}

interface SessionRow {
  id: string;
  note_id: string | null;
  current_topic: string | null;
  messages_count: number;
  updated_at: string;
}

export function useAiTeacherSessions() {
  const [sessions, setSessions] = useState<TutorSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const { data: sessionRows } = await supabase
      .from("ai_teacher_sessions")
      .select("id, note_id, current_topic, messages_count, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    const rows = (sessionRows || []) as SessionRow[];
    const noteIds = [...new Set(rows.map((r) => r.note_id).filter((id): id is string => Boolean(id)))];

    let titleByNoteId = new Map<string, string>();
    if (noteIds.length > 0) {
      const { data: notes } = await supabase.from("user_notes").select("id, title").in("id", noteIds);
      titleByNoteId = new Map((notes || []).map((n: { id: string; title: string }) => [n.id, n.title]));
    }

    setSessions(
      rows.map((r) => ({
        id: r.id,
        noteId: r.note_id,
        title: r.note_id ? titleByNoteId.get(r.note_id) || null : null,
        currentTopic: r.current_topic,
        messagesCount: r.messages_count,
        updatedAt: r.updated_at,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a memoized async helper; setState happens after an await
    refetch();
  }, [refetch]);

  return { sessions, loading, refetch };
}
