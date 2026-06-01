"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSubjectsForExam } from "@/lib/utils";

interface SubjectStat {
  subject: string;
  done: number;
  correct: number;
  accuracy: number;
}

interface WeakTopic {
  subject: string;
  topic: string;
  accuracy: number;
  done: number;
}

interface HistoryDay {
  date: string;
  totalAttempts: number;
  totalCorrect: number;
  totalSkipped: number;
  totalAccuracy: number;
  mcqAttempts: number;
  mcqCorrect: number;
  mcqSkipped: number;
  mcqAccuracy: number;
  flashcardAttempts: number;
  flashcardCorrect: number;
  flashcardAccuracy: number;
  recallSeen: number;
  reviewSeen: number;
  locked: boolean;
}

interface ProgressData {
  totalDone: number;
  totalCorrect: number;
  totalWrong: number;
  totalSkipped: number;
  overallAccuracy: number;
  avgTime: number;
  subjectStats: SubjectStat[];
  weakTopics: WeakTopic[];
  currentStreak: number;
  longestStreak: number;
  lastStudiedLabel: string;
  streakDays: string[];
  history: HistoryDay[];
}

function toDay(value: string | null): string | null {
  return value ? value.split("T")[0] : null;
}

function formatLastStudied(lastDay: string | null): string {
  if (!lastDay) return "No activity yet";
  const today = new Date().toISOString().split("T")[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split("T")[0];
  if (lastDay === today) return "Today";
  if (lastDay === yesterday) return "Yesterday";
  return new Date(`${lastDay}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getLongestStreak(days: string[]): number {
  let longest = 0;
  let current = 0;
  let previous: Date | null = null;

  days.forEach((day) => {
    const date = new Date(`${day}T00:00:00`);
    if (!previous) current = 1;
    else current = Math.round((date.getTime() - previous.getTime()) / 86400000) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  });

  return longest;
}

function getWeakTopicPrefs(): { threshold: number; minAttempts: number } {
  if (typeof window === "undefined") return { threshold: 60, minAttempts: 5 };

  try {
    const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
    return {
      threshold: typeof prefs.weakTopicThreshold === "number" ? prefs.weakTopicThreshold : 60,
      minAttempts: typeof prefs.weakTopicMinAttempts === "number" ? prefs.weakTopicMinAttempts : 5,
    };
  } catch {
    return { threshold: 60, minAttempts: 5 };
  }
}

export function useProgress(userId: string, plan: "free" | "paid" = "free", currentStreak = 0) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const timer = setTimeout(() => {
      void loadProgress();
    }, 0);
    return () => clearTimeout(timer);
  }, [userId, plan, currentStreak]); // eslint-disable-line

  async function loadProgress() {
    setLoading(true);
    const supabase = createClient();

    const { data: progress } = await supabase
      .from("user_progress")
      .select(`times_seen, times_correct, avg_time_seconds, deck_type, last_seen_at, questions!inner(subject, topic)`)
      .eq("user_id", userId)
      .gt("times_seen", 0);

    const { data: flashcardProgress } = await supabase
      .from("user_flashcard_progress")
      .select("times_seen, deck_type, last_seen_at")
      .eq("user_id", userId)
      .gt("times_seen", 0);

    const mcqItems = (progress || []) as Array<{
      times_seen: number;
      times_correct: number;
      avg_time_seconds: number | null;
      deck_type: string | null;
      last_seen_at: string | null;
      questions: { subject: string; topic: string | null };
    }>;
    const flashcardItems = (flashcardProgress || []) as Array<{
      times_seen: number;
      deck_type: string | null;
      last_seen_at: string | null;
    }>;

    const mcqDone = mcqItems.reduce((sum, item) => sum + item.times_seen, 0);
    const mcqCorrect = mcqItems.reduce((sum, item) => sum + item.times_correct, 0);
    const flashcardDone = flashcardItems.reduce((sum, item) => sum + item.times_seen, 0);
    const flashcardCorrect = flashcardItems.reduce(
      (sum, item) => sum + (item.deck_type === "recall" ? item.times_seen : 0),
      0
    );

    const totalDone = mcqDone + flashcardDone;
    const totalCorrect = mcqCorrect + flashcardCorrect;
    const overallAccuracy = totalDone > 0 ? Math.round((totalCorrect / totalDone) * 100) : 0;

    const { data: avgSessions } = await supabase
      .from("quiz_sessions")
      .select("total_questions, correct, wrong, skipped, avg_time_seconds, completed_at")
      .eq("user_id", userId);
    const sessionsData = (avgSessions || []) as Array<{
      total_questions: number | null;
      correct: number | null;
      wrong: number | null;
      skipped: number | null;
      avg_time_seconds: number | null;
      completed_at: string | null;
    }>;
    const totalSessionTime = sessionsData.reduce(
      (sum, session) => sum + ((session.avg_time_seconds || 0) * (session.total_questions || 1)),
      0
    );
    const totalSessionQuestions = sessionsData.reduce((sum, session) => sum + (session.total_questions || 0), 0);
    const avgTime = totalSessionQuestions > 0 ? Math.round(totalSessionTime / totalSessionQuestions) : 0;
    const totalSkipped = sessionsData.reduce((sum, session) => sum + (session.skipped || 0), 0);
    const totalWrong = Math.max(totalDone - totalCorrect - totalSkipped, 0);

    const subjectMap = new Map<string, { done: number; correct: number }>();
    mcqItems.forEach((item) => {
      const subject = item.questions.subject;
      const existing = subjectMap.get(subject) || { done: 0, correct: 0 };
      subjectMap.set(subject, {
        done: existing.done + item.times_seen,
        correct: existing.correct + item.times_correct,
      });
    });
    const predefinedSubjects = getSubjectsForExam("NEET");
    const answeredSubjects = [...subjectMap.keys()];
    const allSubjects = [
      ...predefinedSubjects,
      ...answeredSubjects.filter((subject) => !predefinedSubjects.includes(subject)),
    ];
    const subjectStats = allSubjects.map((subject) => {
      const stats = subjectMap.get(subject) || { done: 0, correct: 0 };
      return {
        subject,
        done: stats.done,
        correct: stats.correct,
        accuracy: stats.done > 0 ? Math.round((stats.correct / stats.done) * 100) : 0,
      };
    });

    const { threshold: weakTopicThreshold, minAttempts: weakTopicMinAttempts } = getWeakTopicPrefs();
    const topicMap = new Map<string, { subject: string; topic: string; done: number; correct: number }>();
    mcqItems.forEach((item) => {
      const subject = item.questions.subject;
      const topic = item.questions.topic;
      if (!subject || !topic) return;
      const key = `${subject}::${topic}`;
      const existing = topicMap.get(key) || { subject, topic, done: 0, correct: 0 };
      topicMap.set(key, {
        subject,
        topic,
        done: existing.done + item.times_seen,
        correct: existing.correct + item.times_correct,
      });
    });
    const weakTopics = [...topicMap.values()]
      .map((stats) => ({
        subject: stats.subject,
        topic: stats.topic,
        accuracy: Math.round((stats.correct / stats.done) * 100),
        done: stats.done,
      }))
      .filter((topic) => topic.accuracy < weakTopicThreshold && topic.done >= weakTopicMinAttempts)
      .sort((a, b) => a.accuracy - b.accuracy || b.done - a.done || a.subject.localeCompare(b.subject))
      .slice(0, 8);

    const historyMap = new Map<string, {
      mcqAttempts: number;
      mcqCorrect: number;
      mcqSkipped: number;
      flashcardAttempts: number;
      flashcardCorrect: number;
      recallSeen: number;
      reviewSeen: number;
    }>();

    function ensureHistory(day: string) {
      const existing = historyMap.get(day) || {
        mcqAttempts: 0,
        mcqCorrect: 0,
        mcqSkipped: 0,
        flashcardAttempts: 0,
        flashcardCorrect: 0,
        recallSeen: 0,
        reviewSeen: 0,
      };
      historyMap.set(day, existing);
      return existing;
    }

    mcqItems.forEach((item) => {
      const day = toDay(item.last_seen_at);
      if (!day) return;
      const entry = ensureHistory(day);
      entry.mcqAttempts += item.times_seen;
      entry.mcqCorrect += item.times_correct;
      if (item.deck_type === "recall") entry.recallSeen += item.times_seen;
      if (item.deck_type === "review") entry.reviewSeen += item.times_seen;
    });

    sessionsData.forEach((session) => {
      const day = toDay(session.completed_at);
      if (!day) return;
      const entry = ensureHistory(day);
      entry.mcqSkipped += session.skipped || 0;
    });

    flashcardItems.forEach((item) => {
      const day = toDay(item.last_seen_at);
      if (!day) return;
      const entry = ensureHistory(day);
      entry.flashcardAttempts += item.times_seen;
      if (item.deck_type === "recall") {
        entry.flashcardCorrect += item.times_seen;
        entry.recallSeen += item.times_seen;
      }
      if (item.deck_type === "review") entry.reviewSeen += item.times_seen;
    });

    const history = [...historyMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, entry], index) => ({
        date,
        totalAttempts: entry.mcqAttempts + entry.flashcardAttempts,
        totalCorrect: entry.mcqCorrect + entry.flashcardCorrect,
        totalSkipped: entry.mcqSkipped,
        totalAccuracy: entry.mcqAttempts + entry.flashcardAttempts > 0
          ? Math.round(((entry.mcqCorrect + entry.flashcardCorrect) / (entry.mcqAttempts + entry.flashcardAttempts)) * 100)
          : 0,
        mcqAttempts: entry.mcqAttempts,
        mcqCorrect: entry.mcqCorrect,
        mcqSkipped: entry.mcqSkipped,
        mcqAccuracy: entry.mcqAttempts > 0 ? Math.round((entry.mcqCorrect / entry.mcqAttempts) * 100) : 0,
        flashcardAttempts: entry.flashcardAttempts,
        flashcardCorrect: entry.flashcardCorrect,
        flashcardAccuracy: entry.flashcardAttempts > 0 ? Math.round((entry.flashcardCorrect / entry.flashcardAttempts) * 100) : 0,
        recallSeen: entry.recallSeen,
        reviewSeen: entry.reviewSeen,
        locked: plan !== "paid" && index >= 7,
      }));

    const streakDays = [...historyMap.keys()].sort();
    const lastStudiedDay = streakDays[streakDays.length - 1] || null;

    setData({
      totalDone,
      totalCorrect,
      totalWrong,
      totalSkipped,
      overallAccuracy,
      avgTime,
      subjectStats,
      weakTopics,
      currentStreak,
      longestStreak: getLongestStreak(streakDays),
      lastStudiedLabel: formatLastStudied(lastStudiedDay),
      streakDays,
      history,
    });
    setLoading(false);
  }

  return { data, loading, reload: loadProgress };
}
