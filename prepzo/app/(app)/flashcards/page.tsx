import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaFlashcardsPanel } from "@/components/ca/CaFlashcardsPanel";
import { getPaperByCode } from "@/lib/ca-syllabus";
import type { Profile } from "@/lib/supabase/types";

export default async function CaFlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const { note: noteId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as Profile | null;
  if (profile?.exam !== "CA" || !profile.ca_level) redirect("/onboarding");

  const papers = (profile.ca_papers || []).map((code) => getPaperByCode(code)).filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
        Flashcards
      </h1>
      <p className="mt-1 text-sm text-[#64748B]">
        Sections, codes, and formulas from your notes — turned into recall-ready flashcards.
      </p>

      <div className="mt-8">
        {/* CA has no pricing/paid tier — always pass "paid" so the shared useFlashcards free-tier session cap never applies here */}
        <CaFlashcardsPanel
          userId={user.id}
          plan="paid"
          initialNoteId={noteId}
          papers={papers.map((p) => ({ code: p!.code, name: p!.name }))}
        />
      </div>
    </div>
  );
}
