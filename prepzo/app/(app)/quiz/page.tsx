"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuiz } from "@/hooks/useQuiz";
import { TimerRing } from "@/components/quiz/TimerRing";
import { OptionButton } from "@/components/quiz/OptionButton";
import { SessionSummary } from "@/components/quiz/SessionSummary";
import { PaywallModal } from "@/components/payment/PaywallModal";
import { Badge } from "@/components/ui/Badge";
import { QuizSkeleton } from "@/components/ui/Skeleton";
import { getSubjectsForExam } from "@/lib/utils";
import { ChevronRight, Crown, X } from "lucide-react";
import toast from "react-hot-toast";
import type { Profile } from "@/lib/supabase/types";

type QuizState = "setup" | "playing" | "finished";

function getInitialQuizFilters() {
  if (typeof window === "undefined") return { subject: "", topic: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    subject: params.get("subject") || "",
    topic: params.get("topic") || "",
  };
}

export default function QuizPage() {
  const initialFilters = getInitialQuizFilters();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [quizState, setQuizState] = useState<QuizState>("setup");
  const [selectedSubject, setSelectedSubject] = useState<string>(initialFilters.subject);
  const [selectedTopic, setSelectedTopic] = useState<string>(initialFilters.topic);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("profiles").select("*").single().then(({ data }) => {
      setProfile(data);
      setLoadingProfile(false);
    });
  }, []);

  const subjects = getSubjectsForExam(profile?.exam || "NEET");

  const quiz = useQuiz({
    userId: profile?.id || "",
    exam: profile?.exam || "NEET",
    subject: selectedSubject || undefined,
    topic: selectedTopic || undefined,
    plan: profile?.plan || "free",
    dailyGoal: profile?.daily_goal,
  });

  useEffect(() => {
    if (quiz.limitReached) {
      const timer = setTimeout(() => setShowPaywall(true), 0);
      return () => clearTimeout(timer);
    }
  }, [quiz.limitReached]);

  useEffect(() => {
    if (quiz.goalReached && quizState === "playing") {
      const timer = setTimeout(() => {
        quiz.endSession();
        setQuizState("finished");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [quiz.goalReached]); // eslint-disable-line

  useEffect(() => {
    if (quiz.sessionEnded && quizState === "playing") {
      const timer = setTimeout(() => setQuizState("finished"), 0);
      return () => clearTimeout(timer);
    }
  }, [quiz.sessionEnded, quizState]);

  useEffect(() => {
    if (quizState === "playing" && !quiz.loading && !quiz.question) {
      const timer = setTimeout(() => {
        quiz.endSession();
        setQuizState("finished");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [quizState, quiz.loading, quiz.question]); // eslint-disable-line

  function startQuiz() {
    setQuizState("playing");
  }

  function endSession() {
    quiz.endSession();
    setQuizState("finished");
  }

  function restartQuiz() {
    setQuizState("setup");
  }

  if (loadingProfile) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <QuizSkeleton />
      </div>
    );
  }

  // SETUP SCREEN
  if (quizState === "setup") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-6">
          Quiz Mode
        </h1>

        {/* Subject selector */}
        <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-5 mb-4">
          <p className="text-sm font-semibold text-[#0F172A] mb-3">Select Subject</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedSubject("");
                setSelectedTopic("");
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                !selectedSubject ? "bg-[#1E3A8A] text-white" : "bg-[#F8FAFF] border border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
              }`}
            >
              All Subjects
            </button>
            {subjects.map((subject) =>
              profile?.plan === "free" ? (
                <a
                  key={subject}
                  href="/upgrade"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium min-h-[44px] bg-[#F8FAFF] border border-[#E2E8F0] text-[#94A3B8]"
                >
                  <Crown size={12} className="text-[#D97706]" /> {subject}
                </a>
              ) : (
                <button
                  key={subject}
                  onClick={() => {
                    setSelectedSubject(subject);
                    setSelectedTopic("");
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                    selectedSubject === subject ? "bg-[#1E3A8A] text-white" : "bg-[#F8FAFF] border border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                  }`}
                >
                  {subject}
                </button>
              )
            )}
          </div>
          {profile?.plan === "free" && (
            <p className="text-xs text-[#94A3B8] mt-3 flex items-center gap-1">
              <Crown size={11} className="text-[#D97706]" /> Subject-wise MCQs require Pro
            </p>
          )}
        </div>

        {selectedTopic && (
          <div className="bg-[#F8FAFF] border border-[#E2E8F0] rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Targeted practice</p>
            <p className="mt-1 text-sm font-semibold text-[#0F172A]">
              {selectedSubject} · {selectedTopic}
            </p>
          </div>
        )}

        {profile?.plan === "free" && (
          <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4 mb-6">
            <p className="text-sm text-[#D97706] font-medium">
              ⚡ Free plan: 15 questions per day. <a href="/upgrade" className="underline font-semibold">Upgrade for unlimited →</a>
            </p>
          </div>
        )}

        <button
          onClick={startQuiz}
          className="w-full py-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold text-base transition-all flex items-center justify-center gap-2"
        >
          Start Quiz <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  // FINISHED SCREEN
  if (quizState === "finished") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-6">
          Session Complete!
        </h1>
        <SessionSummary
          stats={quiz.stats}
          answers={quiz.answers}
          questions={quiz.questions}
          exam={profile?.exam || "NEET"}
          plan={profile?.plan || "free"}
          goalReached={quiz.goalReached}
          onRestart={restartQuiz}
        />
      </div>
    );
  }

  // PLAYING
  if (quiz.loading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <QuizSkeleton />
      </div>
    );
  }

  if (!quiz.question) return null;

  const { question, selectedOption, answered, timeLeft, stats } = quiz;
  const options = [
    { label: "A", text: question.option_a },
    { label: "B", text: question.option_b },
    { label: "C", text: question.option_c },
    { label: "D", text: question.option_d },
  ];

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Top bar */}
      <div className="flex flex-col gap-3 mb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <Badge variant="primary">{profile?.exam} · {selectedTopic || selectedSubject || "All"}</Badge>
          <div className="flex items-center gap-2 text-sm text-[#64748B]">
            <span>Q {quiz.currentIndex + 1} of {quiz.questions.length}</span>
            <span>• {Math.max(quiz.questions.length - quiz.currentIndex - 1, 0)} left</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#16A34A] font-semibold">✓ {stats.correct}</span>
            <span className="text-[#DC2626] font-semibold">✗ {stats.wrong}</span>
            <span>{stats.accuracy}%</span>
          </div>
          <TimerRing timeLeft={timeLeft} total={30} size={48} />
          <button
            onClick={endSession}
            className="p-2 rounded-xl hover:bg-[#FEE2E2] text-[#64748B] hover:text-[#DC2626] transition-all"
            title="End session"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          {question.topic && <Badge variant="muted">{question.topic}</Badge>}
        </div>
        <p className="text-[#0F172A] font-medium leading-relaxed text-base">
          {question.question_text}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-2.5 mb-4">
        {options.map(({ label, text }) => {
          const isCorrect = answered && label === question.correct_option;
          const isWrong = answered && selectedOption === label && label !== question.correct_option;
          return (
            <OptionButton
              key={label}
              label={label}
              text={text}
              selected={selectedOption === label && !answered}
              correct={isCorrect}
              wrong={isWrong}
              disabled={answered}
              onClick={() => {
                quiz.handleAnswer(label);
                if (label === question.correct_option) {
                  toast.success("Correct! +1 to Recall deck", { duration: 1500 });
                } else {
                  toast.error(`Wrong! Correct: ${question.correct_option}`, { duration: 1500 });
                }
              }}
            />
          );
        })}
      </div>

      {/* Explanation */}
      {answered && question.explanation && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-[#16A34A] mb-1">Explanation</p>
          <p className="text-sm text-[#0F172A] leading-relaxed">{question.explanation}</p>
        </div>
      )}

      {/* Next button */}
      {answered && (
        <button
          onClick={quiz.nextQuestion}
          className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all flex items-center justify-center gap-2"
        >
          {quiz.currentIndex >= quiz.questions.length - 1 ? "Complete Session" : "Next Question"} <ChevronRight size={16} />
        </button>
      )}

      {/* Paywall */}
      <PaywallModal
        open={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          if (quiz.limitReached) {
            quiz.endSession();
            setQuizState("finished");
          }
        }}
      />
    </div>
  );
}
