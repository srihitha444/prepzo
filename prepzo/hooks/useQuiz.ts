"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPrioritizedQuestions, getTodayQuestionCount, recordAnswer, FREE_DAILY_LIMIT } from "@/lib/questions";
import { getISTDate } from "@/lib/utils";
import type { Question } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";

interface UseQuizOptions {
  userId: string;
  exam: string;
  subject?: string;
  topic?: string;
  plan: "free" | "paid";
  dailyGoal?: number;
}

interface AnswerRecord {
  questionId: string;
  correct: boolean;
  skipped: boolean;
  timeSeconds: number;
  topic: string | null;
  subject: string;
}

const DAILY_MCQ_KEY = "prepzo_daily_mcqs";

function getMcqRecallFrequency(): "daily" | "every2days" | "weekly" {
  try {
    const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
    return prefs.mcqRecallFrequency || prefs.recallFrequency || "daily";
  } catch {
    return "daily";
  }
}

function getDailySession(exam: string, subject?: string, topic?: string): { ids: string[] } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_MCQ_KEY) || "{}");
    const key = `${exam}:${subject || ""}:${topic || ""}`;
    if (raw.date === getISTDate() && raw[key]) return { ids: raw[key] };
    return null;
  } catch { return null; }
}

function saveDailySession(exam: string, subject: string | undefined, topic: string | undefined, ids: string[]) {
  try {
    const key = `${exam}:${subject || ""}:${topic || ""}`;
    const existing = JSON.parse(localStorage.getItem(DAILY_MCQ_KEY) || "{}");
    const date = getISTDate();
    const updated = existing.date === date ? { ...existing, [key]: ids } : { date, [key]: ids };
    localStorage.setItem(DAILY_MCQ_KEY, JSON.stringify(updated));
  } catch {}
}

export function useQuiz({ userId, exam, subject, topic, plan, dailyGoal }: UseQuizOptions) {
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
    try {
      const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
      return typeof prefs.mcqTimer === "number" ? prefs.mcqTimer : 30;
    } catch { return 30; }
  })();
  const [timeLeft, setTimeLeft] = useState(mcqTimerDuration);
  const [questionStartTime, setQuestionStartTime] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const duration = (() => {
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
          handleAutoSkip();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []); // eslint-disable-line

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Check for today's saved session (same questions same day)
    const dailySession = getDailySession(exam, subject, topic);
    let newQuestions: Question[] = [];

    if (dailySession && dailySession.ids.length > 0) {
      // Same day: load today's assigned questions
      const { data } = await supabase
        .from("questions")
        .select("*")
        .in("id", dailySession.ids)
        .eq("is_active", true);
      newQuestions = (data || []) as Question[];
    } else {
      // New day or first load: fetch prioritized questions
      const limit = plan === "free" ? FREE_DAILY_LIMIT : Math.max(dailyGoal || 20, 30);
      newQuestions = await fetchPrioritizedQuestions({
        userId, exam, subject, topic, limit, seenIds: [],
      });
      // Save today's assignment
      saveDailySession(exam, subject, topic, newQuestions.map((q) => q.id));
    }

    setQuestions(newQuestions);
    setLoading(false);
  }, [userId, exam, subject, topic, plan, dailyGoal]);

  useEffect(() => {
    const init = async () => {
      if (plan === "free") {
        const count = await getTodayQuestionCount(userId);
        if (count >= FREE_DAILY_LIMIT) {
          setLimitReached(true);
          setLoading(false);
          return;
        }
      }
      await loadQuestions();
    };
    init();
  }, [plan, userId, loadQuestions]);

  useEffect(() => {
    if (!loading && questions.length > 0 && !sessionEnded) {
      const timer = setTimeout(() => startTimer(), 0);
      return () => {
        clearTimeout(timer);
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIndex, loading, questions.length, sessionEnded, startTimer]);

  async function recordCurrentAnswer(option: string | null) {
    const question = questions[currentIndex];
    if (!question) return null;

    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    const isCorrect = option === question.correct_option;

    await recordAnswer({
      userId,
      questionId: question.id,
      isCorrect,
      timeSeconds: elapsed,
      recallFrequency: getMcqRecallFrequency(),
    });

    return {
      questionId: question.id,
      correct: isCorrect,
      skipped: option === null,
      timeSeconds: elapsed,
      topic: question.topic,
      subject: question.subject,
    };
  }

  async function handleAutoSkip() {
    if (!answered && questions[currentIndex]) {
      const answer = await recordCurrentAnswer(null);
      if (answer) setAnswers((prev) => [...prev, answer]);
      setAnswered(true);
      setSelectedOption(null);
    }
  }

  async function handleAnswer(option: string) {
    if (answered) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(option);
    setAnswered(true);

    // Check daily limit for free users
    if (plan === "free") {
      const count = await getTodayQuestionCount(userId);
      if (count >= FREE_DAILY_LIMIT) {
        setLimitReached(true);
        return;
      }
    }

    const answer = await recordCurrentAnswer(option);
    if (!answer) return;

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    // Check if daily goal reached
    if (dailyGoal && newAnswers.length >= dailyGoal) {
      setGoalReached(true);
    }
  }

  async function nextQuestion() {
    if (currentIndex >= questions.length - 1) {
      await endSession();
      return;
    }
    setSelectedOption(null);
    setAnswered(false);
    setCurrentIndex((i) => i + 1);
  }

  async function endSession() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSessionEnded(true);

    const supabase = createClient();
    const correct = answers.filter((a) => a.correct).length;
    const skipped = answers.filter((a) => a.skipped).length;
    const wrong = answers.filter((a) => !a.correct && !a.skipped).length;
    const avgTime = answers.length > 0
      ? Math.round(answers.reduce((s, a) => s + a.timeSeconds, 0) / answers.length)
      : 0;

    await supabase.from("quiz_sessions").insert({
      user_id: userId, exam, subject: subject || null,
      total_questions: answers.length, correct, wrong,
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
    answers,
    stats: { correct, wrong, skipped, accuracy, score: Math.round(score * 100) / 100, total: answers.length },
    handleAnswer,
    nextQuestion,
    endSession,
  };
}
