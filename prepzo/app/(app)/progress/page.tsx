"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProgress } from "@/hooks/useProgress";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BarChart2, Target, Clock, AlertTriangle, Flame } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";

export default function ProgressPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("profiles").select("*").single().then(({ data }) => setProfile(data));
  }, []);

  const { data, loading } = useProgress(profile?.id || "");

  if (loading || !profile) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const pieData = [
    { name: "Correct", value: data.totalCorrect, color: "#16A34A" },
    { name: "Wrong", value: data.totalDone - data.totalCorrect, color: "#DC2626" },
  ];

  const sessionChartData = data.recentSessions.slice(0, 14).reverse().map((s, i) => ({
    name: `S${i + 1}`,
    correct: s.correct,
    wrong: s.total - s.correct,
  }));

  // Streak calendar (last 30 days)
  const today = new Date();
  const streakCalendar = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().split("T")[0];
    return { date: dateStr, active: data.streakDays.includes(dateStr) };
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <BarChart2 size={20} className="text-[#1E3A8A]" />
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">Progress</h1>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="text-center">
          <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold text-[#1E3A8A]">{data.totalDone}</p>
          <p className="text-xs text-[#64748B] mt-1">Questions done</p>
        </Card>
        <Card className="text-center">
          <p className={`font-[family-name:var(--font-dm-mono)] text-2xl font-bold ${
            data.overallAccuracy >= 70 ? "text-[#16A34A]" : data.overallAccuracy >= 50 ? "text-[#D97706]" : "text-[#DC2626]"
          }`}>
            {data.overallAccuracy}%
          </p>
          <p className="text-xs text-[#64748B] mt-1">Overall accuracy</p>
        </Card>
        <Card className="text-center">
          <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold text-[#0F172A]">
            {data.avgTime > 0 ? `${data.avgTime}s` : "—"}
          </p>
          <p className="text-xs text-[#64748B] mt-1">Avg time/question</p>
        </Card>
        <Card className="text-center">
          <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold text-[#D97706]">{profile.streak}</p>
          <p className="text-xs text-[#64748B] mt-1">Day streak</p>
        </Card>
      </div>

      {/* Accuracy doughnut */}
      {data.totalDone > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-[#1E3A8A]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Overall Accuracy</h3>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} startAngle={90} endAngle={-270} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-bold font-[family-name:var(--font-dm-mono)] text-[#0F172A]">
                  {data.overallAccuracy}%
                </p>
                <p className="text-xs text-[#64748B]">accuracy rate</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full bg-[#16A34A]" />
                <span className="text-[#64748B]">{data.totalCorrect} correct</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full bg-[#DC2626]" />
                <span className="text-[#64748B]">{data.totalDone - data.totalCorrect} wrong</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Session history chart */}
      {sessionChartData.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-[#1E3A8A]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Recent Sessions</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sessionChartData} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "12px" }}
              />
              <Bar dataKey="correct" fill="#16A34A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wrong" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Subject breakdown */}
      {data.subjectStats.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Subject Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#64748B] border-b border-[#F1F5F9]">
                  <th className="text-left pb-2 font-medium">Subject</th>
                  <th className="text-right pb-2 font-medium">Done</th>
                  <th className="text-right pb-2 font-medium">Correct</th>
                  <th className="text-right pb-2 font-medium">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFF]">
                {data.subjectStats.map((stat) => (
                  <tr key={stat.subject}>
                    <td className="py-2.5 font-medium text-[#0F172A]">{stat.subject}</td>
                    <td className="py-2.5 text-right text-[#64748B]">{stat.done}</td>
                    <td className="py-2.5 text-right text-[#64748B]">{stat.correct}</td>
                    <td className="py-2.5 text-right">
                      <Badge variant={stat.accuracy >= 70 ? "success" : stat.accuracy >= 50 ? "warning" : "error"}>
                        {stat.accuracy}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Weak topics */}
      {data.weakTopics.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-[#D97706]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Topics to Improve</h3>
          </div>
          <div className="space-y-3">
            {data.weakTopics.map((topic) => (
              <div key={topic.topic}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#0F172A] font-medium">{topic.topic}</span>
                  <span className="text-[#64748B]">{topic.done} attempts · {topic.accuracy}%</span>
                </div>
                <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#DC2626] rounded-full"
                    style={{ width: `${topic.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Streak calendar */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Flame size={16} className="text-[#D97706]" />
          <h3 className="text-sm font-semibold text-[#0F172A]">30-Day Activity</h3>
        </div>
        <div className="grid grid-cols-10 gap-1.5">
          {streakCalendar.map((day) => (
            <div
              key={day.date}
              title={day.date}
              className={`aspect-square rounded-sm transition-all ${
                day.active ? "bg-[#1E3A8A]" : "bg-[#F1F5F9]"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-[#64748B]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#1E3A8A]" />
            Active
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#F1F5F9]" />
            Inactive
          </div>
        </div>
      </Card>
    </div>
  );
}
