"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { StudyProfileFields } from "./StudyProfileFields";

interface StudyProfilePromptProps {
  userId: string;
  profile: Profile | null;
}

export function StudyProfilePrompt({ userId, profile }: StudyProfilePromptProps) {
  const initialTargetExams = useMemo(() => profile?.survey_target_exams ?? [], [profile?.survey_target_exams]);
  const [currentStage, setCurrentStage] = useState(profile?.survey_current_stage ?? "");
  const [targetExams, setTargetExams] = useState<string[]>(initialTargetExams);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const needsProfile = !profile?.survey_completed_at;

  if (!needsProfile || saved) return null;

  async function handleSave() {
    if (!currentStage || targetExams.length === 0) {
      toast.error("Select your class and at least one exam");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        survey_current_stage: currentStage,
        survey_target_exams: targetExams,
        survey_completed_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      toast.error("Could not save your response");
      return;
    }

    toast.success("Response saved");
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-[18px] border border-[#E2E8F0] bg-white p-6 shadow-2xl">
        <div className="mb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#1E3A8A]">Quick survey</p>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
            Tell us what you are preparing for
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            This helps Prepzo understand what students need next, while your app access remains focused on NEET
          </p>
        </div>

        <StudyProfileFields
          currentStage={currentStage}
          targetExams={targetExams}
          onStageChange={setCurrentStage}
          onTargetExamsChange={setTargetExams}
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-7 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#1E3A8A] px-4 text-sm font-semibold text-white transition-all hover:bg-[#162D6B] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save and continue"}
        </button>
      </div>
    </div>
  );
}
