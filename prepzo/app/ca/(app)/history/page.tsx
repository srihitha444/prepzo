import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckCircle2, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScoreTrendChart, type ScorePoint } from "@/components/ca/ScoreTrendChart";
import { getPaperByCode } from "@/lib/ca-syllabus";

interface QuizSessionRow {
  id: string;
  subject: string | null;
  note_id: string | null;
  question_type: string | null;
  total_questions: number | null;
  correct: number | null;
  completed_at: string;
}

interface FlashcardSessionRow {
  id: string;
  subject: string | null;
  note_id: string | null;
  total_cards: number;
  recall_count: number;
  completed_at: string;
}

interface MockTestAttemptRow {
  id: string;
  paper: string;
  total_score: number | null;
  total_possible: number | null;
  completed_at: string;
}

function accuracy(correct: number | null, total: number | null): number | null {
  if (!total) return null;
  return Math.round(((correct || 0) / total) * 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function CaHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ca/auth/login");

  const [{ data: quizRaw }, { data: flashcardRaw }, { data: mockTestRaw }, { data: notesRaw }] = await Promise.all([
    supabase
      .from("quiz_sessions")
      .select("id, subject, note_id, question_type, total_questions, correct, completed_at")
      .eq("user_id", user.id)
      .eq("exam", "CA")
      .order("completed_at", { ascending: false }),
    supabase
      .from("flashcard_sessions")
      .select("id, subject, note_id, total_cards, recall_count, completed_at")
      .eq("user_id", user.id)
      .eq("exam", "CA")
      .order("completed_at", { ascending: false }),
    supabase
      .from("ca_mock_test_attempts")
      .select("id, paper, total_score, total_possible, completed_at")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false }),
    supabase.from("user_notes").select("id, title").eq("user_id", user.id),
  ]);

  const quizSessions = (quizRaw || []) as QuizSessionRow[];
  const flashcardSessions = (flashcardRaw || []) as FlashcardSessionRow[];
  const mockTestAttempts = (mockTestRaw || []) as MockTestAttemptRow[];
  const noteTitleById = new Map<string, string>((notesRaw || []).map((n) => [n.id as string, n.title as string]));

  const scoredQuizSessions = quizSessions
    .map((s) => ({ subject: s.subject, score: accuracy(s.correct, s.total_questions), completed_at: s.completed_at }))
    .filter((s): s is { subject: string | null; score: number; completed_at: string } => s.score !== null);

  const scoredMockTests = mockTestAttempts
    .map((m) => ({
      subject: getPaperByCode(m.paper)?.name || m.paper,
      score: accuracy(m.total_score, m.total_possible),
      completed_at: m.completed_at,
    }))
    .filter((s): s is { subject: string | null; score: number; completed_at: string } => s.score !== null);

  const allScored = [...scoredQuizSessions, ...scoredMockTests];

  const averageScore = allScored.length
    ? Math.round(allScored.reduce((sum, s) => sum + s.score, 0) / allScored.length)
    : null;

  const bySubject = new Map<string, { total: number; count: number }>();
  for (const s of allScored) {
    if (!s.subject) continue;
    const entry = bySubject.get(s.subject) || { total: 0, count: 0 };
    entry.total += s.score;
    entry.count += 1;
    bySubject.set(s.subject, entry);
  }
  const subjectAverages = Array.from(bySubject.entries()).map(([subject, { total, count }]) => ({
    subject,
    avg: total / count,
  }));
  const strongest = subjectAverages.length ? subjectAverages.reduce((a, b) => (a.avg >= b.avg ? a : b)) : null;
  const weakest = subjectAverages.length ? subjectAverages.reduce((a, b) => (a.avg <= b.avg ? a : b)) : null;

  const statTiles = [
    { label: "Tests Taken", value: String(quizSessions.length + mockTestAttempts.length), icon: CheckCircle2 },
    { label: "Average Score", value: averageScore !== null ? `${averageScore}%` : "—", icon: Target },
    { label: "Strongest Paper", value: strongest?.subject || "—", icon: TrendingUp },
    { label: "Weakest Paper", value: weakest?.subject || "—", icon: TrendingDown },
  ];

  const trendData: ScorePoint[] = allScored
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
    .slice(-10)
    .map((s) => ({ session: formatDate(s.completed_at), score: s.score }));

  const recentSessions = [
    ...quizSessions.map((s) => ({
      id: `quiz-${s.id}`,
      date: s.completed_at,
      label: s.note_id ? noteTitleById.get(s.note_id) || s.subject || "CA Practice" : s.subject || "CA Practice",
      mode: s.question_type === "descriptive" ? "Descriptive" : "MCQ",
      score: accuracy(s.correct, s.total_questions),
    })),
    ...flashcardSessions.map((s) => ({
      id: `flashcard-${s.id}`,
      date: s.completed_at,
      label: s.note_id ? noteTitleById.get(s.note_id) || s.subject || "Flashcards" : s.subject || "Flashcards",
      mode: "Flashcards" as const,
      score: accuracy(s.recall_count, s.total_cards),
    })),
    ...mockTestAttempts.map((m) => ({
      id: `mocktest-${m.id}`,
      date: m.completed_at,
      label: getPaperByCode(m.paper)?.name || m.paper,
      mode: "Mock Test" as const,
      score: accuracy(m.total_score, m.total_possible),
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
        Analysis & History
      </h1>
      <p className="mt-1 text-sm text-[#64748B]">Track your progress across papers and practice sessions.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statTiles.map((tile) => (
          <Card key={tile.label} className="flex flex-col items-start gap-2 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#1E3A8A]">
              <tile.icon size={15} />
            </div>
            <p className="truncate text-lg font-bold text-[#0F172A]" title={tile.value}>{tile.value}</p>
            <p className="text-xs text-[#64748B]">{tile.label}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-[#0F172A]">Score trend</h2>
        <ScoreTrendChart data={trendData} />
      </Card>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-[#0F172A]">Recent sessions</h2>
      {recentSessions.length === 0 ? (
        <p className="text-sm text-[#64748B]">No practice sessions yet — head to Practice or Flashcards to get started.</p>
      ) : (
        <div className="space-y-2">
          {recentSessions.map((session) => (
            <Card key={session.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0F172A]">{session.label}</p>
                <p className="text-xs text-[#64748B]">{formatDate(session.date)} · {session.mode}</p>
              </div>
              {session.score !== null && (
                <Badge variant={session.score >= 70 ? "success" : "warning"}>{session.score}%</Badge>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
