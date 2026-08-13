"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CheatsheetSummary {
  id: string;
  noteId: string;
  title: string;
  updatedAt: string;
}

interface CheatsheetRow {
  id: string;
  note_id: string;
  updated_at: string;
}

// Only notes that already have a generated cheatsheet show up here — same
// precedent as CaFlashcardsPanel's deck list, which only lists notes with
// generated flashcards. Generation itself happens from NotesPanel.tsx.
export function useCaCheatsheets() {
  const [cheatsheets, setCheatsheets] = useState<CheatsheetSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCheatsheets([]);
      setLoading(false);
      return;
    }

    const { data: rows } = await supabase
      .from("ca_cheatsheets")
      .select("id, note_id, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    const cheatsheetRows = (rows || []) as CheatsheetRow[];
    const noteIds = cheatsheetRows.map((r) => r.note_id);

    let titleByNoteId = new Map<string, string>();
    if (noteIds.length > 0) {
      const { data: notes } = await supabase.from("user_notes").select("id, title").in("id", noteIds);
      titleByNoteId = new Map((notes || []).map((n: { id: string; title: string }) => [n.id, n.title]));
    }

    setCheatsheets(
      cheatsheetRows.map((r) => ({
        id: r.id,
        noteId: r.note_id,
        title: titleByNoteId.get(r.note_id) || "Untitled upload",
        updatedAt: r.updated_at,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a memoized async helper; setState happens after an await
    refetch();
  }, [refetch]);

  return { cheatsheets, loading, refetch };
}
