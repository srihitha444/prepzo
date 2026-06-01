"use client";

import { useEffect } from "react";
import type { Flashcard } from "@/lib/supabase/types";

interface FlashCardProps {
  card: Flashcard;
  flipped: boolean;
  onFlip: () => void;
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
      className="w-full max-w-sm mx-auto cursor-pointer select-none"
      style={{ height: "240px", perspective: "1000px" }}
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
          className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] flex flex-col p-4"
        >
          <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide text-center shrink-0">
            {card.subject}{card.topic ? ` · ${card.topic}` : ""}
          </p>
          <div className="flex-1 flex items-center justify-center px-2 py-3">
            <p className="text-[#0F172A] font-semibold text-sm text-center leading-relaxed">
              {card.front_text}
            </p>
          </div>
          <p className="text-xs text-[#94A3B8] text-center shrink-0">Tap to reveal</p>
        </div>

        {/* Back */}
        <div
          style={{ ...faceBase, transform: "rotateY(180deg)" }}
          className="bg-[#1E3A8A] rounded-[14px] shadow-[var(--shadow-card)] flex flex-col p-4"
        >
          <p className="text-xs font-medium text-white/60 uppercase tracking-wide text-center shrink-0">
            Answer
          </p>
          <div className="flex-1 flex items-center justify-center px-2 py-3">
            <p className="text-white font-medium text-sm text-center leading-relaxed">
              {card.back_text}
            </p>
          </div>
          <p className="text-xs text-white/50 text-center shrink-0">Tap to flip back</p>
        </div>
      </div>
    </div>
  );
}
