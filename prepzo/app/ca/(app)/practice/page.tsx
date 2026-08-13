import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PracticeExplorer } from "@/components/ca/PracticeExplorer";
import { getPaperByCode, type CaPaper } from "@/lib/ca-syllabus";
import type { Profile } from "@/lib/supabase/types";

export default async function CaPracticePage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const { note: noteId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ca/auth/login");

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as Profile | null;
  if (profile?.exam !== "CA" || !profile.ca_level) redirect("/ca/onboarding");

  const papers = (profile.ca_papers || [])
    .map((code) => getPaperByCode(code))
    .filter((p): p is CaPaper => Boolean(p));

  let noteTitle: string | null = null;
  if (noteId) {
    const { data: note } = await supabase.from("user_notes").select("title").eq("id", noteId).eq("user_id", user.id).single();
    noteTitle = note?.title || null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
        Practice
      </h1>
      <p className="mt-1 text-sm text-[#64748B]">
        {noteTitle
          ? `Practicing questions generated from "${noteTitle}"`
          : "MCQs for objective papers, written-answer practice for descriptive ones — matched to each paper's real exam format."}
      </p>

      <div className="mt-6">
        <PracticeExplorer papers={papers} userId={user.id} noteId={noteId} />
      </div>
    </div>
  );
}
