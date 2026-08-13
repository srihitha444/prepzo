"use client";

import { useRef, useState } from "react";

const MIN_PERCENT = 25;
const MAX_PERCENT = 75;

// IELTS-style split: a draggable divider between two panels, side by side
// (desktop only — below lg they stack vertically like a normal page, no
// divider). Panels are capped at a max height and scroll independently only
// once content actually exceeds it — they are NOT forced to a large fixed
// height regardless of content, which for a short question left a wall of
// empty space under it every time. `items-stretch` still keeps both panels
// equal to whichever is taller, capped by that same max height.
//
// One instance of `left`/`right` in the DOM (not a desktop copy + a hidden
// mobile copy) — panels can hold their own local state (e.g. an in-progress
// answer textarea), so rendering them twice would silently fork that state
// into two out-of-sync copies.
export function ResizableSplit({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState(50);
  const draggingRef = useRef(false);

  // Everything for a drag session lives inside this one event handler —
  // the move/up listeners are created fresh per pointerdown and only ever
  // touch the DOM in response to a real event, never during render.
  function onPointerDown() {
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, percent)));
    }

    function onPointerUp() {
      draggingRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0">
      <div
        className="w-full lg:max-h-[70vh] lg:w-[var(--split-left)] lg:overflow-y-auto lg:pr-3"
        style={{ ["--split-left" as string]: `${leftPercent}%` }}
      >
        {left}
      </div>

      <div
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize question and answer panels"
        className="hidden shrink-0 cursor-col-resize items-center justify-center lg:flex lg:w-3"
      >
        <div className="h-16 w-1 rounded-full bg-[#E2E8F0] transition-colors hover:bg-[#3B5FBF]" />
      </div>

      <div
        className="w-full lg:max-h-[70vh] lg:w-[var(--split-right)] lg:overflow-y-auto lg:pl-3"
        style={{ ["--split-right" as string]: `${100 - leftPercent}%` }}
      >
        {right}
      </div>
    </div>
  );
}
