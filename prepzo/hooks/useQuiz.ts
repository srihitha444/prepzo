"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPrioritizedQuestions, getTodayQuestionCount, recordAnswer, FREE_DAILY_LIMIT, PRO_SESSION_LIMIT } from "@/lib/questions";
import { isCorrectOption } from "@/lib/answers";
import { getISTDate } from "@/lib/utils";
import type { Question } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";

interface UseQuizOptions {
  userId: string;
  exam: string;
  subject?: string;
  topic?: string;
  chapter?: string;
  difficulty?: string;
  pyqYear?: number;
  pyqOnly?: boolean;
  fullPaper?: boolean;
  sessionLimit?: number;
  timerDurationSeconds?: number;
  autoAdvanceOnTimeout?: boolean;
  autoAdvanceOnAnswer?: boolean;
  autoAdvanceDelayMs?: number;
  autoEndFullPaperOnLastAnswer?: boolean;
  disableQuestionTimer?: boolean;
  plan: "free" | "paid";
  dailyGoal?: number;
}

interface AnswerRecord {
  questionId: string;
  correct: boolean;
  skipped: boolean;
  selectedOption: string | null;
  timeSeconds: number;
  topic: string | null;
  subject: string;
}

function getMcqRecallFrequency(): "daily" | "every2days" | "weekly" {
  try {
    const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
    return prefs.mcqRecallFrequency || prefs.recallFrequency || "daily";
  } catch {
    return "daily";
  }
}

function getMcqSessionGoal(plan: "free" | "paid", dailyGoal?: number): number {
  if (plan === "free") return FREE_DAILY_LIMIT;
  try {
    const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
    const savedGoal = Number(prefs.mcqDailyGoal);
    if (Number.isFinite(savedGoal) && savedGoal > 0) return savedGoal;
  } catch {}
  return dailyGoal && dailyGoal > 0 ? dailyGoal : PRO_SESSION_LIMIT;
}

