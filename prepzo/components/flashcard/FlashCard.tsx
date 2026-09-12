"use client";

import { useEffect } from "react";
import type { Flashcard } from "@/lib/supabase/types";

interface FlashCardProps {
  card: Flashcard;
  flipped: boolean;
  onFlip: () => void;
}

interface TextSegment {
  label: string | null;
  body: string;
}

// Generated answers often pack several labeled points into one paragraph
// (e.g. "... Key Condition: ... Exception: ... Example: ... Exam Tip: ...")
// which reads as one dense wall of centered text. Split on those labels
// (a short Title Case phrase followed by ": ", starting a new sentence) so
// each point renders as its own left-aligned block instead.
const LABEL_REGEX = /(?:^|(?<=\.\s))([A-Z][A-Za-z]+(?:\s[A-Z][a-z]+){0,2}):\s/g;

function splitLabeledSegments(text: string): TextSegment[] {
  const matches = Array.from(text.matchAll(LABEL_REGEX));
  if (matches.length === 0) return [{ label: null, body: text }];

  const segments: TextSegment[] = [];
  const firstIndex = matches[0].index ?? 0;
  const leading = text.slice(0, firstIndex).trim();
  if (leading) segments.push({ label: null, body: leading });

  matches.forEach((match, i) => {
    const label = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    if (body) segments.push({ label, body });
  });

  return segments;
}

function FlashcardAnswerText({ text }: { text: string }) {
  const segments = splitLabeledSegments(text);
  return (
    <div className="w-full">
      {segments.map((segment, i) => (
        <p key={i} className={i > 0 ? "mt-2.5" : ""}>
          {segment.label && <span className="font-semibold text-white/90">{segment.label}: </span>}
          {segment.body}
        </p>
      ))}
    </div>
  );
}

const faceBase: React.CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "100%",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

export function FlashCard({ card, flipped, onFlip }: FlashCardProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") onFlip();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFlip]);

  return (
    <div
      className="w-full max-w-lg mx-auto cursor-pointer select-none"
      style={{ height: "340px", perspective: "1000px" }}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label={flipped ? "Card back — tap to flip" : "Card front — tap to flip"}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front */}
        <div
          style={faceBase}
          className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] flex flex-col p-5"
        >
          <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide text-center shrink-0">
            {card.subject}{card.topic ? ` · ${card.topic}` : ""}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto flex items-center justify-center px-2 py-3">
            <p className="text-[#0F172A] font-semibold text-base text-center leading-relaxed">
              {card.front_text}
            </p>
          </div>
          <p className="text-xs text-[#94A3B8] text-center shrink-0">Tap to reveal</p>
        </div>

        {/* Back */}
        <div
          style={{ ...faceBase, transform: "rotateY(180deg)" }}
          className="bg-[#1E3A8A] rounded-[14px] shadow-[var(--shadow-card)] flex flex-col p-5"
        >
          <p className="text-xs font-medium text-white/60 uppercase tracking-wide text-center shrink-0">
            Answer
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            <div className="text-white font-medium text-base text-left leading-relaxed">
              <FlashcardAnswerText text={card.back_text} />
            </div>
          </div>
          <p className="text-xs text-white/50 text-center shrink-0">Tap to flip back</p>
        </div>
      </div>
    </div>
  );
}
