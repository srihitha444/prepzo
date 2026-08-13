import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaSidebar } from "@/components/layout/CaSidebar";
import { CaBottomNav } from "@/components/layout/CaBottomNav";
import type { Profile } from "@/lib/supabase/types";

export default async function CaAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ca/auth/login");
  }

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as Profile | null;

  if (profile?.exam !== "CA" || !profile.ca_level) {
    redirect("/ca/onboarding");
  }

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <CaSidebar profile={profile} />
      <main className="md:ml-60 pb-20 md:pb-0 min-h-screen">{children}</main>
      <CaBottomNav />
    </div>
  );
}
