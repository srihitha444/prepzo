"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFlashcards } from "@/hooks/useFlashcards";
import { FlashCard } from "@/components/flashcard/FlashCard";
import { FlashcardSkeleton } from "@/components/ui/Skeleton";
import { getSubjectsForExam } from "@/lib/utils";
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Crown, Zap } from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/lib/supabase/types";

export default function FlashcardsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [speedMode, setSpeedMode] = useState(false);
  const speedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("profiles").select("*").single().then(({ data }) => setProfile(data));
  }, []);

  const isFree = profile?.plan !== "paid";
  const subjects = getSubjectsForExam(profile?.exam || "NEET");

  const {
    currentCard,
    currentIndex,
    flipped,
    loading,
    recallCount,
    reviewCount,
    dailyLimitReached,
    flip,
    goNext,
    goPrev,
    markCard,
    total,
    displayTotal,
    seenCards,
  } = useFlashcards({
    exam: profile?.exam || "NEET",
    subject: selectedSubject || undefined,
    userId: profile?.id || "",
    plan: profile?.plan || "free",
  });

  const handleSpeedAdvance = useCallback(() => {
    if (!flipped) flip();
    else goNext();
  }, [flipped, flip, goNext]);

  useEffect(() => {
    if (speedTimerRef.current) {
      clearInterval(speedTimerRef.current);
      speedTimerRef.current = null;
    }

    if (speedMode) {
      const interval = (() => {
        try {
          const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
          return typeof prefs.speedModeInterval === "number" ? prefs.speedModeInterval * 1000 : 5000;
        } catch { return 5000; }
      })();
      speedTimerRef.current = setInterval(handleSpeedAdvance, interval);
    }

    return () => {
      if (speedTimerRef.current) {
        clearInterval(speedTimerRef.current);
        speedTimerRef.current = null;
      }
    };
  }, [speedMode, handleSpeedAdvance]);

  if (!profile) {
    return <div className="p-4 md:p-8 max-w-2xl mx-auto"><FlashcardSkeleton /></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">Flashcards</h1>
          <p className="text-sm text-[#64748B]">{profile.exam} · Tap to flip</p>
        </div>
        <div className="flex items-center gap-2">
          {profile.plan === "paid" ? (
            <button
              onClick={() => setSpeedMode((s) => !s)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                speedMode ? "bg-[#D97706] text-white" : "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]"
              }`}
            >
              <Zap size={13} /> {speedMode ? "Speed ON" : "Speed Mode"}
            </button>
          ) : (
            <Link href="/upgrade" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#F8FAFF] text-[#64748B] border border-[#E2E8F0]">
              <Zap size={13} /> Speed Mode (Pro)
            </Link>
          )}
        </div>
      </div>

      {/* Subject filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        <button
          onClick={() => setSelectedSubject("")}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 min-h-[40px] transition-all ${
            !selectedSubject ? "bg-[#1E3A8A] text-white" : "bg-white border border-[#E2E8F0] text-[#64748B]"
          }`}
        >
          All
        </button>
        {subjects.map((subject) =>
          isFree ? (
            <Link
              key={subject}
              href="/upgrade"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 min-h-[40px] bg-white border border-[#E2E8F0] text-[#94A3B8]"
            >
              <Crown size={12} className="text-[#D97706]" /> {subject}
            </Link>
          ) : (
            <button
              key={subject}
              onClick={() => setSelectedSubject(subject)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 min-h-[40px] transition-all ${
                selectedSubject === subject ? "bg-[#1E3A8A] text-white" : "bg-white border border-[#E2E8F0] text-[#64748B]"
              }`}
            >
              {subject}
            </button>
          )
        )}
      </div>

      {/* Daily limit banner for free users */}
      {isFree && !dailyLimitReached && (
        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-xs text-[#D97706] font-medium">Free plan: 5 flashcards per day</p>
          <Link href="/upgrade" className="text-xs font-semibold text-[#1E3A8A] underline">Upgrade →</Link>
        </div>
      )}

      {/* Progress dots */}
      {total > 0 && !dailyLimitReached && (
        <div className="flex items-center justify-center gap-1 mb-4 overflow-hidden">
          {Array.from({ length: Math.min(total, 20) }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === (currentIndex % 20) ? "w-4 bg-[#1E3A8A]"
                  : i < (currentIndex % 20) ? "w-1.5 bg-[#3B5FBF]"
                  : "w-1.5 bg-[#E2E8F0]"
              }`}
            />
          ))}
        </div>
      )}

      {loading ? (
        <FlashcardSkeleton />
      ) : dailyLimitReached ? (
        /* Daily limit reached — show summary + review */
        <div className="space-y-4">
          {/* Limit reached card */}
          <div className="bg-[#1E3A8A] rounded-[14px] p-5 text-white text-center">
            <Crown size={22} className="mx-auto mb-2 text-[#FDE68A]" />
            <p className="font-semibold mb-1">Daily limit reached!</p>
            <p className="text-white/70 text-xs mb-4">You&apos;ve completed your 5 free flashcards for today. Come back tomorrow or upgrade for unlimited access.</p>
            <Link href="/upgrade" className="block w-full py-2.5 rounded-xl bg-white text-[#1E3A8A] font-semibold text-sm hover:bg-[#F8FAFF] transition-all">
              Upgrade to Pro
            </Link>
          </div>

          {/* Review today's cards */}
          {seenCards.length > 0 && (
            <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-4">
              <button
                onClick={() => { setReviewOpen((o) => !o); setReviewIdx(0); setReviewFlipped(false); }}
                className="flex items-center justify-between w-full text-sm font-semibold text-[#0F172A]"
              >
                <span>Review Today&apos;s Cards ({seenCards.length})</span>
                {reviewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {reviewOpen && seenCards[reviewIdx] && (
                <div className="mt-4">
                  <p className="text-xs text-center text-[#64748B] mb-3 font-[family-name:var(--font-dm-mono)]">
                    {reviewIdx + 1} / {seenCards.length}
                  </p>

                  <div
                    className="cursor-pointer select-none"
                    onClick={() => setReviewFlipped((f) => !f)}
                  >
                    {!reviewFlipped ? (
                      <div className="bg-[#F8FAFF] border border-[#E2E8F0] rounded-[14px] p-5 min-h-[160px] flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-[#64748B] mb-2 font-medium">{seenCards[reviewIdx].subject}</p>
                        <p className="text-sm font-semibold text-[#0F172A] leading-relaxed">{seenCards[reviewIdx].front_text}</p>
                        <p className="text-xs text-[#94A3B8] mt-4">Tap to reveal answer</p>
                      </div>
                    ) : (
                      <div className="bg-[#1E3A8A] rounded-[14px] p-5 min-h-[160px] flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-white/60 mb-2 font-medium">Answer</p>
                        <p className="text-sm font-semibold text-white leading-relaxed">{seenCards[reviewIdx].back_text}</p>
                        <p className="text-xs text-white/50 mt-4">Tap to see question</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={() => { setReviewIdx((i) => Math.max(i - 1, 0)); setReviewFlipped(false); }}
                      disabled={reviewIdx === 0}
                      className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-xs text-[#64748B]">{reviewIdx + 1} of {seenCards.length}</span>
                    <button
                      onClick={() => { setReviewIdx((i) => Math.min(i + 1, seenCards.length - 1)); setReviewFlipped(false); }}
                      disabled={reviewIdx >= seenCards.length - 1}
                      className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : !currentCard ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen size={40} className="text-[#E2E8F0] mb-4" />
          <p className="text-[#64748B]">No flashcards found for this selection.</p>
          <p className="text-xs text-[#94A3B8] mt-1">Try a different subject or check back later.</p>
        </div>
      ) : (
        <>
          {/* Card counter */}
          <div className="text-center text-xs text-[#64748B] mb-3 font-[family-name:var(--font-dm-mono)]">
            {currentIndex + 1} / {displayTotal}
          </div>

          <FlashCard card={currentCard} flipped={flipped} onFlip={flip} />

          {/* Action buttons */}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => markCard("review")}
              className="flex-1 py-3 rounded-xl bg-[#FEE2E2] text-[#DC2626] font-semibold text-sm hover:bg-[#FECACA] transition-all min-h-[44px]"
            >
              ← Need Review
            </button>
            <button
              onClick={flip}
              className="w-12 flex items-center justify-center rounded-xl bg-[#F8FAFF] border border-[#E2E8F0] text-[#64748B] hover:bg-[#E2E8F0] transition-all"
            >
              <span className="text-xs">flip</span>
            </button>
            <button
              onClick={() => markCard("recall")}
              className="flex-1 py-3 rounded-xl bg-[#DCFCE7] text-[#16A34A] font-semibold text-sm hover:bg-[#BBF7D0] transition-all min-h-[44px]"
            >
              Got It →
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <button onClick={goPrev} disabled={currentIndex === 0} className="p-3 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all">
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                <span className="text-[#64748B]">{recallCount} in Recall</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                <span className="text-[#64748B]">{reviewCount} in Review</span>
              </div>
            </div>
            <button onClick={goNext} disabled={currentIndex >= total - 1} className="p-3 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all">
              <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}

      {speedMode && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-[#D97706] text-white px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg">
          <Zap size={12} /> Speed Mode active
        </div>
      )}
    </div>
  );
}
