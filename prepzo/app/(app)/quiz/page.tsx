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

export default function QuizPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [quizState, setQuizState] = useState<QuizState>("setup");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("All");
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("profiles").select("*").single().then(({ data }) => {
      setProfile(data);
      setLoadingProfile(false);
    });
  }, []);

  const subjects = profile?.exam ? getSubjectsForExam(profile.exam) : [];

  const quiz = useQuiz({
    userId: profile?.id || "",
    exam: profile?.exam || "JEE",
    subject: selectedSubject || undefined,
    difficulty: selectedDifficulty,
    plan: profile?.plan || "free",
    dailyGoal: profile?.daily_goal,
  });

  useEffect(() => {
    if (quiz.limitReached) setShowPaywall(true);
  }, [quiz.limitReached]);

  useEffect(() => {
    if (quiz.goalReached && quizState === "playing") {
      quiz.endSession();
      setQuizState("finished");
    }
  }, [quiz.goalReached]); // eslint-disable-line

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
              onClick={() => setSelectedSubject("")}
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
          {profile?.plan === "free" && (
            <p className="text-xs text-[#94A3B8] mt-3 flex items-center gap-1">
              <Crown size={11} className="text-[#D97706]" /> Subject-wise MCQs require Pro
            </p>
          )}
        </div>

        {/* Difficulty selector */}
        <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-5 mb-6">
          <p className="text-sm font-semibold text-[#0F172A] mb-3">Difficulty</p>
          <div className="flex gap-2">
            {["All", "Easy", "Medium", "Hard"].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDifficulty(d)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                  selectedDifficulty === d ? "bg-[#1E3A8A] text-white" : "bg-[#F8FAFF] border border-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

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
          exam={profile?.exam || "JEE"}
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

  if (!quiz.question) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto text-center py-16">
        <p className="text-[#64748B] text-lg mb-4">No questions found for this selection.</p>
        <button onClick={restartQuiz} className="px-6 py-3 rounded-xl bg-[#1E3A8A] text-white font-semibold">
          Go Back
        </button>
      </div>
    );
  }

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
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Badge variant="primary">{profile?.exam} · {selectedSubject || "All"}</Badge>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#16A34A] font-semibold">✓ {stats.correct}</span>
            <span className="text-[#DC2626] font-semibold">✗ {stats.wrong}</span>
            <span className="text-[#64748B]">{stats.accuracy}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {question.difficulty && (
            <Badge variant={question.difficulty === "Easy" ? "success" : question.difficulty === "Hard" ? "error" : "warning"}>
              {question.difficulty}
            </Badge>
          )}
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
          Next Question <ChevronRight size={16} />
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
