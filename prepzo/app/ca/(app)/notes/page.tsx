import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotesPanel } from "@/components/ca/NotesPanel";
import { getPaperByCode, type CaPaper } from "@/lib/ca-syllabus";
import type { Profile } from "@/lib/supabase/types";

export default async function CaNotesPage() {
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
        Upload Notes
      </h1>
      <p className="mt-1 text-sm text-[#64748B]">
        Upload your CA study notes and Prepzo will turn them into MCQs, descriptive questions, and flashcards.
      </p>

      {papers.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {papers.map((paper) => (
            <span
              key={paper.code}
              className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A8A]"
            >
              {paper.name}
            </span>
          ))}
        </div>
      )}

      <NotesPanel papers={papers} />
    </div>
  );
}
