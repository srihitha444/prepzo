"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight } from "lucide-react";

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: "nav-dashboard",
    title: "Your Home Base",
    description: "Track your streak, see today's progress, and quickly jump back into practice.",
    position: "right",
  },
  {
    targetId: "nav-flashcards",
    title: "Flashcards",
    description: "Tap the card to reveal the answer. Mark \"Got it\" if you knew it, or \"Need practice\" if you didn't.",
    position: "right",
  },
  {
    targetId: "nav-quiz",
    title: "Quiz Mode",
    description: "Timed MCQs section by section — Physics, Chemistry, Maths. Train like the real exam.",
    position: "right",
  },
  {
    targetId: "nav-decks",
    title: "Your Decks",
    description: "All your practiced cards go into the Recall Deck — whether right or wrong. Spaced repetition brings them back at the perfect time.",
    position: "right",
  },
  {
    targetId: "nav-progress",
    title: "Track Progress",
    description: "View your accuracy trends, weak topics, and speed — so you know exactly what to focus on.",
    position: "right",
  },
];

export function TourOverlay() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const completed = localStorage.getItem("prepzo_tour_completed");
    if (!completed) {
      setTimeout(() => setActive(true), 800);
    }
  }, []);

  const updatePositions = useCallback(() => {
    if (!active) return;
    const currentStep = TOUR_STEPS[step];
    const targetEl = document.getElementById(currentStep.targetId) ||
      document.getElementById("mobile-" + currentStep.targetId);

    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    setTargetRect(rect);

    const tooltipWidth = 280;
    const tooltipHeight = 160;
    const margin = 12;

    let top = rect.top + rect.height / 2 - tooltipHeight / 2;
    let left = rect.right + margin;

    const pos = currentStep.position || "right";

    if (pos === "right") {
      left = rect.right + margin;
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      if (left + tooltipWidth > window.innerWidth - 16) {
        left = rect.left - tooltipWidth - margin;
      }
    } else if (pos === "bottom") {
      top = rect.bottom + margin;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    } else if (pos === "top") {
      top = rect.top - tooltipHeight - margin;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    }

    // Clamp to viewport
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

    setTooltipPos({ top, left });
  }, [active, step]);

  useEffect(() => {
    updatePositions();
  }, [updatePositions]);

  useEffect(() => {
    window.addEventListener("resize", updatePositions);
    return () => window.removeEventListener("resize", updatePositions);
  }, [updatePositions]);

  function completeTour() {
    localStorage.setItem("prepzo_tour_completed", "true");
    setActive(false);
  }

  function nextStep() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeTour();
    }
  }

  if (!mounted || !active) return null;

  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[1000]" aria-modal="true">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />

      {/* Cutout highlight */}
      {targetRect && (
        <div
          className="absolute rounded-xl ring-2 ring-white ring-offset-2 ring-offset-transparent pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-white rounded-[14px] shadow-2xl p-5 w-[280px] pointer-events-auto"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        {/* Close */}
        <button
          onClick={completeTour}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-all"
        >
          <X size={14} />
        </button>

        <h3 className="font-semibold text-[#0F172A] text-sm mb-1.5 pr-6">
          {currentStep.title}
        </h3>
        <p className="text-xs text-[#64748B] leading-relaxed mb-4">
          {currentStep.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === step ? "bg-[#1E3A8A] w-3" : "bg-[#E2E8F0]"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={completeTour}
              className="text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              Skip
            </button>
            <button
              onClick={nextStep}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#162D6B] transition-all"
            >
              {isLast ? "Let's Go!" : "Next"}
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
