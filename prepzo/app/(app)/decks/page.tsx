"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordAnswer } from "@/lib/questions";
import { FlashCard } from "@/components/flashcard/FlashCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import {
  Layers, Clock, RotateCcw, Star, ChevronRight, CheckCircle2, XCircle,
  ArrowLeft, BookOpen, Brain, ChevronLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import type { Profile, Flashcard } from "@/lib/supabase/types";

interface MCQItem {
  kind: "mcq";
  id: string;
  questionId: string;
  question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: string;
  explanation: string | null;
  subject: string; topic: string | null; difficulty: string | null;
  times_seen: number; times_correct: number; next_due_at: string | null;
}

interface FCItem {
  kind: "flashcard";
  id: string;
  flashcardId: string;
  front_text: string; back_text: string;
  subject: string; topic: string | null;
  times_seen: number; next_due_at: string | null;
}

type DeckItem = MCQItem | FCItem;

export default function DecksPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<"recall" | "review">("recall");
  const [items, setItems] = useState<DeckItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Review state
  const [reviewing, setReviewing] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState({ correct: 0, wrong: 0 });

  useEffect(() => {
    const supabase = createClient();
    supabase.from("profiles").select("*").single().then(({ data }) => setProfile(data));
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadItems();
  }, [profile, activeTab]); // eslint-disable-line

  async function loadItems() {
    if (!profile) return;
    setLoading(true);
    const supabase = createClient();

    const { data: mcqRaw } = await supabase
      .from("user_progress")
      .select(`id, times_seen, times_correct, next_due_at,
        questions!inner(id, question_text, subject, topic, difficulty, option_a, option_b, option_c, option_d, correct_option, explanation)`)
      .eq("user_id", profile.id).eq("deck_type", activeTab)
      .order("next_due_at", { ascending: true }).limit(50);

    const mcqItems: MCQItem[] = (mcqRaw || []).map((r: {
      id: string; times_seen: number; times_correct: number; next_due_at: string | null;
      questions: { id: string; question_text: string; subject: string; topic: string | null; difficulty: string | null;
        option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; explanation: string | null };
    }) => ({ kind: "mcq", id: r.id, questionId: r.questions.id, question_text: r.questions.question_text,
      option_a: r.questions.option_a, option_b: r.questions.option_b, option_c: r.questions.option_c, option_d: r.questions.option_d,
      correct_option: r.questions.correct_option, explanation: r.questions.explanation, subject: r.questions.subject,
      topic: r.questions.topic, difficulty: r.questions.difficulty, times_seen: r.times_seen, times_correct: r.times_correct,
      next_due_at: r.next_due_at }));

    const { data: fcRaw } = await supabase
      .from("user_flashcard_progress")
      .select(`id, times_seen, next_due_at, flashcards!inner(id, front_text, back_text, subject, topic)`)
      .eq("user_id", profile.id).eq("deck_type", activeTab)
      .order("next_due_at", { ascending: true }).limit(50);

    const fcItems: FCItem[] = (fcRaw || []).map((r: {
      id: string; times_seen: number; next_due_at: string | null;
      flashcards: { id: string; front_text: string; back_text: string; subject: string; topic: string | null };
    }) => ({ kind: "flashcard", id: r.id, flashcardId: r.flashcards.id, front_text: r.flashcards.front_text,
      back_text: r.flashcards.back_text, subject: r.flashcards.subject, topic: r.flashcards.topic,
      times_seen: r.times_seen, next_due_at: r.next_due_at }));

    const merged = [...mcqItems, ...fcItems].sort((a, b) => {
      if (!a.next_due_at) return -1; if (!b.next_due_at) return 1;
      return new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime();
    });
    setItems(merged);
    setLoading(false);
  }

  function startReviewAt(index: number) {
    setReviewIndex(index);
    setSelectedOption(null);
    setAnswered(false);
    setFlipped(false);
    setResults({ correct: 0, wrong: 0 });
    setReviewing(true);
  }

  function startReview() {
    startReviewAt(0);
  }

  function exitReview() { setReviewing(false); loadItems(); }

  // Remove answered item immediately from list and advance
  function removeCurrentAndAdvance() {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== reviewIndex);
      if (next.length === 0) { setReviewing(false); loadItems(); return next; }
      return next;
    });
    setSelectedOption(null); setAnswered(false); setFlipped(false);
    // reviewIndex stays the same — next item slides into current position
    if (reviewIndex >= items.length - 1) {
      setReviewing(false); loadItems();
    }
  }

  async function handleMCQAnswer(option: string) {
    if (answered || !profile) return;
    const item = items[reviewIndex] as MCQItem;
    const isCorrect = option === item.correct_option;
    setSelectedOption(option); setAnswered(true);
    setResults((r) => ({ correct: r.correct + (isCorrect ? 1 : 0), wrong: r.wrong + (!isCorrect ? 1 : 0) }));
    if (isCorrect) toast.success("Correct! → Recall deck", { duration: 1200 });
    else toast.error("Wrong → Review deck", { duration: 1200 });
    await recordAnswer({ userId: profile.id, questionId: item.questionId, isCorrect, timeSeconds: 0 });
  }

  async function handleFCMark(deck: "recall" | "review") {
    if (!profile) return;
    const item = items[reviewIndex] as FCItem;
    const isCorrect = deck === "recall";
    setResults((r) => ({ correct: r.correct + (isCorrect ? 1 : 0), wrong: r.wrong + (!isCorrect ? 1 : 0) }));
    const supabase = createClient();
    await supabase.from("user_flashcard_progress").upsert({
      user_id: profile.id, flashcard_id: item.flashcardId, deck_type: deck,
      times_seen: item.times_seen + 1, last_seen_at: new Date().toISOString(),
      next_due_at: new Date(Date.now() + (deck === "recall" ? 3 : 1) * 86400000).toISOString(),
    }, { onConflict: "user_id,flashcard_id" });
    if (isCorrect) toast.success("Moved to Recall ✓", { duration: 1000 });
    else toast("Moved to Review", { duration: 1000 });
    removeCurrentAndAdvance();
  }

  const dueCount = items.filter((c) => !c.next_due_at || new Date(c.next_due_at) <= new Date()).length;

  // ── REVIEW MODE ──────────────────────────────────────────────────
  if (reviewing) {
    if (items.length === 0) {
      return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto text-center py-16">
          <p className="text-[#64748B] mb-1 font-semibold">All reviewed!</p>
          <p className="text-xs text-[#94A3B8] mb-5">{results.correct} correct · {results.wrong} wrong</p>
          <button onClick={exitReview} className="px-5 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold">
            Back to Decks
          </button>
        </div>
      );
    }

    const item = items[reviewIndex] ?? items[0];
    if (!item) { exitReview(); return null; }

    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={exitReview} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]">
            <ArrowLeft size={16} /> Decks
          </button>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[#16A34A] font-semibold">✓ {results.correct}</span>
            <span className="text-[#DC2626] font-semibold">✗ {results.wrong}</span>
            <span className="text-[#64748B]">{Math.min(reviewIndex + 1, items.length)}/{items.length}</span>
          </div>
        </div>

        {item.kind === "mcq" ? (
          <>
            <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-5 mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="primary">{item.subject}</Badge>
                {item.topic && <Badge variant="muted">{item.topic}</Badge>}
                {item.difficulty && (
                  <Badge variant={item.difficulty === "Easy" ? "success" : item.difficulty === "Hard" ? "error" : "warning"}>
                    {item.difficulty}
                  </Badge>
                )}
              </div>
              <p className="text-[#0F172A] font-medium leading-relaxed">{item.question_text}</p>
            </div>

            <div className="space-y-2.5 mb-4">
              {(["A", "B", "C", "D"] as const).map((label) => {
                const text = item[`option_${label.toLowerCase()}` as "option_a"];
                const isCorrect = answered && label === item.correct_option;
                const isWrong = answered && selectedOption === label && label !== item.correct_option;
                return (
                  <button key={label} disabled={answered} onClick={() => handleMCQAnswer(label)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-3 min-h-[52px] ${
                      isCorrect ? "bg-[#F0FDF4] border-[#16A34A] text-[#16A34A]"
                      : isWrong ? "bg-[#FEF2F2] border-[#DC2626] text-[#DC2626]"
                      : answered ? "bg-[#F8FAFF] border-[#E2E8F0] text-[#64748B]"
                      : "bg-white border-[#E2E8F0] text-[#0F172A] hover:border-[#1E3A8A] hover:bg-[#F8FAFF]"
                    }`}>
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCorrect ? "bg-[#16A34A] text-white" : isWrong ? "bg-[#DC2626] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                    }`}>{label}</span>
                    {text}
                    {isCorrect && <CheckCircle2 size={16} className="ml-auto shrink-0 text-[#16A34A]" />}
                    {isWrong && <XCircle size={16} className="ml-auto shrink-0 text-[#DC2626]" />}
                  </button>
                );
              })}
            </div>

            {answered && item.explanation && (
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-[#16A34A] mb-1">Explanation</p>
                <p className="text-sm text-[#0F172A] leading-relaxed">{item.explanation}</p>
              </div>
            )}

            {answered && (
              <button onClick={removeCurrentAndAdvance}
                className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all flex items-center justify-center gap-2">
                Next <ChevronRight size={16} />
              </button>
            )}
          </>
        ) : (
          <>
            <FlashCard
              card={{ id: item.flashcardId, exam: "NEET", subject: item.subject, topic: item.topic,
                front_text: item.front_text, back_text: item.back_text, is_active: true, created_at: "" } as Flashcard}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
            />

            {/* Flashcard navigation arrows */}
            <div className="flex items-center justify-between mt-3 mb-2">
              <button
                onClick={() => { setFlipped(false); setReviewIndex((i) => Math.max(i - 1, 0)); }}
                disabled={reviewIndex === 0}
                className="p-3 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-xs text-[#64748B]">{reviewIndex + 1} / {items.length}</span>
              <button
                onClick={() => { setFlipped(false); if (reviewIndex < items.length - 1) setReviewIndex((i) => i + 1); }}
                disabled={reviewIndex >= items.length - 1}
                className="p-3 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="flex gap-3 mt-2">
              <button onClick={() => handleFCMark("review")}
                className="flex-1 py-3 rounded-xl bg-[#FEE2E2] text-[#DC2626] font-semibold text-sm hover:bg-[#FECACA] transition-all min-h-[44px]">
                ← Need Review
              </button>
              <button onClick={() => setFlipped((f) => !f)}
                className="w-12 flex items-center justify-center rounded-xl bg-[#F8FAFF] border border-[#E2E8F0] text-[#64748B] hover:bg-[#E2E8F0] transition-all">
                <span className="text-xs">flip</span>
              </button>
              <button onClick={() => handleFCMark("recall")}
                className="flex-1 py-3 rounded-xl bg-[#DCFCE7] text-[#16A34A] font-semibold text-sm hover:bg-[#BBF7D0] transition-all min-h-[44px]">
                Got It →
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── LIST MODE ────────────────────────────────────────────────────
  const mcqCount = items.filter((i) => i.kind === "mcq").length;
  const fcCount = items.filter((i) => i.kind === "flashcard").length;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Layers size={20} className="text-[#1E3A8A]" />
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">My Decks</h1>
      </div>

      <div className="flex gap-2 mb-6 bg-[#F8FAFF] rounded-xl p-1 border border-[#E2E8F0]">
        {(["recall", "review"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab ? "bg-white shadow-sm text-[#1E3A8A]" : "text-[#64748B]"
            }`}>
            {tab === "recall" ? <Star size={14} className="text-[#16A34A]" /> : <RotateCcw size={14} className="text-[#DC2626]" />}
            {tab === "recall" ? "Recall Deck" : "Review Deck"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="text-center py-3">
          <p className="font-[family-name:var(--font-dm-mono)] text-xl font-bold text-[#0F172A]">{items.length}</p>
          <p className="text-xs text-[#64748B]">Total items</p>
        </Card>
        <Card className="text-center py-3">
          <p className="font-[family-name:var(--font-dm-mono)] text-xl font-bold text-[#D97706]">{dueCount}</p>
          <p className="text-xs text-[#64748B]">Due today</p>
        </Card>
      </div>

      <div className={`rounded-xl p-4 mb-5 border flex items-start justify-between gap-3 ${
        activeTab === "recall" ? "bg-[#F0FDF4] border-[#BBF7D0]" : "bg-[#FEF2F2] border-[#FECACA]"
      }`}>
        <div>
          <p className={`text-sm font-semibold mb-0.5 ${activeTab === "recall" ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
            {activeTab === "recall" ? "Recall Deck" : "Review Deck"}
          </p>
          <p className="text-xs text-[#64748B]">
            {mcqCount > 0 && `${mcqCount} MCQ${mcqCount !== 1 ? "s" : ""}`}
            {mcqCount > 0 && fcCount > 0 && " · "}
            {fcCount > 0 && `${fcCount} flashcard${fcCount !== 1 ? "s" : ""}`}
            {items.length === 0 && "Nothing here yet"}
          </p>
        </div>
        {items.length > 0 && (
          <button onClick={startReview}
            className={`shrink-0 px-3 py-1.5 text-white text-xs font-semibold rounded-lg whitespace-nowrap ${
              activeTab === "recall" ? "bg-[#16A34A]" : "bg-[#DC2626]"
            }`}>
            {dueCount > 0 ? `Review ${dueCount} due` : "Review all"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Layers size={40} className="mx-auto text-[#E2E8F0] mb-4" />
          <p className="text-[#64748B] font-medium">No items here yet</p>
          <p className="text-xs text-[#94A3B8] mt-1">
            {activeTab === "recall" ? "Answer correctly to add items here." : "Wrong answers will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const isDue = !item.next_due_at || new Date(item.next_due_at) <= new Date();
            return (
              <Card
                key={item.id}
                onClick={() => startReviewAt(index)}
                className="flex items-start gap-3 cursor-pointer hover:border-[#1E3A8A] transition-all"
              >
                <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${item.kind === "mcq" ? "bg-[#DBEAFE]" : "bg-[#F3E8FF]"}`}>
                  {item.kind === "mcq" ? <Brain size={14} className="text-[#1E3A8A]" /> : <BookOpen size={14} className="text-[#7C3AED]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0F172A] font-medium line-clamp-2 mb-2">
                    {item.kind === "mcq" ? item.question_text : item.front_text}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="primary">{item.subject}</Badge>
                    {item.topic && <Badge variant="muted">{item.topic}</Badge>}
                    <Badge variant="muted">{item.kind === "mcq" ? "MCQ" : "Flashcard"}</Badge>
                    {isDue && <Badge variant="warning">Due now</Badge>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-[#64748B]">{item.times_seen}× seen</p>
                  {item.next_due_at && !isDue && (
                    <div className="flex items-center gap-1 text-xs text-[#64748B] mt-1">
                      <Clock size={10} />
                      {new Date(item.next_due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
