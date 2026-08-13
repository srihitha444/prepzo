import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UploadCloud, Brain, Layers, ClipboardCheck, MessageCircle, BarChart2, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Profile } from "@/lib/supabase/types";
import { getPaperByCode, formatLabel } from "@/lib/ca-syllabus";

const QUICK_ACTIONS = [
  { href: "/notes", icon: UploadCloud, title: "Upload Notes", description: "Turn your notes into MCQs and flashcards" },
  { href: "/practice", icon: Brain, title: "Practice", description: "MCQ and descriptive questions by paper" },
  { href: "/flashcards", icon: Layers, title: "Flashcards", description: "Recall codes, sections, and formulas" },
  { href: "/mock-test", icon: ClipboardCheck, title: "Mock Test", description: "Practice sets and real past papers" },
  { href: "/tutor", icon: MessageCircle, title: "AI Teacher", description: "Get instant answers to your doubts" },
  { href: "/history", icon: BarChart2, title: "History", description: "Analysis of your past practice sessions" },
] as const;

export default async function CaDashboardPage() {
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

  const targetDate = profile.ca_target_attempt_date
    ? new Date(profile.ca_target_attempt_date).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
      })
    : null;

  const selectedPapers = (profile.ca_papers || [])
    .map((code) => getPaperByCode(code))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
        Welcome{profile.name ? `, ${profile.name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-[#64748B]">
        {profile.ca_level ? `CA ${profile.ca_level}` : "CA"}
        {profile.ca_groups && profile.ca_groups.length > 0 ? ` · ${profile.ca_groups.join(" & ")}` : ""}
        {targetDate ? ` · Targeting ${targetDate}` : ""}
      </p>

      {selectedPapers.length > 0 && (
        <div className="mt-6 space-y-2">
          {selectedPapers.map((paper) => (
            <div
              key={paper.code}
              className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-4 py-3"
            >
              <span className="text-sm font-semibold text-[#0F172A]">{paper.name}</span>
              <span className="text-xs font-medium text-[#64748B]">{formatLabel(paper)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card hover className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1E3A8A]">
                <action.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0F172A]">{action.title}</p>
                <p className="text-xs text-[#64748B]">{action.description}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-[#94A3B8]" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
