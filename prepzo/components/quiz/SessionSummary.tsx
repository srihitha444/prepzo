"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, Target, Clock, RotateCcw, Crown, ChevronDown, ChevronUp, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Question } from "@/lib/supabase/types";

interface AnswerRecord {
  questionId: string;
  correct: boolean;
  timeSeconds: number;
  topic: string | null;
  subject: string;
}

interface SessionSummaryProps {
  stats: {
    correct: number;
    wrong: number;
    accuracy: number;
    score: number;
    total: number;
  };
  answers: AnswerRecord[];
  questions: Question[];
  exam: string;
  plan: "free" | "paid";
  goalReached?: boolean;
  onRestart: () => void;
}

export function SessionSummary({ stats, answers, questions, exam, plan, goalReached, onRestart }: SessionSummaryProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);

  const subjects = [...new Set(answers.map((a) => a.subject))];
  const subjectBreakdown = subjects.map((subject) => {
    const items = answers.filter((a) => a.subject === subject);
    const correct = items.filter((a) => a.correct).length;
    return { subject, total: items.length, correct, accuracy: Math.round((correct / items.length) * 100) };
  });

  const topicMap = new Map<string, { correct: number; total: number }>();
  answers.forEach((a) => {
    if (!a.topic) return;
    const e = topicMap.get(a.topic) || { correct: 0, total: 0 };
    topicMap.set(a.topic, { correct: e.correct + (a.correct ? 1 : 0), total: e.total + 1 });
  });
  const weakTopics = [...topicMap.entries()]
    .map(([topic, d]) => ({ topic, accuracy: Math.round((d.correct / d.total) * 100) }))
    .filter((t) => t.accuracy < 50).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

  const avgTime = answers.length > 0
    ? Math.round(answers.reduce((s, a) => s + a.timeSeconds, 0) / answers.length) : 0;

  // Build review items (match answers to questions)
  const reviewItems = answers.map((ans) => ({
    answer: ans,
    question: questions.find((q) => q.id === ans.questionId),
  })).filter((r) => !!r.question);

  const currentReview = reviewItems[reviewIdx];

  return (
    <div className="space-y-5">
      {/* Goal reached banner */}
      {goalReached && (
        <div className="bg-gradient-to-r from-[#16A34A] to-[#15803D] rounded-[14px] p-4 text-white text-center">
          <p className="text-xl font-bold mb-0.5">🎉 Daily Goal Complete!</p>
          <p className="text-white/80 text-sm">You hit your target for today. Great work!</p>
        </div>
      )}

      {/* Score card */}
      <div className="bg-gradient-to-br from-[#1E3A8A] to-[#4F46E5] rounded-[14px] p-6 text-white text-center">
        <Trophy size={32} className="mx-auto mb-3 text-[#FDE68A]" />
        <p className="text-4xl font-bold font-[family-name:var(--font-dm-mono)] mb-1">{stats.score}</p>
        <p className="text-white/70 text-sm">Total Score ({exam} marking)</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-4">
          <p className="text-xl font-bold font-[family-name:var(--font-dm-mono)] text-[#16A34A]">{stats.correct}</p>
          <p className="text-xs text-[#64748B] mt-0.5">Correct</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-xl font-bold font-[family-name:var(--font-dm-mono)] text-[#DC2626]">{stats.wrong}</p>
          <p className="text-xs text-[#64748B] mt-0.5">Wrong</p>
        </Card>
        <Card className="text-center py-4">
          <p className={`text-xl font-bold font-[family-name:var(--font-dm-mono)] ${stats.accuracy >= 70 ? "text-[#16A34A]" : stats.accuracy >= 50 ? "text-[#D97706]" : "text-[#DC2626]"}`}>
            {stats.accuracy}%
          </p>
          <p className="text-xs text-[#64748B] mt-0.5">Accuracy</p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Target size={16} className="text-[#1E3A8A]" />
          <span className="text-sm font-semibold text-[#0F172A]">Session Details</span>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#64748B]">Questions attempted</span>
            <span className="font-medium text-[#0F172A]">{stats.total}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#64748B] flex items-center gap-1.5"><Clock size={13} /> Avg time</span>
            <span className="font-medium font-[family-name:var(--font-dm-mono)] text-[#0F172A]">{avgTime}s</span>
          </div>
        </div>
      </Card>

      {subjectBreakdown.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Subject Breakdown</h3>
          <div className="space-y-3">
            {subjectBreakdown.map((s) => (
              <div key={s.subject}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-[#0F172A]">{s.subject}</span>
                  <span className="text-[#64748B]">{s.correct}/{s.total} · {s.accuracy}%</span>
                </div>
                <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.accuracy >= 70 ? "bg-[#16A34A]" : s.accuracy >= 50 ? "bg-[#D97706]" : "bg-[#DC2626]"}`}
                    style={{ width: `${s.accuracy}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {weakTopics.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Topics to Work On</h3>
          <div className="space-y-2">
            {weakTopics.map((t) => (
              <div key={t.topic} className="flex items-center justify-between">
                <span className="text-sm text-[#0F172A]">{t.topic}</span>
                <Badge variant="error">{t.accuracy}%</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upgrade CTA for free users */}
      {plan === "free" && (
        <div className="bg-[#1E3A8A] rounded-[14px] p-5 text-white text-center">
          <Crown size={22} className="mx-auto mb-2 text-[#FDE68A]" />
          <p className="font-semibold mb-1">Want more practice?</p>
          <p className="text-white/70 text-xs mb-4">Free plan is limited to 15 MCQs/day. Upgrade for unlimited daily practice.</p>
          <Link href="/upgrade"
            className="block w-full py-2.5 rounded-xl bg-white text-[#1E3A8A] font-semibold text-sm hover:bg-[#F8FAFF] transition-all">
            Upgrade to Pro
          </Link>
        </div>
      )}

      {/* Review session questions */}
      {reviewItems.length > 0 && (
        <Card>
          <button
            onClick={() => { setReviewOpen((o) => !o); setReviewIdx(0); setReviewFlipped(false); }}
            className="flex items-center justify-between w-full text-sm font-semibold text-[#0F172A]"
          >
            <span>Review Today&apos;s Questions ({reviewItems.length})</span>
            {reviewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {reviewOpen && currentReview && (
            <div className="mt-4">
              {/* Counter */}
              <p className="text-xs text-center text-[#64748B] mb-3 font-[family-name:var(--font-dm-mono)]">
                {reviewIdx + 1} / {reviewItems.length}
              </p>

              {/* Question / Answer flip card */}
              <div
                className="w-full rounded-[14px] border border-[#E2E8F0] overflow-hidden cursor-pointer select-none"
                onClick={() => setReviewFlipped((f) => !f)}
              >
                {!reviewFlipped ? (
                  <div className={`p-5 ${currentReview.answer.correct ? "bg-[#F0FDF4]" : "bg-[#FEF2F2]"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {currentReview.answer.correct
                        ? <CheckCircle2 size={14} className="text-[#16A34A]" />
                        : <XCircle size={14} className="text-[#DC2626]" />}
                      <span className="text-xs font-semibold text-[#64748B]">{currentReview.question!.subject}</span>
                      {currentReview.question!.topic && <Badge variant="muted">{currentReview.question!.topic}</Badge>}
                    </div>
                    <p className="text-sm font-medium text-[#0F172A] leading-relaxed">{currentReview.question!.question_text}</p>
                    <p className="text-xs text-[#64748B] mt-3 text-center">Tap to see answer</p>
                  </div>
                ) : (
                  <div className="p-5 bg-[#1E3A8A]">
                    <p className="text-xs font-semibold text-white/60 mb-2">Correct Answer: {currentReview.question!.correct_option}</p>
                    <p className="text-sm text-white font-medium leading-relaxed">
                      {currentReview.question![`option_${currentReview.question!.correct_option.toLowerCase()}` as "option_a"]}
                    </p>
                    {currentReview.question!.explanation && (
                      <p className="text-xs text-white/70 mt-3 leading-relaxed">{currentReview.question!.explanation}</p>
                    )}
                    <p className="text-xs text-white/50 mt-3 text-center">Tap to see question</p>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => { setReviewIdx((i) => Math.max(i - 1, 0)); setReviewFlipped(false); }}
                  disabled={reviewIdx === 0}
                  className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-xs text-[#64748B]">{reviewIdx + 1} of {reviewItems.length}</span>
                <button onClick={() => { setReviewIdx((i) => Math.min(i + 1, reviewItems.length - 1)); setReviewFlipped(false); }}
                  disabled={reviewIdx >= reviewItems.length - 1}
                  className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onRestart}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1E3A8A] text-white font-semibold text-sm hover:bg-[#162D6B] transition-all">
          <RotateCcw size={16} /> Practice Again
        </button>
        <Link href="/dashboard"
          className="flex-1 flex items-center justify-center py-3 rounded-xl border border-[#E2E8F0] text-[#0F172A] font-semibold text-sm hover:bg-[#F8FAFF] transition-all">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
