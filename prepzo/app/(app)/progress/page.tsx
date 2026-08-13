"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProgress } from "@/hooks/useProgress";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { AlertTriangle, BarChart2, CalendarDays, Flame, Target } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Profile } from "@/lib/supabase/types";

type BreakdownTab = "mcq" | "pyq" | "flashcards" | "recall" | "review";

const BREAKDOWN_TABS: Array<{ id: BreakdownTab; label: string }> = [
  { id: "mcq", label: "MCQ" },
  { id: "pyq", label: "PYQ Soon" },
  { id: "flashcards", label: "Flashcards" },
  { id: "recall", label: "Recall" },
  { id: "review", label: "Review" },
];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysSince(startDate: Date, maxCount: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const earliest = new Date(today);
  earliest.setDate(today.getDate() - (maxCount - 1));
  const firstDay = start > earliest ? start : earliest;

  const dayCount = Math.max(
    1,
    Math.floor((today.getTime() - firstDay.getTime()) / 86400000) + 1
  );

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    return date;
  });
}

function formatDay(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", options);
}

function getActivityTone(attempts: number, maxAttempts: number) {
  if (attempts === 0) return "bg-[#F1F5F9] border-[#E2E8F0]";
  const ratio = maxAttempts > 0 ? attempts / maxAttempts : 0;
  if (ratio >= 0.75) return "bg-[#1E3A8A] border-[#1E3A8A]";
  if (ratio >= 0.45) return "bg-[#3B5FBF] border-[#3B5FBF]";
  if (ratio >= 0.2) return "bg-[#93C5FD] border-[#93C5FD]";
  return "bg-[#DBEAFE] border-[#BFDBFE]";
}

