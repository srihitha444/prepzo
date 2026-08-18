"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeParseJson, uploadFileToStorage } from "@/lib/ca/clientUpload";
import type { ContentMap } from "@/lib/ca/extraction";

export type NoteStatus = "pending" | "processing" | "completed" | "failed";

export interface CaNote {
  id: string;
  title: string;
  file_type: "pdf" | "image";
  page_count: number;
  processed: boolean;
  processing_error: string | null;
  content_map: ContentMap | null;
  created_at: string;
  status: NoteStatus;
  questions_count: number;
  flashcards_count: number;
  has_cheatsheet: boolean;
}

const POLL_MS = 4000;

export function useCaNotes() {
  const [notes, setNotes] = useState<CaNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNotes([]);
      setLoading(false);
      return;
    }

    const { data: notesRaw } = await supabase
      .from("user_notes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const notesList = notesRaw || [];
    const noteIds = notesList.map((n) => n.id);

    if (noteIds.length === 0) {
      setNotes([]);
      setLoading(false);
      return;
    }

    const [{ data: queueRaw }, { data: questionRows }, { data: flashcardRows }, { data: cheatsheetRows }] = await Promise.all([
      supabase.from("processing_queue").select("note_id, status").in("note_id", noteIds),
      supabase.from("questions").select("note_id").eq("exam", "CA").in("note_id", noteIds),
      supabase.from("flashcards").select("note_id").eq("exam", "CA").in("note_id", noteIds),
      supabase.from("ca_cheatsheets").select("note_id").in("note_id", noteIds),
    ]);

    const statusByNote = new Map<string, NoteStatus>((queueRaw || []).map((q) => [q.note_id, q.status as NoteStatus]));
    const countBy = (rows: { note_id: string }[] | null) => {
      const map = new Map<string, number>();
      for (const row of rows || []) map.set(row.note_id, (map.get(row.note_id) || 0) + 1);
      return map;
    };
    const questionCounts = countBy(questionRows);
    const flashcardCounts = countBy(flashcardRows);
    const cheatsheetNoteIds = new Set((cheatsheetRows || []).map((r) => r.note_id));

    setNotes(
      notesList.map((n) => ({
        ...n,
        status: statusByNote.get(n.id) || (n.processed ? "completed" : "pending"),
        questions_count: questionCounts.get(n.id) || 0,
        flashcards_count: flashcardCounts.get(n.id) || 0,
        has_cheatsheet: cheatsheetNoteIds.has(n.id),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // Mount-time fetch via a memoized async helper (same pattern used
    // elsewhere in the app, e.g. app/(app)/flashcards/page.tsx) — the
    // resulting setState calls happen after an await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    const hasActiveWork = notes.some((n) => n.status === "pending" || n.status === "processing");
    if (!hasActiveWork) return;
    const interval = setInterval(fetchNotes, POLL_MS);
    return () => clearInterval(interval);
  }, [notes, fetchNotes]);

  async function uploadNote(file: File, title?: string): Promise<{ note_id: string }> {
    const { filePath, mimeType, pageCount } = await uploadFileToStorage({ file, bucket: "ca-notes" });

    const res = await fetch("/api/ca/notes/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: filePath, mime_type: mimeType, page_count: pageCount, title }),
    });
    const json = await safeParseJson(res);
    if (!res.ok) throw new Error(json.error || "Upload failed");
    await fetchNotes();
    return json as { note_id: string };
  }

  async function confirmBlock(
    noteId: string,
    blockId: string,
    action: "confirm" | "skip",
    confirmedPaper?: string
  ): Promise<void> {
    const res = await fetch("/api/ca/notes/confirm-mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: noteId, block_id: blockId, action, confirmed_paper: confirmedPaper }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to update mapping");
    await fetchNotes();
  }

  async function generateContent(noteId: string, mode: "questions" | "flashcards"): Promise<{ count: number }> {
    const res = await fetch("/api/ca/notes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: noteId, mode }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to generate content");
    await fetchNotes();
    return json;
  }

  async function generateCheatsheet(noteId: string): Promise<void> {
    const res = await fetch("/api/ca/cheatsheets/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: noteId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to generate cheatsheet");
    await fetchNotes();
  }

  return { notes, loading, uploadNote, confirmBlock, generateContent, generateCheatsheet, refetch: fetchNotes };
}
