"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useQuiz } from "@/hooks/useQuiz";
import { TimerRing } from "@/components/quiz/TimerRing";
import { OptionButton } from "@/components/quiz/OptionButton";
import { SessionSummary } from "@/components/quiz/SessionSummary";
import { PaywallModal } from "@/components/payment/PaywallModal";
import { Badge } from "@/components/ui/Badge";
import { QuizSkeleton } from "@/components/ui/Skeleton";
import { getSubjectsForExam } from "@/lib/utils";
import { formatCorrectOptions, isCorrectOption } from "@/lib/answers";
import { AlertTriangle, ChevronLeft, ChevronRight, Crown, Maximize2, Minimize2, X } from "lucide-react";
import toast from "react-hot-toast";
import type { Profile } from "@/lib/supabase/types";

type QuizState = "setup" | "playing" | "finished";
const PYQ_PERMISSION_BARRIER_ENABLED = true;

function getInitialQuizFilters() {
  if (typeof window === "undefined") {
    return {
      subject: "",
      topic: "",
      chapter: "",
      difficulty: "All",
      pyqYear: undefined as number | undefined,
      pyqOnly: false,
      paperMode: false,
      timerSeconds: undefined as number | undefined,
      timerMode: "paper" as "paper" | "question",
      navigationMode: "strict" as "strict" | "flexi",
    };
  }
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("year"));
  const timer = Number(params.get("timer"));
  const timerMode = params.get("timerMode") === "question" ? "question" : "paper";
  return {
    subject: params.get("subject") || "",
    topic: params.get("topic") || "",
    chapter: params.get("chapter") || "",
    difficulty: params.get("difficulty") || "All",
    pyqYear: Number.isFinite(year) && year > 0 ? year : undefined,
    pyqOnly: params.get("pyq") === "true",
    paperMode: params.get("mode") === "paper",
    timerSeconds: Number.isFinite(timer) && timer > 0 ? timer : undefined,
    timerMode,
    navigationMode: params.get("navigation") === "flexi" ? "flexi" : "strict",
  };
}

