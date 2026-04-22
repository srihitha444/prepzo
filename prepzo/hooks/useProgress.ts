"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface SubjectStat {
  subject: string;
  done: number;
  correct: number;
  accuracy: number;
}

interface WeakTopic {
  topic: string;
  accuracy: number;
  done: number;
}

interface ProgressData {
  totalDone: number;
  totalCorrect: number;
  overallAccuracy: number;
  avgTime: number;
  subjectStats: SubjectStat[];
  weakTopics: WeakTopic[];
  streakDays: string[];
  recentSessions: {
    date: string;
    correct: number;
    total: number;
    subject: string | null;
  }[];
}

export function useProgress(userId: string) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadProgress();
  }, [userId]); // eslint-disable-line

  async function loadProgress() {
    setLoading(true);
    const supabase = createClient();

    // Overall progress
    const { data: progress } = await supabase
      .from("user_progress")
      .select(`times_seen, times_correct, avg_time_seconds, questions!inner(subject, topic)`)
      .eq("user_id", userId)
      .gt("times_seen", 0);

    const items = progress || [];
    const totalDone = items.reduce((s: number, p: { times_seen: number }) => s + p.times_seen, 0);
    const totalCorrect = items.reduce((s: number, p: { times_correct: number }) => s + p.times_correct, 0);
    const overallAccuracy = totalDone > 0 ? Math.round((totalCorrect / totalDone) * 100) : 0;
    const avgTime = items.length > 0
      ? Math.round(items.filter((p: { avg_time_seconds: number | null }) => p.avg_time_seconds).reduce((s: number, p: { avg_time_seconds: number | null }) => s + (p.avg_time_seconds || 0), 0) / items.length)
      : 0;

    // Subject stats
    const subjectMap = new Map<string, { done: number; correct: number }>();
    items.forEach((p: { times_seen: number; times_correct: number; questions: { subject: string; topic: string | null } }) => {
      const subject = (p.questions as { subject: string }).subject;
      const existing = subjectMap.get(subject) || { done: 0, correct: 0 };
      subjectMap.set(subject, {
        done: existing.done + p.times_seen,
        correct: existing.correct + p.times_correct,
      });
    });
    const subjectStats: SubjectStat[] = [...subjectMap.entries()].map(([subject, data]) => ({
      subject,
      done: data.done,
      correct: data.correct,
      accuracy: Math.round((data.correct / Math.max(data.done, 1)) * 100),
    }));

    // Weak topics (accuracy < 60%, min 3 attempts)
    const topicMap = new Map<string, { done: number; correct: number }>();
    items.forEach((p: { times_seen: number; times_correct: number; questions: { topic: string | null } }) => {
      const topic = (p.questions as { topic: string | null }).topic;
      if (!topic) return;
      const existing = topicMap.get(topic) || { done: 0, correct: 0 };
      topicMap.set(topic, {
        done: existing.done + p.times_seen,
        correct: existing.correct + p.times_correct,
      });
    });
    const weakTopics: WeakTopic[] = [...topicMap.entries()]
      .map(([topic, data]) => ({
        topic,
        accuracy: Math.round((data.correct / data.done) * 100),
        done: data.done,
      }))
      .filter((t) => t.accuracy < 60 && t.done >= 3)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8);

    // Recent sessions (last 30 days)
    const { data: sessions } = await supabase
      .from("quiz_sessions")
      .select("completed_at, correct, total_questions, subject")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(30);

    const recentSessions = (sessions || []).map((s: {
      completed_at: string;
      correct: number | null;
      total_questions: number | null;
      subject: string | null;
    }) => ({
      date: s.completed_at,
      correct: s.correct || 0,
      total: s.total_questions || 0,
      subject: s.subject,
    }));

    // Streak days (last 30 days with activity)
    const streakSet = new Set<string>();
    items.forEach(() => {}); // Already loaded
    (sessions || []).forEach((s: { completed_at: string }) => {
      streakSet.add(s.completed_at.split("T")[0]);
    });
    const streakDays = [...streakSet].sort();

    setData({
      totalDone,
      totalCorrect,
      overallAccuracy,
      avgTime,
      subjectStats,
      weakTopics,
      streakDays,
      recentSessions,
    });
    setLoading(false);
  }

  return { data, loading, reload: loadProgress };
}
