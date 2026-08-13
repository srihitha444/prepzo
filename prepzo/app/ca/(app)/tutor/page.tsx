import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TutorWorkspace } from "@/components/ca/TutorWorkspace";
import type { Profile } from "@/lib/supabase/types";

export default async function CaTutorPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const { note: noteId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ca/auth/login");

  const { data: profileRaw } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRaw as Profile | null;
  if (profile?.exam !== "CA" || !profile.ca_level) redirect("/ca/onboarding");

  const { data: recentSessions } = await supabase
    .from("quiz_sessions")
    .select("subject, correct, total_questions")
    .eq("user_id", user.id)
    .eq("exam", "CA")
    .order("completed_at", { ascending: false })
    .limit(5);

  const currentTopic = recentSessions?.[0]?.subject || null;
  const scored = (recentSessions || []).filter((s) => s.total_questions);
  const recentAccuracy = scored.length
    ? Math.round((scored.reduce((sum, s) => sum + (s.correct || 0) / s.total_questions!, 0) / scored.length) * 100)
    : null;

  let noteTitle: string | null = null;
  if (noteId) {
    const { data: note } = await supabase.from("user_notes").select("title").eq("id", noteId).eq("user_id", user.id).single();
    noteTitle = note?.title || null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
        AI Teacher
      </h1>
      <p className="mt-1 mb-6 text-sm text-[#64748B]">
        {noteTitle
          ? `Ask about "${noteTitle}" — I'll teach from your own notes.`
          : "Get instant, syllabus-grounded answers to your CA doubts, drawing on your uploaded notes."}
      </p>

      <TutorWorkspace
        caLevel={profile.ca_level}
        currentTopic={currentTopic}
        recentAccuracy={recentAccuracy}
        initialNoteId={noteId}
        initialNoteTitle={noteTitle}
      />
    </div>
  );
}
