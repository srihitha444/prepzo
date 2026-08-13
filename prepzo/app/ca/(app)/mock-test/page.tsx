import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MockTestRunner } from "@/components/ca/MockTestRunner";
import { getPaperByCode, type CaPaper } from "@/lib/ca-syllabus";
import type { Profile } from "@/lib/supabase/types";

export default async function CaMockTestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ca/auth/login");

  const { data: profileRaw } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRaw as Profile | null;
  if (profile?.exam !== "CA" || !profile.ca_level) redirect("/ca/onboarding");

  const papers = (profile.ca_papers || [])
    .map((code) => getPaperByCode(code))
    .filter((p): p is CaPaper => Boolean(p));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
        Mock Test
      </h1>

      {papers.length === 0 ? (
        <p className="text-sm text-[#64748B]">Select your papers in onboarding to start a mock test.</p>
      ) : (
        <MockTestRunner papers={papers} userId={user.id} />
      )}
    </div>
  );
}