export function useQuiz({
  userId,
  exam,
  subject,
  topic,
  chapter,
  difficulty,
  pyqYear,
  pyqOnly,
  fullPaper = false,
  sessionLimit,
  timerDurationSeconds,
  autoAdvanceOnTimeout = false,
  autoAdvanceOnAnswer = false,
  autoAdvanceDelayMs = 250,
  autoEndFullPaperOnLastAnswer = true,
  disableQuestionTimer = false,
  plan,
  dailyGoal,
}: UseQuizOptions) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [goalReached, setGoalReached] = useState(false);

  const mcqTimerDuration = (() => {
    if (timerDurationSeconds && timerDurationSeconds > 0) return timerDurationSeconds;
    try {
      const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
      return typeof prefs.mcqTimer === "number" ? prefs.mcqTimer : 30;
    } catch { return 30; }
  })();
  const [timeLeft, setTimeLeft] = useState(mcqTimerDuration);
  const [questionStartTime, setQuestionStartTime] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSkipRef = useRef<() => Promise<void>>(async () => {});
  const answersRef = useRef<AnswerRecord[]>([]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const duration = (() => {
      if (timerDurationSeconds && timerDurationSeconds > 0) return timerDurationSeconds;
      try {
        const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
        return typeof prefs.mcqTimer === "number" ? prefs.mcqTimer : 30;
      } catch { return 30; }
    })();
    setTimeLeft(duration);
    setQuestionStartTime(Date.now());
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          void autoSkipRef.current();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [timerDurationSeconds]);

  const loadQuestions = useCallback(async () => {
    if (!userId) {
      setLoading(true);
      return;
    }

    setLoading(true);

    let limit = fullPaper ? sessionLimit || 180 : getMcqSessionGoal(plan, dailyGoal);
    if (plan === "free" && !fullPaper) {
      const count = await getTodayQuestionCount(userId, exam);
      limit = Math.max(0, FREE_DAILY_LIMIT - count);
      if (limit <= 0) {
        setQuestions([]);
        setLimitReached(true);
        setLoading(false);
        return;
      }
    }

    const newQuestions = await fetchPrioritizedQuestions({
      userId,
      exam,
      subject,
      topic,
      chapter,
      difficulty,
      pyqYear,
      pyqOnly,
      limit,
      seenIds: [],
      plan,
      fullPaper,
    });

    setQuestions(newQuestions);
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setAnswers([]);
    setSessionEnded(false);
    setGoalReached(false);
    setLoading(false);
  }, [userId, exam, subject, topic, chapter, difficulty, pyqYear, pyqOnly, fullPaper, sessionLimit, plan, dailyGoal]);

  useEffect(() => {
    const init = async () => {
      if (!userId) return;
      if (plan === "free" && !fullPaper) {
        const count = await getTodayQuestionCount(userId, exam);
        if (count >= FREE_DAILY_LIMIT) {
          setLimitReached(true);
          setLoading(false);
          return;
        }
      }
      await loadQuestions();
    };
    init();
  }, [plan, pyqOnly, pyqYear, userId, loadQuestions, fullPaper, exam]);

  useEffect(() => {
    if (!disableQuestionTimer && !loading && questions.length > 0 && !sessionEnded) {
      const timer = setTimeout(() => startTimer(), 0);
      return () => {
        clearTimeout(timer);
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIndex, disableQuestionTimer, loading, questions.length, sessionEnded, startTimer]);

  async function recordCurrentAnswer(option: string | null) {
    const question = questions[currentIndex];
    if (!question) return null;

    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    const isCorrect = isCorrectOption(option, question.correct_option);

    await recordAnswer({
      userId,
      questionId: question.id,
      isCorrect,
      timeSeconds: elapsed,
      recallFrequency: getMcqRecallFrequency(),
      isPyq: Boolean(pyqOnly),
      pyqYear,
      selectedOption: option,
      skipped: option === null,
    });

    return {
      questionId: question.id,
      correct: isCorrect,
      skipped: option === null,
      selectedOption: option,
      timeSeconds: elapsed,
      topic: question.topic,
      subject: question.subject,
    };
  }

  async function handleAutoSkip() {
    if (!answered && questions[currentIndex]) {
      if (timerRef.current) clearInterval(timerRef.current);
      const answer = await recordCurrentAnswer(null);
      const nextAnswers = answer ? [...answers, answer] : answers;
      if (answer) setAnswers(nextAnswers);
      setSelectedOption(null);

      if (autoAdvanceOnTimeout) {
        if (currentIndex >= questions.length - 1) {
          await endSession(nextAnswers);
          return;
        }
        setAnswered(false);
        setCurrentIndex((i) => i + 1);
        return;
      }

      setAnswered(true);
    }
  }

  useEffect(() => {
    autoSkipRef.current = handleAutoSkip;
  });

  async function handleAnswer(option: string) {
    if (answered) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    setSelectedOption(option);
    setAnswered(true);

    // Check daily limit for free users
    if (plan === "free" && !fullPaper) {
      const count = await getTodayQuestionCount(userId, exam);
      if (count >= FREE_DAILY_LIMIT) {
        setLimitReached(true);
        return;
      }
    }

    const answer = await recordCurrentAnswer(option);
    if (!answer) return;

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (fullPaper && autoEndFullPaperOnLastAnswer && currentIndex >= questions.length - 1) {
      await endSession(newAnswers);
      return;
    }

    if (autoAdvanceOnAnswer && currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestion = questions[nextIndex];
      const existing = newAnswers.find((item) => item.questionId === nextQuestion.id);
      autoAdvanceRef.current = setTimeout(() => {
        setSelectedOption(existing?.selectedOption || null);
        setAnswered(Boolean(existing));
        setQuestionStartTime(Date.now());
        setCurrentIndex(nextIndex);
      }, autoAdvanceDelayMs);
    }

    const sessionTarget = fullPaper ? questions.length : plan === "paid" ? getMcqSessionGoal(plan, dailyGoal) : dailyGoal;
    if (sessionTarget && newAnswers.length >= sessionTarget) {
      setGoalReached(true);
    }
  }

  async function markNotAttempted() {
    if (answered) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    setSelectedOption(null);
    setAnswered(true);

    const answer = await recordCurrentAnswer(null);
    if (!answer) return;

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (autoAdvanceOnAnswer && currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestion = questions[nextIndex];
      const existing = newAnswers.find((item) => item.questionId === nextQuestion.id);
      autoAdvanceRef.current = setTimeout(() => {
        setSelectedOption(existing?.selectedOption || null);
        setAnswered(Boolean(existing));
        setQuestionStartTime(Date.now());
        setCurrentIndex(nextIndex);
      }, autoAdvanceDelayMs);
    }
  }

  async function nextQuestion() {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    if (currentIndex >= questions.length - 1) {
      await endSession();
      return;
    }
    jumpToQuestion(currentIndex + 1);
  }

  function previousQuestion() {
    if (currentIndex <= 0) return;
    jumpToQuestion(currentIndex - 1);
  }

  function jumpToQuestion(index: number) {
    if (index < 0 || index >= questions.length) return;
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    const question = questions[index];
    const existing = answersRef.current.find((answer) => answer.questionId === question.id);
    setSelectedOption(existing?.selectedOption || null);
    setAnswered(Boolean(existing));
    setQuestionStartTime(Date.now());
    setCurrentIndex(index);
  }

  async function endSession(finalAnswers = answersRef.current) {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setSessionEnded(true);

    const supabase = createClient();
    const correct = finalAnswers.filter((a) => a.correct).length;
    const skipped = finalAnswers.filter((a) => a.skipped).length;
    const wrong = finalAnswers.filter((a) => !a.correct && !a.skipped).length;
    const avgTime = finalAnswers.length > 0
      ? Math.round(finalAnswers.reduce((s, a) => s + a.timeSeconds, 0) / finalAnswers.length)
      : 0;

    await supabase.from("quiz_sessions").insert({
      user_id: userId, exam, subject: subject || null,
      topic: topic || null,
      is_pyq: Boolean(pyqOnly),
      pyq_year: pyqYear || null,
      total_questions: finalAnswers.length, correct, wrong,
      skipped,
      avg_time_seconds: avgTime,
    });

    // Streak update (IST-aware)
    const today = getISTDate();
    const yesterday = (() => {
      const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    })();

    const { data: profileData } = await supabase
      .from("profiles").select("streak, last_active").eq("id", userId).single();

    let newStreak = 1;
    if (profileData?.last_active === today) newStreak = profileData.streak ?? 1;
    else if (profileData?.last_active === yesterday) newStreak = (profileData.streak ?? 0) + 1;

    await supabase.from("profiles")
      .update({ last_active: today, streak: newStreak })
      .eq("id", userId);
  }

  async function endSessionWithUnattempted() {
    const existing = answersRef.current;
    const answeredIds = new Set(existing.map((answer) => answer.questionId));
    const skippedAnswers: AnswerRecord[] = questions
      .filter((question) => !answeredIds.has(question.id))
      .map((question, index) => ({
        questionId: question.id,
        correct: false,
        skipped: true,
        selectedOption: null,
        timeSeconds: index === 0 ? Math.max(0, Math.round((Date.now() - questionStartTime) / 1000)) : 0,
        topic: question.topic,
        subject: question.subject,
      }));

    await Promise.all(
      skippedAnswers.map((answer) =>
        recordAnswer({
          userId,
          questionId: answer.questionId,
          isCorrect: false,
          timeSeconds: answer.timeSeconds,
          recallFrequency: getMcqRecallFrequency(),
          isPyq: Boolean(pyqOnly),
          pyqYear,
          selectedOption: null,
          skipped: true,
        })
      )
    );

    const finalAnswers = [...existing, ...skippedAnswers];
    setAnswers(finalAnswers);
    await endSession(finalAnswers);
  }

  async function startNewSession() {
    if (timerRef.current) clearInterval(timerRef.current);
    await loadQuestions();
  }

  const currentQuestion = questions[currentIndex] || null;
  const correct = answers.filter((a) => a.correct).length;
  const skipped = answers.filter((a) => a.skipped).length;
  const wrong = answers.filter((a) => !a.correct && !a.skipped).length;
  const accuracy = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;
  const negativeMarking = 1 / 3;
  const score = correct * 4 - wrong * negativeMarking;

  return {
    question: currentQuestion,
    questions,
    currentIndex,
    selectedOption,
    answered,
    loading,
    sessionEnded,
    limitReached,
    goalReached,
    timeLeft,
    timerDuration: mcqTimerDuration,
    answers,
    stats: { correct, wrong, skipped, accuracy, score: Math.round(score * 100) / 100, total: answers.length },
    sessionLimit: fullPaper ? questions.length || sessionLimit || 180 : plan === "paid" ? getMcqSessionGoal(plan, dailyGoal) : Math.min(FREE_DAILY_LIMIT, questions.length || FREE_DAILY_LIMIT),
    handleAnswer,
    markNotAttempted,
    nextQuestion,
    previousQuestion,
    jumpToQuestion,
    endSession,
    endSessionWithUnattempted,
    startNewSession,
  };
}