export default function QuizPage() {
  const initialFilters = getInitialQuizFilters();
  const router = useRouter();
  const isPaperMode = initialFilters.paperMode && initialFilters.pyqOnly && Boolean(initialFilters.pyqYear);
  const isFlexiPaper = isPaperMode && initialFilters.navigationMode === "flexi";
  const isQuestionTimedPaper = isPaperMode && !isFlexiPaper && initialFilters.timerMode === "question";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [quizState, setQuizState] = useState<QuizState>(isPaperMode ? "playing" : "setup");
  const [selectedSubject, setSelectedSubject] = useState<string>(initialFilters.subject);
  const [selectedTopic, setSelectedTopic] = useState<string>(initialFilters.topic);
  const [selectedChapter, setSelectedChapter] = useState<string>(initialFilters.chapter);
  const [selectedDifficulty] = useState<string>(initialFilters.difficulty);
  const [paperTimerSeconds] = useState<number>(initialFilters.timerSeconds || 180 * 60);
  const [paperTimeLeft, setPaperTimeLeft] = useState<number>(initialFilters.timerSeconds || 180 * 60);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showUnattemptedWarning, setShowUnattemptedWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const quizShellRef = useRef<HTMLDivElement | null>(null);
  const paperWarningMarksShown = useRef(new Set<number>());

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
    chapter: selectedChapter || undefined,
    difficulty: selectedDifficulty,
    pyqYear: initialFilters.pyqYear,
    pyqOnly: initialFilters.pyqOnly,
    fullPaper: isPaperMode,
    sessionLimit: isPaperMode ? 180 : undefined,
    timerDurationSeconds: isQuestionTimedPaper ? paperTimerSeconds : undefined,
    autoAdvanceOnTimeout: isQuestionTimedPaper,
    autoAdvanceOnAnswer: isFlexiPaper,
    autoAdvanceDelayMs: 15 * 1000,
    autoEndFullPaperOnLastAnswer: !isFlexiPaper,
    disableQuestionTimer: isPaperMode && !isQuestionTimedPaper,
    plan: profile?.plan || "free",
    dailyGoal: profile?.daily_goal,
  });

  const answeredQuestionIds = useMemo(
    () => new Set(quiz.answers.filter((answer) => !answer.skipped).map((answer) => answer.questionId)),
    [quiz.answers]
  );
  const skippedQuestionIds = useMemo(
    () => new Set(quiz.answers.filter((answer) => answer.skipped).map((answer) => answer.questionId)),
    [quiz.answers]
  );
  const unattemptedIndexes = useMemo(
    () => quiz.questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => !answeredQuestionIds.has(question.id)),
    [answeredQuestionIds, quiz.questions]
  );
  const paperSubjects = useMemo(
    () => Array.from(new Set(quiz.questions.map((question) => question.subject).filter(Boolean))),
    [quiz.questions]
  );

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
    if (!isPaperMode && quizState === "playing" && !quiz.loading && !quiz.question) {
      const timer = setTimeout(() => {
        quiz.endSession();
        setQuizState("finished");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [quizState, quiz.loading, quiz.question]); // eslint-disable-line

  useEffect(() => {
    if (!isPaperMode || isQuestionTimedPaper || quizState !== "playing" || quiz.sessionEnded) return;
    const timer = setInterval(() => {
      setPaperTimeLeft((time) => {
        if (time <= 1) {
          clearInterval(timer);
          quiz.endSessionWithUnattempted();
          setQuizState("finished");
          return 0;
        }
        return time - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaperMode, isQuestionTimedPaper, paperTimerSeconds, quizState]); // eslint-disable-line

  useEffect(() => {
    if (!isPaperMode || isQuestionTimedPaper || quizState !== "playing" || quiz.sessionEnded) return;

    const warningMarks = [
      { remaining: paperTimerSeconds - 60 * 60, message: "1 hour completed" },
      { remaining: paperTimerSeconds - 90 * 60, message: "90 minutes completed" },
      { remaining: paperTimerSeconds - 120 * 60, message: "2 hours completed" },
      { remaining: paperTimerSeconds - 150 * 60, message: "150 minutes completed" },
      { remaining: 10 * 60, message: "10 minutes left" },
      { remaining: 5 * 60, message: "5 minutes left" },
    ].filter((mark) => mark.remaining > 0 && mark.remaining < paperTimerSeconds);

    const mark = warningMarks.find(({ remaining }) => paperTimeLeft === remaining);
    if (!mark || paperWarningMarksShown.current.has(mark.remaining)) return;

    paperWarningMarksShown.current.add(mark.remaining);
    toast(mark.message, {
      duration: 4500,
    });
  }, [isPaperMode, isQuestionTimedPaper, paperTimeLeft, paperTimerSeconds, quiz.sessionEnded, quizState]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === quizShellRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function startQuiz() {
    if (isPaperMode) setPaperTimeLeft(paperTimerSeconds);
    paperWarningMarksShown.current.clear();
    setQuizState("playing");
  }

  function submitFlexiPaper() {
    if (unattemptedIndexes.length > 0) {
      setShowUnattemptedWarning(true);
      return;
    }
    quiz.endSessionWithUnattempted();
    setQuizState("finished");
  }

  function reviewUnattemptedQuestions() {
    const firstUnattempted = unattemptedIndexes[0];
    setShowUnattemptedWarning(false);
    if (firstUnattempted) quiz.jumpToQuestion(firstUnattempted.index);
  }

  function submitPaperAnyway() {
    setShowUnattemptedWarning(false);
    quiz.endSessionWithUnattempted();
    setQuizState("finished");
  }

  async function toggleFullscreen() {
    if (!quizShellRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await quizShellRef.current.requestFullscreen();
  }

  function endSession() {
    if (isFlexiPaper) {
      submitFlexiPaper();
      return;
    }
    if (isPaperMode) {
      quiz.endSessionWithUnattempted();
    } else {
      quiz.endSession();
    }
    setQuizState("finished");
  }

  function restartQuiz() {
    if (isPaperMode) {
      router.push("/pyq");
      return;
    }
    setQuizState("setup");
  }

  async function startNewSession() {
    await quiz.startNewSession();
    setQuizState("playing");
  }

  if (loadingProfile) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <QuizSkeleton />
      </div>
    );
  }

  if (initialFilters.pyqOnly && PYQ_PERMISSION_BARRIER_ENABLED) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="rounded-[14px] border border-[#FDE68A] bg-[#FFFBEB] p-6 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#92400E]">
            PYQ practice coming soon
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#92400E]">
            We are preparing PYQ filters, analysis, and full-paper practice for release after usage terms are finalized
          </p>
          <button
            type="button"
            onClick={() => router.push("/pyq")}
            className="mt-4 min-h-[44px] rounded-xl bg-[#1E3A8A] px-5 text-sm font-semibold text-white hover:bg-[#162D6B]"
          >
            Back to PYQ coming soon
          </button>
        </div>
      </div>
    );
  }

  // SETUP SCREEN
  if (quizState === "setup") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-6">
          {isPaperMode ? `NEET ${initialFilters.pyqYear} Paper` : "Quiz Mode"}
        </h1>

        {/* Subject selector */}
        {!isPaperMode && <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-5 mb-4">
          <p className="text-sm font-semibold text-[#0F172A] mb-3">Select Subject</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedSubject("");
                setSelectedTopic("");
                setSelectedChapter("");
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
                    setSelectedChapter("");
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
        </div>}

        {(selectedTopic || selectedChapter || initialFilters.pyqOnly) && (
          <div className="bg-[#F8FAFF] border border-[#E2E8F0] rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            {initialFilters.pyqOnly ? "PYQ practice coming soon" : "Targeted practice"}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#0F172A]">
              {[selectedSubject, selectedChapter, selectedTopic, selectedDifficulty !== "All" ? selectedDifficulty : "", initialFilters.pyqYear ? `PYQ ${initialFilters.pyqYear} coming soon` : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        )}

        {profile?.plan === "free" && !isPaperMode && (
          <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4 mb-6">
            <p className="text-sm text-[#D97706] font-medium">
              ⚡ Free plan: 15 questions per day. <a href="/upgrade" className="underline font-semibold">Upgrade for full access →</a>
            </p>
          </div>
        )}

        <button
          onClick={startQuiz}
          className="w-full py-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold text-base transition-all flex items-center justify-center gap-2"
        >
          {isPaperMode ? "Start Full Paper" : "Start Quiz"} <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  // FINISHED SCREEN
  if (quizState === "finished") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-6">
          {profile?.plan === "paid" ? "Session Done!" : "Session Complete!"}
        </h1>
        <SessionSummary
          stats={quiz.stats}
          answers={quiz.answers}
          questions={quiz.questions}
          exam={profile?.exam || "NEET"}
          plan={profile?.plan || "free"}
          goalReached={quiz.goalReached}
          isPyq={initialFilters.pyqOnly}
          onRestart={restartQuiz}
          onStartNewSession={startNewSession}
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
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-6 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
            No PYQ questions found yet
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">
            PYQ practice is coming soon.
          </p>
          <button
            type="button"
            onClick={restartQuiz}
            className="mt-4 min-h-[44px] rounded-xl bg-[#1E3A8A] px-5 text-sm font-semibold text-white hover:bg-[#162D6B]"
          >
            Back to setup
          </button>
        </div>
      </div>
    );
  }

  const { question, selectedOption, answered, timeLeft, stats } = quiz;
  const activeSubject = question.subject;
  const subjectQuestionIndexes = quiz.questions
    .map((item, index) => ({ question: item, index }))
    .filter(({ question: item }) => item.subject === activeSubject);
  const options = [
    { label: "A", text: question.option_a, imageUrl: question.option_a_image_url },
    { label: "B", text: question.option_b, imageUrl: question.option_b_image_url },
    { label: "C", text: question.option_c, imageUrl: question.option_c_image_url },
    { label: "D", text: question.option_d, imageUrl: question.option_d_image_url },
  ];
  const correctOptionsText = formatCorrectOptions(question.correct_option);
  const questionIntroText = (question.question_text_before_image || question.question_text)?.trim();
  const visibleQuestionIntro =
    question.question_inline_image_url && questionIntroText === "[See question image]" ? "" : questionIntroText;
  const handleOptionSelect = (label: string) => {
    quiz.handleAnswer(label);
    if (isCorrectOption(label, question.correct_option)) {
      toast.success("Correct! Review for 15 seconds", { duration: 1800 });
    } else {
      toast.error(`Wrong! Correct: ${correctOptionsText}`, { duration: 2200 });
    }
  };

  return (
    <div
      ref={quizShellRef}
      className={`mx-auto bg-[#F8FAFF] p-4 md:p-8 ${
        isFullscreen
          ? "h-screen max-w-none overflow-y-auto"
          : isFlexiPaper
            ? "max-w-7xl"
            : "max-w-2xl"
      }`}
    >
      {/* Top bar */}
      <div className="flex flex-col gap-3 mb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <Badge variant="primary">
            {profile?.exam} · {initialFilters.pyqOnly ? "PYQ coming soon" : selectedTopic || selectedChapter || selectedSubject || "All"}
          </Badge>
          <div className="flex items-center gap-2 text-sm text-[#64748B]">
            <span>Question {quiz.currentIndex + 1} of {quiz.sessionLimit}</span>
            <span>• {Math.max(quiz.sessionLimit - quiz.currentIndex - 1, 0)} left</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#16A34A] font-semibold">✓ {stats.correct}</span>
            <span className="text-[#DC2626] font-semibold">✗ {stats.wrong}</span>
            <span>{stats.accuracy}%</span>
          </div>
          <TimerRing
            timeLeft={isPaperMode && !isQuestionTimedPaper ? paperTimeLeft : timeLeft}
            total={isPaperMode && !isQuestionTimedPaper ? paperTimerSeconds : quiz.timerDuration}
            size={48}
          />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#CBD5E1] bg-white text-[#1E3A8A] transition-all hover:border-[#1E3A8A] hover:bg-[#DBEAFE]"
            title={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          {isFlexiPaper && (
            <button
              type="button"
              onClick={submitFlexiPaper}
              className="min-h-[42px] rounded-xl bg-[#1E3A8A] px-4 text-sm font-semibold text-white transition-all hover:bg-[#162D6B]"
            >
              Submit
            </button>
          )}
          <button
            onClick={endSession}
            className="p-2 rounded-xl hover:bg-[#FEE2E2] text-[#64748B] hover:text-[#DC2626] transition-all"
            title="End session"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {isFlexiPaper ? (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-[var(--shadow-card)] lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <div className="mb-4">
              <p className="text-sm font-bold text-[#0F172A]">Question Navigator</p>
              <p className="mt-1 text-xs text-[#64748B]">Switch subjects or jump to any question</p>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {paperSubjects.map((subject) => {
                const firstIndex = quiz.questions.findIndex((item) => item.subject === subject);
                const subjectTotal = quiz.questions.filter((item) => item.subject === subject).length;
                const subjectAnswered = quiz.questions.filter((item) => item.subject === subject && answeredQuestionIds.has(item.id)).length;
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => quiz.jumpToQuestion(firstIndex)}
                    className={`min-h-[34px] shrink-0 rounded-full border px-3 text-xs font-bold transition-all ${
                      activeSubject === subject
                        ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                        : "border-[#E2E8F0] bg-[#F8FAFF] text-[#475569] hover:border-[#3B5FBF]"
                    }`}
                  >
                    {subject} {subjectAnswered}/{subjectTotal}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-5 gap-2">
              {subjectQuestionIndexes.map(({ question: item, index }) => {
                const isCurrent = index === quiz.currentIndex;
                const isAnswered = answeredQuestionIds.has(item.id);
                const isSkipped = skippedQuestionIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => quiz.jumpToQuestion(index)}
                    className={`h-10 rounded-lg border text-xs font-bold transition-all ${
                      isAnswered
                        ? "border-[#16A34A] bg-[#DCFCE7] text-[#166534]"
                        : isSkipped
                          ? "border-[#F59E0B] bg-[#FEF3C7] text-[#92400E]"
                          : "border-[#CBD5E1] bg-white text-[#475569] hover:border-[#3B5FBF]"
                    } ${isCurrent ? "ring-2 ring-[#F59E0B] ring-offset-1" : ""}`}
                    title={`Question ${index + 1}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-2 text-xs text-[#64748B]">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-[#16A34A] bg-[#DCFCE7]" />Answered</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-[#F59E0B] bg-[#FEF3C7]" />Not attempted</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-[#CBD5E1] bg-white" />Unanswered</div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[14px] border border-[#E2E8F0] bg-white p-3 shadow-[var(--shadow-card)]">
              <button
                type="button"
                onClick={quiz.previousQuestion}
                disabled={quiz.currentIndex <= 0}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#CBD5E1] bg-white text-[#1E3A8A] transition-all hover:border-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-40"
                title="Previous question"
              >
                <ChevronLeft size={18} />
              </button>
              <p className="text-center text-sm font-semibold text-[#0F172A]">
                Question {quiz.currentIndex + 1}
              </p>
              <div className="flex items-center gap-2">
                {!answered && (
                  <button
                    type="button"
                    onClick={() => {
                      quiz.markNotAttempted();
                      toast("Marked not attempted", { duration: 1600 });
                    }}
                    className="min-h-[42px] rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#64748B] transition-all hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
                  >
                    Not Attempted
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (quiz.currentIndex >= quiz.questions.length - 1) {
                      submitFlexiPaper();
                      return;
                    }
                    quiz.nextQuestion();
                  }}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#CBD5E1] bg-white text-[#1E3A8A] transition-all hover:border-[#1E3A8A]"
                  title="Next question"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                {question.pyq_year && <Badge variant="warning">PYQ {question.pyq_year} coming soon</Badge>}
                {question.chapter && <Badge variant="primary">{question.chapter}</Badge>}
                {question.topic && <Badge variant="muted">{question.topic}</Badge>}
              </div>
              <div className="space-y-3 text-[#0F172A] font-medium leading-relaxed text-base">
                {visibleQuestionIntro && <p>{visibleQuestionIntro}</p>}
                {question.question_inline_image_url && (
                  <img
                    src={question.question_inline_image_url}
                    alt="Question diagram"
                    className="max-h-[420px] w-auto max-w-full rounded-lg border border-[#E2E8F0] bg-white object-contain"
                  />
                )}
                {question.question_text_after_image && <p>{question.question_text_after_image}</p>}
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              {options.map(({ label, text, imageUrl }) => {
                const isCorrect = answered && isCorrectOption(label, question.correct_option);
                const isWrong = answered && selectedOption === label && !isCorrectOption(label, question.correct_option);
                return (
                  <OptionButton
                    key={label}
                    label={label}
                    text={text}
                    imageUrl={imageUrl}
                    selected={selectedOption === label && !answered}
                    correct={isCorrect}
                    wrong={isWrong}
                    disabled={answered}
                    onClick={() => handleOptionSelect(label)}
                  />
                );
              })}
            </div>

            {answered && question.explanation && (
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-[#16A34A] mb-1">Explanation</p>
                <p className="text-sm text-[#0F172A] leading-relaxed">{question.explanation}</p>
              </div>
            )}
          </main>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              {question.pyq_year && <Badge variant="warning">PYQ {question.pyq_year} coming soon</Badge>}
              {question.chapter && <Badge variant="primary">{question.chapter}</Badge>}
              {question.topic && <Badge variant="muted">{question.topic}</Badge>}
            </div>
            <div className="space-y-3 text-[#0F172A] font-medium leading-relaxed text-base">
              {visibleQuestionIntro && <p>{visibleQuestionIntro}</p>}
              {question.question_inline_image_url && (
                <img
                  src={question.question_inline_image_url}
                  alt="Question diagram"
                  className="max-h-[420px] w-auto max-w-full rounded-lg border border-[#E2E8F0] bg-white object-contain"
                />
              )}
              {question.question_text_after_image && <p>{question.question_text_after_image}</p>}
            </div>
          </div>

          <div className="space-y-2.5 mb-4">
            {options.map(({ label, text, imageUrl }) => {
              const isCorrect = answered && isCorrectOption(label, question.correct_option);
              const isWrong = answered && selectedOption === label && !isCorrectOption(label, question.correct_option);
              return (
                <OptionButton
                  key={label}
                  label={label}
                  text={text}
                  imageUrl={imageUrl}
                  selected={selectedOption === label && !answered}
                  correct={isCorrect}
                  wrong={isWrong}
                  disabled={answered}
                  onClick={() => handleOptionSelect(label)}
                />
              );
            })}
          </div>

          {answered && question.explanation && (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-[#16A34A] mb-1">Explanation</p>
              <p className="text-sm text-[#0F172A] leading-relaxed">{question.explanation}</p>
            </div>
          )}

          {isPaperMode && !answered && (
            <button
              type="button"
              onClick={() => {
                quiz.markNotAttempted();
                toast("Marked not attempted", { duration: 1600 });
              }}
              className="w-full py-3.5 rounded-xl border border-[#CBD5E1] bg-white text-[#64748B] font-semibold transition-all hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
            >
              Mark Not Attempted
            </button>
          )}

          {answered && (
            <button
              onClick={quiz.nextQuestion}
              className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all flex items-center justify-center gap-2"
            >
              {quiz.currentIndex >= quiz.questions.length - 1 ? "Finish Session" : "Next Question"} <ChevronRight size={16} />
            </button>
          )}
        </>
      )}

      {showUnattemptedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4">
          <div className="w-full max-w-lg rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FEF3C7] text-[#B45309]">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Some questions are unattempted</h2>
                <p className="mt-1 text-sm text-[#64748B]">
                  {unattemptedIndexes.length} questions are still unanswered. You can attempt them now or submit anyway.
                </p>
              </div>
            </div>
            <div className="mb-4 max-h-36 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Unattempted questions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unattemptedIndexes.map(({ index }) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setShowUnattemptedWarning(false);
                      quiz.jumpToQuestion(index);
                    }}
                    className="h-8 min-w-8 rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs font-bold text-[#475569] hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={reviewUnattemptedQuestions}
                className="min-h-[44px] rounded-xl border border-[#1E3A8A] px-4 text-sm font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE]"
              >
                Attempt Them
              </button>
              <button
                type="button"
                onClick={submitPaperAnyway}
                className="min-h-[44px] rounded-xl bg-[#1E3A8A] px-4 text-sm font-semibold text-white hover:bg-[#162D6B]"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
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
