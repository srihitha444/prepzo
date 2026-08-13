"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFlashcards } from "@/hooks/useFlashcards";
import { FlashCard } from "@/components/flashcard/FlashCard";
import { FlashcardSkeleton } from "@/components/ui/Skeleton";
import { getSubjectsForExam } from "@/lib/utils";
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Crown, Zap, BarChart2, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import type { Profile, Flashcard } from "@/lib/supabase/types";

type FlashcardState = "setup" | "playing";

function getFlashcardSessionGoal(plan: "free" | "paid") {
  if (plan !== "paid") return 5;
  try {
    const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
    const savedGoal = Number(prefs.flashcardGoal || prefs.newCardsPerDay);
    if (Number.isFinite(savedGoal) && savedGoal > 0) return savedGoal;
  } catch {}
  return 20;
}

export default function FlashcardsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [flashcardState, setFlashcardState] = useState<FlashcardState>("setup");
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
  const flashcardSessionGoal = getFlashcardSessionGoal(profile?.plan || "free");
  const subjects = getSubjectsForExam(profile?.exam || "NEET");
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([]);

  const {
    currentCard,
    currentIndex,
    flipped,
    loading,
    recallCount,
    reviewCount,
    sessionEnded,
    dailyLimitReached,
    flip,
    goNext,
    goPrev,
    markCard,
    continueSession,
    practiceAgain,
    total,
    displayTotal,
    seenCards,
  } = useFlashcards({
    exam: profile?.exam || "NEET",
    subject: selectedSubject || undefined,
    userId: profile?.id || "",
    plan: profile?.plan || "free",
    sessionGoal: flashcardSessionGoal,
    enabled: flashcardState === "playing",
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

  async function loadReviewCards(mode: "yesterday" | "previous") {
    if (!profile) return;
    const supabase = createClient();
    const currentIds = new Set(seenCards.map((card) => card.id));

    let query = supabase
      .from("user_flashcard_progress")
      .select("last_seen_at, flashcards!inner(*)")
      .eq("user_id", profile.id)
      .eq("flashcards.exam", profile.exam)
      .not("last_seen_at", "is", null)
      .order("last_seen_at", { ascending: false });

    if (mode === "yesterday") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      query = query
        .gte("last_seen_at", yesterday.toISOString())
        .lt("last_seen_at", today.toISOString());
    }

    const { data } = await query.limit(flashcardSessionGoal);
    const cards = ((data || []) as Array<{ flashcards: Flashcard }>)
      .map((row) => row.flashcards)
      .filter((card) => mode === "yesterday" || !currentIds.has(card.id));

    setReviewCards(cards);
    setReviewIdx(0);
    setReviewFlipped(false);
    setReviewOpen(true);
  }

  const activeReviewCards = reviewCards.length > 0 ? reviewCards : seenCards;

  function startFlashcards() {
    setSpeedMode(false);
    setFlashcardState("playing");
  }

  if (!profile) {
    return <div className="p-4 md:p-8 max-w-2xl mx-auto"><FlashcardSkeleton /></div>;
  }

  if (flashcardState === "setup") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-6">
          Flashcards
        </h1>

        <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-5 mb-4">
          <p className="text-sm font-semibold text-[#0F172A] mb-3">Select Subject</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSubject("")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                !selectedSubject ? "bg-[#1E3A8A] text-white" : "bg-[#F8FAFF] border border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
              }`}
            >
              All Subjects
            </button>
            {subjects.map((subject) =>
              isFree ? (
                <Link
                  key={subject}
                  href="/upgrade"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium min-h-[44px] bg-[#F8FAFF] border border-[#E2E8F0] text-[#94A3B8]"
                >
                  <Crown size={12} className="text-[#D97706]" /> {subject}
                </Link>
              ) : (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                    selectedSubject === subject ? "bg-[#1E3A8A] text-white" : "bg-[#F8FAFF] border border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                  }`}
                >
                  {subject}
                </button>
              )
            )}
          </div>
          {isFree && (
            <p className="text-xs text-[#94A3B8] mt-3 flex items-center gap-1">
              <Crown size={11} className="text-[#D97706]" /> Subject-wise flashcards require Pro
            </p>
          )}
        </div>

        <div className="bg-[#F8FAFF] border border-[#E2E8F0] rounded-xl p-4 mb-6 flex items-start gap-3">
          <BookOpen size={18} className="text-[#1E3A8A] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">
              {selectedSubject || "All subjects"} · {flashcardSessionGoal} cards this session
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              {isFree ? "Free plan: 5 flashcards per session." : "Pro sessions use your flashcard goal from settings."}
            </p>
          </div>
        </div>

        <button
          onClick={startFlashcards}
          className="w-full py-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold text-base transition-all flex items-center justify-center gap-2"
        >
          Start Flashcards <ChevronRight size={18} />
        </button>
      </div>
    );
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

      {/* Free session banner */}
      {isFree && !dailyLimitReached && (
        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-xs text-[#D97706] font-medium">Free plan: 5 flashcards per session</p>
          <Link href="/upgrade" className="text-xs font-semibold text-[#1E3A8A] underline">Upgrade →</Link>
        </div>
      )}

      {/* Progress dots */}
      {total > 0 && !sessionEnded && (
        <div className="flex items-center justify-center gap-1 mb-4 overflow-hidden">
          {Array.from({ length: Math.min(total, displayTotal) }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === (currentIndex % displayTotal) ? "w-4 bg-[#1E3A8A]"
                  : i < (currentIndex % displayTotal) ? "w-1.5 bg-[#3B5FBF]"
                  : "w-1.5 bg-[#E2E8F0]"
              }`}
            />
          ))}
        </div>
      )}

      {loading ? (
        <FlashcardSkeleton />
      ) : sessionEnded ? (
        <div className="space-y-4">
          {isFree ? (
            <div className="bg-[#1E3A8A] rounded-[14px] p-5 text-white text-center">
              <Crown size={22} className="mx-auto mb-2 text-[#FDE68A]" />
              <p className="font-semibold mb-1">Unlock all flashcards with Pro</p>
              <p className="text-white/70 text-xs mb-4">You&apos;ve completed your 5 free flashcards for this session.</p>
              <Link href="/upgrade" className="block w-full py-2.5 rounded-xl bg-white text-[#1E3A8A] font-semibold text-sm hover:bg-[#F8FAFF] transition-all">
                Upgrade to Pro
              </Link>
            </div>
          ) : (
            <div className="bg-[#1E3A8A] rounded-[14px] p-6 text-white text-center">
              <p className="font-[family-name:var(--font-fraunces)] text-2xl font-bold mb-1">Session Done!</p>
              <p className="text-sm text-white/70 mb-5">{recallCount + reviewCount} cards reviewed</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold">{recallCount + reviewCount}</p>
                  <p className="text-xs text-white/70">Cards reviewed</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold text-[#4ADE80]">{recallCount}</p>
                  <p className="text-xs text-white/70">Going to Recall</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold text-[#FCA5A5]">{reviewCount}</p>
                  <p className="text-xs text-white/70">Going to Review</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => loadReviewCards("yesterday")}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Review Yesterday
                </button>
                <button
                  onClick={() => loadReviewCards("previous")}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Review Previous Sessions
                </button>
                <button
                  onClick={practiceAgain}
                  className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF]"
                >
                  Practice Again
                </button>
                <button
                  onClick={continueSession}
                  className="rounded-xl border border-white/25 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  New Session
                </button>
                <Link
                  href="/progress"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/25 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  <BarChart2 size={16} /> View Progress
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  <LayoutDashboard size={16} /> Dashboard
                </Link>
              </div>
            </div>
          )}

          {/* Review cards */}
          {activeReviewCards.length > 0 && (
            <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-4">
              <button
                onClick={() => { setReviewOpen((o) => !o); setReviewIdx(0); setReviewFlipped(false); }}
                className="flex items-center justify-between w-full text-sm font-semibold text-[#0F172A]"
              >
                <span>{isFree ? "Review This Session" : "Review Cards"} ({activeReviewCards.length})</span>
                {reviewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {reviewOpen && activeReviewCards[reviewIdx] && (
                <div className="mt-4">
                  <p className="text-xs text-center text-[#64748B] mb-3 font-[family-name:var(--font-dm-mono)]">
                    {reviewIdx + 1} / {activeReviewCards.length}
                  </p>

                  <div
                    className="cursor-pointer select-none"
                    onClick={() => setReviewFlipped((f) => !f)}
                  >
                    {!reviewFlipped ? (
                      <div className="bg-[#F8FAFF] border border-[#E2E8F0] rounded-[14px] p-5 min-h-[160px] flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-[#64748B] mb-2 font-medium">{activeReviewCards[reviewIdx].subject}</p>
                        <p className="text-sm font-semibold text-[#0F172A] leading-relaxed">{activeReviewCards[reviewIdx].front_text}</p>
                        <p className="text-xs text-[#94A3B8] mt-4">Tap to reveal answer</p>
                      </div>
                    ) : (
                      <div className="bg-[#1E3A8A] rounded-[14px] p-5 min-h-[160px] flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-white/60 mb-2 font-medium">Answer</p>
                        <p className="text-sm font-semibold text-white leading-relaxed">{activeReviewCards[reviewIdx].back_text}</p>
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
                    <span className="text-xs text-[#64748B]">{reviewIdx + 1} of {activeReviewCards.length}</span>
                    <button
                      onClick={() => { setReviewIdx((i) => Math.min(i + 1, activeReviewCards.length - 1)); setReviewFlipped(false); }}
                      disabled={reviewIdx >= activeReviewCards.length - 1}
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
            <button onClick={goNext} disabled={currentIndex >= Math.min(total, displayTotal) - 1} className="p-3 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all">
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
