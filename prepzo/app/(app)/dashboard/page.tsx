import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Flame, BookOpen, Brain, BarChart2, Target, Layers, Crown, BookOpenCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { getSubjectsForExam, normalizeSubject } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as Profile | null;

  if (!profile?.exam) redirect("/onboarding");

  // Today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todayProgressRaw } = await supabase
    .from("user_progress")
    .select("deck_type, times_seen, times_correct, avg_time_seconds, questions!inner(exam)")
    .eq("user_id", user.id)
    .eq("questions.exam", profile.exam)
    .gte("last_seen_at", today.toISOString());
  const todayProgress = todayProgressRaw as Array<{ deck_type: string | null; times_seen: number | null; times_correct: number | null; avg_time_seconds: number | null }> | null;

  const { data: todayFlashcardsRaw } = await supabase
    .from("user_flashcard_progress")
    .select("id")
    .eq("user_id", user.id)
    .gte("last_seen_at", today.toISOString());
  const flashcardsDone = todayFlashcardsRaw?.length || 0;
  // Avg time from quiz sessions only (not review/recall)
  const { data: todaySessionsRaw } = await supabase
    .from("quiz_sessions")
    .select("total_questions, correct, avg_time_seconds, is_pyq")
    .eq("user_id", user.id)
    .eq("exam", profile.exam)
    .gte("completed_at", today.toISOString());
  const todaySessions = todaySessionsRaw as Array<{ total_questions: number; correct: number | null; avg_time_seconds: number | null; is_pyq: boolean | null }> | null;
  const totalQuizTime = todaySessions?.reduce((s, session) => s + ((session.avg_time_seconds || 0) * (session.total_questions || 1)), 0) || 0;
  const totalQuizQuestions = todaySessions?.reduce((sum, s) => sum + (s.total_questions || 0), 0) || 0;
  const hasTodaySessions = Boolean(todaySessions?.length);
  const progressQuestionAttempts = todayProgress?.reduce((sum, p) => sum + (p.times_seen || 0), 0) || 0;
  const progressCorrectAttempts = todayProgress?.reduce((sum, p) => sum + (p.times_correct || 0), 0) || 0;
  const questionsDone = hasTodaySessions ? totalQuizQuestions : progressQuestionAttempts;
  const totalDoneToday = questionsDone + flashcardsDone;
  const correctToday = hasTodaySessions
    ? todaySessions?.reduce((sum, session) => sum + (session.correct || 0), 0) || 0
    : progressCorrectAttempts;
  const accuracyToday = questionsDone > 0 ? Math.round((correctToday / questionsDone) * 100) : 0;
  const avgTime = totalQuizQuestions > 0 ? Math.round(totalQuizTime / totalQuizQuestions) : 0;

  const { data: todayPyqProgressRaw } = await supabase
    .from("user_progress")
    .select("question_id, times_seen, questions!inner(is_pyq, exam)")
    .eq("user_id", user.id)
    .eq("questions.is_pyq", true)
    .eq("questions.exam", profile.exam)
    .gte("last_seen_at", today.toISOString());
  const pyqProgressToday = (todayPyqProgressRaw || []) as Array<{ times_seen: number | null }>;
  const pyqSessionToday = todaySessions?.filter((session) => session.is_pyq).reduce((sum, session) => sum + (session.total_questions || 0), 0) || 0;
  const pyqProgressAttemptsToday = pyqProgressToday.reduce((sum, item) => sum + (item.times_seen || 0), 0);
  const pyqDoneToday = Math.max(pyqSessionToday, pyqProgressAttemptsToday);

  // Recall due count
  const { count: recallDue } = await supabase
    .from("user_progress")
    .select("*, questions!inner(exam)", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("questions.exam", profile.exam)
    .lte("next_due_at", new Date().toISOString())
    .in("deck_type", ["recall", "review"]);

  // Subject progress - get all subjects with their stats
  const predefinedSubjects = getSubjectsForExam(profile.exam);
  
  const { data: subjectProgressRaw } = await supabase
    .from("user_progress")
    .select(`question_id, times_correct, times_seen, questions!inner(subject, topic, exam)`)
    .eq("user_id", user.id)
    .eq("questions.exam", profile.exam);
  const subjectProgress = subjectProgressRaw as Array<{ 
    question_id: string; 
    times_correct: number; 
    times_seen: number; 
    questions: { subject: string; topic: string | null } 
  }> | null;

  // Build accuracy stats from attempted questions.
  const subjectStatsMap = new Map<string, { done: number; correct: number; accuracy: number }>();
  
  (subjectProgress || []).forEach((p) => {
    const subject = normalizeSubject(p.questions?.subject);
    if (!subject) return;
    
    const existing = subjectStatsMap.get(subject) || { done: 0, correct: 0, accuracy: 0 };
    const newDone = existing.done + p.times_seen;
    const newCorrect = existing.correct + p.times_correct;
    
    subjectStatsMap.set(subject, {
      done: newDone,
      correct: newCorrect,
      accuracy: Math.round((newCorrect / newDone) * 100),
    });
  });

  // Show every NEET subject, plus any unexpected subjects from saved data.
  const answeredSubjects = Array.from(subjectStatsMap.keys());
  const allSubjects = [
    ...predefinedSubjects,
    ...answeredSubjects.filter(s => !predefinedSubjects.includes(s))
  ];

  const subjectStats = allSubjects.map((subject) => ({
    subject,
    ...(subjectStatsMap.get(subject) || { done: 0, correct: 0, accuracy: 0 }),
  }));

  const totalDailyGoal = profile.daily_goal || 20;
  const dailyProgress = Math.min(100, Math.round((totalDoneToday / totalDailyGoal) * 100));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <TourOverlay />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl md:text-3xl font-bold text-[#0F172A]">
            Hey, {profile.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-[#64748B] text-sm mt-1">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-2 bg-[#FEF3C7] px-4 py-2 rounded-xl border border-[#FDE68A]">
          <Flame size={18} className="text-[#D97706]" />
          <div>
            <p className="font-[family-name:var(--font-dm-mono)] text-xl font-bold text-[#D97706] leading-none">
              {profile.streak}
            </p>
            <p className="text-[10px] text-[#D97706]/80">day streak</p>
          </div>
        </div>
      </div>

      {/* Daily goal progress */}
      <Card className="mb-6" id="dashboard-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-[#1E3A8A]" />
            <span className="text-sm font-semibold text-[#0F172A]">Today&apos;s Goal</span>
          </div>
          <span className="text-sm font-medium text-[#64748B]">
            {totalDoneToday} / {totalDailyGoal} items
          </span>
        </div>
        <div className="w-full h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1E3A8A] rounded-full transition-all duration-700"
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
        {dailyProgress >= 100 && (
          <p className="text-xs text-[#16A34A] font-medium mt-2">🎉 Goal reached! Keep going!</p>
        )}
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-6">
        <Card className="text-center">
          <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold text-[#1E3A8A]">
            {correctToday}
          </p>
          <p className="text-xs text-[#64748B] mt-1">Correct today</p>
        </Card>
        <Card className="text-center">
          <p className={`font-[family-name:var(--font-dm-mono)] text-2xl font-bold ${
            accuracyToday >= 70 ? "text-[#16A34A]" : accuracyToday >= 50 ? "text-[#D97706]" : "text-[#DC2626]"
          }`}>
            {accuracyToday}%
          </p>
          <p className="text-xs text-[#64748B] mt-1">Accuracy</p>
        </Card>
        <Card className="text-center">
          <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold text-[#0F172A]">
            {avgTime > 0 ? `${avgTime}s` : "—"}
          </p>
          <p className="text-xs text-[#64748B] mt-1">Avg time</p>
        </Card>
        <Card className="text-center">
          <p className="font-[family-name:var(--font-dm-mono)] text-2xl font-bold text-[#1E3A8A]">
            {pyqDoneToday}
          </p>
          <p className="text-xs text-[#64748B] mt-1">PYQs coming soon</p>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 mb-6">
        <Link href="/flashcards">
          <Card hover className="flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-[#1E3A8A]" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#0F172A]">Flashcards</p>
              <p className="text-xs text-[#64748B]">Memorise concepts</p>
            </div>
          </Card>
        </Link>
        <Link href="/quiz">
          <Card hover className="flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center shrink-0">
              <Brain size={18} className="text-[#4F46E5]" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#0F172A]">Start Quiz</p>
              <p className="text-xs text-[#64748B]">Practice MCQs</p>
            </div>
          </Card>
        </Link>
        <Link href="/pyq" className="col-span-2 md:col-span-1">
          <Card hover className="flex items-center gap-3 h-full">
            <div className="w-10 h-10 rounded-xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
              <BookOpenCheck size={18} className="text-[#1E3A8A]" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#0F172A]">PYQ Practice Coming Soon</p>
              <p className="text-xs text-[#64748B]">Year-wise papers coming soon</p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Recall deck alert */}
      {(recallDue || 0) > 0 && (
        <Link href="/decks">
          <Card hover className="mb-6 border-l-4 border-l-[#D97706] bg-[#FFFBEB]">
            <div className="flex items-center gap-3">
              <Layers size={18} className="text-[#D97706]" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0F172A]">
                  {recallDue} cards due for review
                </p>
                <p className="text-xs text-[#64748B]">Tap to practice your recall deck</p>
              </div>
              <Badge variant="warning">{recallDue}</Badge>
            </div>
          </Card>
        </Link>
      )}

      {/* Subject progress */}
      <Card className="rounded-[14px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-[#1E3A8A]" />
            <span className="text-sm font-semibold text-[#0F172A]">Subject Progress</span>
          </div>
          <Badge variant="primary">{profile.exam}</Badge>
        </div>
        <div className="space-y-4">
          {subjectStats.map((stat) => (
            <div key={stat.subject}>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-[#0F172A]">{stat.subject}</span>
                <span className="text-[#476081]">
                  {stat.done} done · {stat.accuracy}% accuracy
                </span>
              </div>
              <div className="w-full h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
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

      {/* Upgrade CTA for free users */}
      {profile.plan === "free" && (
        <Link href="/upgrade">
          <Card hover className="mt-6 bg-gradient-to-r from-[#1E3A8A] to-[#4F46E5] border-none text-white">
            <div className="flex items-center gap-3">
              <Crown size={20} className="text-[#FDE68A] shrink-0" />
              <div>
                <p className="font-semibold text-sm">Upgrade to Pro</p>
                <p className="text-xs text-white/70">Full access, all NEET practice, speed mode</p>
              </div>
              <span className="ml-auto text-xs bg-white/20 px-2.5 py-1 rounded-full">₹99/mo</span>
            </div>
          </Card>
        </Link>
      )}
    </div>
  );
}
