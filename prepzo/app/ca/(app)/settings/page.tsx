import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaSettingsShell } from "@/components/ca/CaSettingsShell";
import type { Profile } from "@/lib/supabase/types";

export default async function CaSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ca/auth/login");

  const { data: profileRaw } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRaw as Profile | null;
  if (profile?.exam !== "CA" || !profile.ca_level) redirect("/ca/onboarding");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:p-8">
      <h1 className="mb-6 font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
        Settings
      </h1>

      <CaSettingsShell
        userId={user.id}
        initialName={profile.name || ""}
        initialLevel={profile.ca_level}
        initialGroups={profile.ca_groups || []}
        initialPapers={profile.ca_papers || []}
        initialTargetDate={profile.ca_target_attempt_date || ""}
      />
    </div>
  );
}
