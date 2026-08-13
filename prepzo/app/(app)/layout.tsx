import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { StudyProfilePrompt } from "@/components/profile/StudyProfilePrompt";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.exam) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <Sidebar profile={profile} />
      <TopBar profile={profile} />
      <main className="md:ml-60 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>
      <BottomNav />
      <StudyProfilePrompt userId={user.id} profile={profile} />
    </div>
  );
}
