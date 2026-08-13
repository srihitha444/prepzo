"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { CaProfileFields } from "@/components/profile/CaProfileFields";
import { CaPaperSelector } from "@/components/profile/CaPaperSelector";
import { getPapersForLevel } from "@/lib/ca-syllabus";

type Step = 1 | 2;

const TOTAL_STEPS = 2;

export default function CaOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [caLevel, setCaLevel] = useState<string>("");
  const [caGroups, setCaGroups] = useState<string[]>([]);
  const [caPapers, setCaPapers] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState<string>("");
  const [loading, setLoading] = useState(false);

  function handleLevelChange(level: string) {
    setCaLevel(level);
    const groups = level === "Foundation" ? [] : caGroups;
    if (level === "Foundation") setCaGroups([]);
    setCaPapers(getPapersForLevel(level, groups).map((p) => p.code));
  }

  function handleGroupsChange(groups: string[]) {
    setCaGroups(groups);
    setCaPapers(getPapersForLevel(caLevel, groups).map((p) => p.code));
  }

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleComplete() {
    if (!caLevel) {
      toast.error("Select your CA level");
      return;
    }
    const needsGroups = caLevel === "Intermediate" || caLevel === "Final";
    if (needsGroups && caGroups.length === 0) {
      toast.error("Select at least one group");
      return;
    }
    if (caPapers.length === 0) {
      toast.error("Select at least one paper");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/ca/auth/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        exam: "CA",
        ca_level: caLevel,
        ca_groups: caGroups,
        ca_papers: caPapers,
        ca_target_attempt_date: targetDate || null,
        survey_completed_at: new Date().toISOString(),
        daily_goal: 15,
      });

    if (error) {
      toast.error("Something went wrong. Please try again");
      setLoading(false);
      return;
    }

    toast.success("Profile saved! Let's get started");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="h-screen bg-[#F8FAFF] flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-lg h-full max-h-[calc(100vh-2rem)]">
        <div className="h-full bg-white rounded-[22px] border border-[#E2E8F0] shadow-[0_24px_80px_rgba(30,58,138,0.16)] overflow-hidden flex flex-col">
          <div className="flex gap-2 px-6 py-5 border-b border-[#E2E8F0]">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i + 1 <= step ? "bg-[#1E3A8A]" : "bg-[#E2E8F0]"
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-7">
            {step === 1 && (
              <div className="min-h-full flex flex-col justify-center text-center">
                <div className="space-y-4">
                  <div className="text-5xl" aria-hidden="true">
                    🎯
                  </div>
                  <h1 className="font-[family-name:var(--font-fraunces)] text-3xl font-bold text-[#0F172A] leading-tight">
                    Welcome to Prepzo CA!
                  </h1>
                  <p className="text-[#64748B] leading-relaxed">
                    Tell us a bit about your CA prep so we can personalize your study plan.
                  </p>
                </div>

                <div className="mt-7 grid grid-cols-3 gap-3 text-sm">
                  {[
                    { icon: "📝", label: "Upload Notes" },
                    { icon: "⚡", label: "Auto MCQs" },
                    { icon: "🃏", label: "Flashcards" },
                  ].map((item) => (
                    <div key={item.label} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl bg-[#F8FAFF] p-3">
                      <span className="text-2xl" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="text-xs font-medium text-[#64748B]">{item.label}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="mt-8 w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all flex items-center justify-center gap-2"
                >
                  Get Started <ChevronRight size={16} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-2">
                    Quick survey
                  </h2>
                  <p className="text-[#64748B] text-sm">
                    Tell us your CA level, group, and target attempt so we can tailor your prep.
                  </p>
                </div>

                <CaProfileFields
                  caLevel={caLevel}
                  caGroups={caGroups}
                  targetDate={targetDate}
                  onLevelChange={handleLevelChange}
                  onGroupsChange={handleGroupsChange}
                  onTargetDateChange={setTargetDate}
                />

                <CaPaperSelector
                  level={caLevel}
                  groups={caGroups}
                  selectedPapers={caPapers}
                  onChange={setCaPapers}
                />

                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? "Setting up..." : "Start Preparing"}
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-[#64748B] py-4">
            Step {step} of {TOTAL_STEPS}
          </p>
        </div>
      </div>
    </div>
  );
}
