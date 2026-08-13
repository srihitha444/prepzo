"use client";

import { Check } from "lucide-react";
import { getPapersForLevel, formatLabel, type CaPaper } from "@/lib/ca-syllabus";

interface CaPaperSelectorProps {
  level: string;
  groups: string[];
  selectedPapers: string[];
  onChange: (papers: string[]) => void;
}

export function CaPaperSelector({ level, groups, selectedPapers, onChange }: CaPaperSelectorProps) {
  const papers = getPapersForLevel(level, groups);

  if (papers.length === 0) return null;

  function togglePaper(code: string) {
    if (selectedPapers.includes(code)) {
      onChange(selectedPapers.filter((c) => c !== code));
      return;
    }
    onChange([...selectedPapers, code]);
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-[#0F172A]">Which papers are you preparing for?</p>
      <p className="mb-3 text-xs text-[#64748B]">
        All papers are selected by default — uncheck any you&apos;ve already cleared.
      </p>
      <div className="space-y-2">
        {papers.map((paper) => (
          <PaperRow
            key={paper.code}
            paper={paper}
            selected={selectedPapers.includes(paper.code)}
            onToggle={() => togglePaper(paper.code)}
          />
        ))}
      </div>
    </div>
  );
}

function PaperRow({ paper, selected, onToggle }: { paper: CaPaper; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
        selected
          ? "border-[#1E3A8A] bg-[#DBEAFE]"
          : "border-[#E2E8F0] bg-white hover:border-[#3B5FBF]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
            selected ? "border-[#1E3A8A] bg-[#1E3A8A] text-white" : "border-[#CBD5E1]"
          }`}
        >
          {selected && <Check size={13} strokeWidth={3} />}
        </div>
        <span className="text-sm font-semibold text-[#0F172A]">{paper.name}</span>
      </div>
      <span className="shrink-0 text-right text-xs font-medium text-[#64748B]">{formatLabel(paper)}</span>
    </button>
  );
}