export default function ProgressPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<BreakdownTab>("mcq");
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("profiles").select("*").single().then(({ data }) => setProfile(data));
  }, []);

  const { data, loading } = useProgress(profile?.id || "", profile?.plan || "free", profile?.streak || 0);

  const historyByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>["history"][number]>();
    data?.history.forEach((day) => map.set(day.date, day));
    return map;
  }, [data]);

  if (loading || !profile) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
        {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const plan = profile.plan === "paid" ? "paid" : "free";
  const pieData = [
    { name: "Correct", value: data.totalCorrect, color: "#16A34A" },
    { name: "Wrong", value: data.totalWrong, color: "#DC2626" },
    { name: "Skipped", value: data.totalSkipped, color: "#94A3B8" },
  ];
  const weakTopicsBySubject = data.weakTopics.reduce((groups, topic) => {
    const existing = groups.get(topic.subject) || [];
    groups.set(topic.subject, [...existing, topic]);
    return groups;
  }, new Map<string, typeof data.weakTopics>());

  const accountCreatedAt = new Date(profile.created_at);

  const freeDays = getDaysSince(accountCreatedAt, 7).map((date) => {
    const key = toDateKey(date);
    return {
      date: key,
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      isToday: key === toDateKey(new Date()),
      stats: historyByDate.get(key),
    };
  });
  const maxFreeAttempts = Math.max(1, ...freeDays.map((day) => day.stats?.totalAttempts || 0));

  const heatmapDays = getDaysSince(accountCreatedAt, 365).map((date) => {
    const key = toDateKey(date);
    const stats = historyByDate.get(key);
    return { date: key, stats };
  });
  const maxHeatmapAttempts = Math.max(1, ...heatmapDays.map((day) => day.stats?.totalAttempts || 0));
  const selectedHeatmapStats = selectedHeatmapDay ? historyByDate.get(selectedHeatmapDay) : null;

  const breakdownDays = plan === "paid"
    ? data.history
    : freeDays.slice().reverse().map((day) => ({
        date: day.date,
        totalAttempts: day.stats?.totalAttempts || 0,
        totalCorrect: day.stats?.totalCorrect || 0,
        totalSkipped: day.stats?.totalSkipped || 0,
        totalAccuracy: day.stats?.totalAccuracy || 0,
        mcqAttempts: day.stats?.mcqAttempts || 0,
        mcqCorrect: day.stats?.mcqCorrect || 0,
        mcqSkipped: day.stats?.mcqSkipped || 0,
        mcqAccuracy: day.stats?.mcqAccuracy || 0,
        pyqAttempts: day.stats?.pyqAttempts || 0,
        pyqCorrect: day.stats?.pyqCorrect || 0,
        pyqSkipped: day.stats?.pyqSkipped || 0,
        pyqAccuracy: day.stats?.pyqAccuracy || 0,
        flashcardAttempts: day.stats?.flashcardAttempts || 0,
        flashcardCorrect: day.stats?.flashcardCorrect || 0,
        flashcardAccuracy: day.stats?.flashcardAccuracy || 0,
        recallSeen: day.stats?.recallSeen || 0,
        reviewSeen: day.stats?.reviewSeen || 0,
        locked: false,
      }));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <BarChart2 size={20} className="text-[#1E3A8A]" />
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">Progress</h1>
      </div>

      <Card className="mb-6 bg-[#FFFBEB] border-[#FDE68A]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FEF3C7]">
              <Flame size={22} className="text-[#D97706]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#0F172A]">{data.currentStreak} day streak</p>
              <p className="text-sm text-[#92400E]">Longest: {data.longestStreak} days</p>
            </div>
          </div>
          <Badge variant="warning">Last studied: {data.lastStudiedLabel}</Badge>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Target size={16} className="text-[#1E3A8A]" />
          <h3 className="text-sm font-semibold text-[#0F172A]">Overall Accuracy</h3>
        </div>
        {data.totalDone > 0 ? (
          <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-center">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={86} dataKey="value">
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[#F0FDF4] p-3">
                <p className="font-[family-name:var(--font-dm-mono)] text-xl font-bold text-[#16A34A]">{data.totalCorrect}</p>
                <p className="text-xs text-[#64748B]">Correct</p>
              </div>
              <div className="rounded-xl bg-[#FEF2F2] p-3">
                <p className="font-[family-name:var(--font-dm-mono)] text-xl font-bold text-[#DC2626]">{data.totalWrong}</p>
                <p className="text-xs text-[#64748B]">Wrong</p>
              </div>
              <div className="rounded-xl bg-[#F8FAFF] p-3">
                <p className="font-[family-name:var(--font-dm-mono)] text-xl font-bold text-[#64748B]">{data.totalSkipped}</p>
                <p className="text-xs text-[#64748B]">Skipped</p>
              </div>
              <div className="col-span-3 rounded-xl bg-[#F8FAFF] p-3">
                <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold text-[#0F172A]">{data.overallAccuracy}%</p>
                <p className="text-xs text-[#64748B]">Combined MCQ + flashcard accuracy</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[#F8FAFF] p-6 text-center text-sm text-[#64748B]">
            Take an MCQ or flashcard to start building your accuracy chart.
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Target size={16} className="text-[#1E3A8A]" />
          <h3 className="text-sm font-semibold text-[#0F172A]">PYQ Progress Coming Soon</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-[#F8FAFF] p-3">
            <p className="font-[family-name:var(--font-dm-mono)] text-xl font-bold text-[#1E3A8A]">{data.pyqDone}</p>
            <p className="text-xs text-[#64748B]">Attempted</p>
          </div>
          <div className="rounded-xl bg-[#F0FDF4] p-3">
            <p className="font-[family-name:var(--font-dm-mono)] text-xl font-bold text-[#16A34A]">{data.pyqCorrect}</p>
            <p className="text-xs text-[#64748B]">Correct</p>
          </div>
          <div className="rounded-xl bg-[#DBEAFE] p-3">
            <p className="font-[family-name:var(--font-dm-mono)] text-xl font-bold text-[#1E3A8A]">{data.pyqAccuracy}%</p>
            <p className="text-xs text-[#64748B]">Accuracy</p>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-[#1E3A8A]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Subject Breakdown</h3>
          </div>
          <Badge variant="primary">{profile.exam}</Badge>
        </div>
        <div className="space-y-4">
          {data.subjectStats.map((stat) => (
            <div key={stat.subject}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-[#0F172A]">{stat.subject}</span>
                <span className="shrink-0 text-[#476081]">{stat.accuracy}% · {stat.done} attempted</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    stat.accuracy >= 70 ? "bg-[#16A34A]" : stat.accuracy >= 50 ? "bg-[#D97706]" : stat.done > 0 ? "bg-[#DC2626]" : "bg-[#E2E8F0]"
                  }`}
                  style={{ width: `${Math.min(100, stat.accuracy)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[#1E3A8A]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Activity History</h3>
          </div>
          <Badge variant={plan === "paid" ? "success" : "warning"}>{plan === "paid" ? "Full heatmap" : "Last 7 days"}</Badge>
        </div>

        {plan === "paid" ? (
          <div>
            <div className="grid grid-cols-[repeat(53,minmax(0,1fr))] gap-1">
              {heatmapDays.map((day) => {
                const attempts = day.stats?.totalAttempts || 0;
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedHeatmapDay(day.date)}
                    title={`${formatDay(day.date, { day: "numeric", month: "short" })}: ${attempts} attempts`}
                    className={`aspect-square rounded-sm border transition-all ${getActivityTone(attempts, maxHeatmapAttempts)} ${
                      selectedHeatmapDay === day.date ? "ring-2 ring-[#D97706] ring-offset-1" : ""
                    }`}
                  />
                );
              })}
            </div>
            <div className="mt-4 rounded-xl bg-[#F8FAFF] p-3 text-sm text-[#64748B]">
              {selectedHeatmapDay ? (
                <span>
                  <strong className="text-[#0F172A]">{formatDay(selectedHeatmapDay, { day: "numeric", month: "long" })}</strong>
                  {" · "}
                  {selectedHeatmapStats?.totalAttempts || 0} questions
                  {selectedHeatmapStats?.totalAttempts ? ` · ${selectedHeatmapStats.totalAccuracy}% accuracy` : " · no activity"}
                </span>
              ) : (
                "Tap a square to see that day's breakdown."
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {freeDays.map((day) => {
              const attempts = day.stats?.totalAttempts || 0;
              const accuracy = day.stats?.totalAccuracy || 0;
              return (
                <div key={day.date} className="grid grid-cols-[42px_1fr] gap-3 sm:grid-cols-[48px_1fr_190px] sm:items-center">
                  <div className="text-sm font-semibold text-[#0F172A]">
                    {day.label}
                    {day.isToday && <span className="ml-1 text-[#D97706]">today</span>}
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#F1F5F9]">
                    <div
                      className={`h-full rounded-full ${attempts > 0 ? "bg-[#1E3A8A]" : "bg-[#E2E8F0]"}`}
                      style={{ width: `${Math.max(attempts > 0 ? 8 : 0, Math.round((attempts / maxFreeAttempts) * 100))}%` }}
                    />
                  </div>
                  <div className="col-start-2 text-xs text-[#64748B] sm:col-start-auto sm:text-right">
                    {attempts} questions · {attempts > 0 ? `${accuracy}% accuracy` : "-"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#D97706]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Weak Topics</h3>
          </div>
          <span className="text-xs text-[#64748B]">Below your saved threshold, minimum 5 attempts by default</span>
        </div>
        {data.weakTopics.length > 0 ? (
          <div className="space-y-5">
            {[...weakTopicsBySubject.entries()].map(([subject, topics]) => (
              <div key={subject}>
                <p className="mb-2 text-sm font-bold text-[#0F172A]">{subject}</p>
                <div className="space-y-3">
                  {topics.map((topic) => (
                    <div key={`${topic.subject}-${topic.topic}`}>
                      <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0F172A]">{topic.topic}</p>
                          <p className="text-xs text-[#64748B]">{topic.accuracy}% accuracy · {topic.done} attempted</p>
                        </div>
                        <Link
                          href={`/quiz?subject=${encodeURIComponent(topic.subject)}&topic=${encodeURIComponent(topic.topic)}`}
                          className="shrink-0 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] transition-all hover:border-[#1E3A8A] hover:bg-[#F8FAFF]"
                        >
                          Practice
                        </Link>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
                        <div className="h-full rounded-full bg-[#DC2626]" style={{ width: `${topic.accuracy}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-[#F8FAFF] p-5 text-center text-sm text-[#64748B]">
            No weak topics meet the current rule yet.
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#0F172A]">Session Breakdown</h3>
          <Badge variant={plan === "paid" ? "success" : "warning"}>{plan === "paid" ? "Full access" : "7 days"}</Badge>
        </div>
        <div className="mb-4 grid grid-cols-5 rounded-xl bg-[#F8FAFF] p-1">
          {BREAKDOWN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition-all ${
                activeTab === tab.id ? "bg-white text-[#1E3A8A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {breakdownDays.length === 0 && (
            <div className="rounded-xl bg-[#F8FAFF] p-5 text-center text-sm text-[#64748B]">No session history yet.</div>
          )}
          {breakdownDays.map((day) => {
            const metrics = getBreakdownMetrics(day, activeTab);
            return (
              <div key={`${activeTab}-${day.date}`} className="grid grid-cols-[82px_1fr] gap-3 rounded-xl border border-[#E2E8F0] p-3 sm:grid-cols-[110px_1fr_120px] sm:items-center">
                <p className="text-sm font-semibold text-[#0F172A]">{formatDay(day.date, { day: "numeric", month: "short" })}</p>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className={`h-full rounded-full ${metrics.attempts > 0 ? "bg-[#1E3A8A]" : "bg-[#E2E8F0]"}`}
                    style={{ width: `${Math.min(100, metrics.accuracy)}%` }}
                  />
                </div>
                <p className="col-start-2 text-xs text-[#64748B] sm:col-start-auto sm:text-right">
                  {metrics.attempts} attempts · {metrics.attempts > 0 ? `${metrics.accuracy}% accuracy` : "-"}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function getBreakdownMetrics(
  day: {
    mcqAttempts: number;
    mcqAccuracy: number;
    flashcardAttempts: number;
    flashcardAccuracy: number;
    pyqAttempts: number;
    pyqAccuracy: number;
    recallSeen: number;
    reviewSeen: number;
  },
  tab: BreakdownTab
) {
  if (tab === "pyq") return { attempts: day.pyqAttempts, accuracy: day.pyqAccuracy };
  if (tab === "flashcards") return { attempts: day.flashcardAttempts, accuracy: day.flashcardAccuracy };
  if (tab === "recall") return { attempts: day.recallSeen, accuracy: day.recallSeen > 0 ? 100 : 0 };
  if (tab === "review") return { attempts: day.reviewSeen, accuracy: 0 };
  return { attempts: day.mcqAttempts, accuracy: day.mcqAccuracy };
}
