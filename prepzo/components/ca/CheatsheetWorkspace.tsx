"use client";

import { useState } from "react";
import { CheatsheetSidebar } from "@/components/ca/CheatsheetSidebar";
import { CheatsheetEditor } from "@/components/ca/CheatsheetEditor";
import { useCaCheatsheets } from "@/hooks/useCaCheatsheets";

export function CheatsheetWorkspace({ initialNoteId }: { initialNoteId?: string }) {
  const { cheatsheets, loading, refetch } = useCaCheatsheets();
  const [activeNoteId, setActiveNoteId] = useState<string | undefined>(initialNoteId);

  const activeSheet = cheatsheets.find((s) => s.noteId === activeNoteId);

  return (
    <div className="flex gap-4">
      <CheatsheetSidebar cheatsheets={cheatsheets} loading={loading} activeNoteId={activeNoteId} onSelect={setActiveNoteId} />
      <div className="min-w-0 flex-1">
        {activeSheet ? (
          <CheatsheetEditor
            key={activeSheet.id}
            cheatsheetId={activeSheet.id}
            noteId={activeSheet.noteId}
            noteTitle={activeSheet.title}
            onChanged={refetch}
          />
        ) : (
          <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center shadow-[var(--shadow-card)] md:h-[calc(100vh-6rem)]">
            <p className="text-sm text-[#64748B]">
              {loading
                ? "Loading..."
                : cheatsheets.length === 0
                  ? "No cheatsheets yet — go to Upload and click \"Create Cheatsheet\" on a note."
                  : "Pick a cheatsheet from the left to view it."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
