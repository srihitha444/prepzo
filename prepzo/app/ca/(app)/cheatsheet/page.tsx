import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheatsheetWorkspace } from "@/components/ca/CheatsheetWorkspace";
import type { Profile } from "@/lib/supabase/types";

export default async function CaCheatsheetPage({
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
        Cheatsheet
      </h1>
      <p className="mt-1 mb-6 text-sm text-[#64748B]">
        Condensed, editable revision notes generated from your uploads — downloadable as a PDF.
      </p>

      <CheatsheetWorkspace initialNoteId={noteId} />
    </div>
  );
}
