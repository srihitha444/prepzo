"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { CaProfileFields } from "@/components/profile/CaProfileFields";
import { CaPaperSelector } from "@/components/profile/CaPaperSelector";
import { getPapersForLevel } from "@/lib/ca-syllabus";

export function CaSettingsForm({
  initialLevel,
  initialGroups,
  initialPapers,
  initialTargetDate,
}: {
  initialLevel: string;
  initialGroups: string[];
  initialPapers: string[];
  initialTargetDate: string;
}) {
  const router = useRouter();
  const [caLevel, setCaLevel] = useState(initialLevel);
  const [caGroups, setCaGroups] = useState(initialGroups);
  const [caPapers, setCaPapers] = useState(initialPapers);
  const [targetDate, setTargetDate] = useState(initialTargetDate);
  const [saving, setSaving] = useState(false);

  // Unlike onboarding, don't reset caPapers to "all" every time level/groups
  // change — that would silently wipe out a student's already-cleared-papers
  // customization on every edit. Only re-filter to drop papers that are no
  // longer valid for the newly selected level/group (e.g. switching from
  // Intermediate to Foundation shouldn't leave stale Intermediate paper codes
  // selected), and only add sensible defaults when the level actually changes.
  function dropStalePapers(level: string, groups: string[], prev: string[]) {
    const validCodes = new Set(getPapersForLevel(level, groups).map((p) => p.code));
    const stillValid = prev.filter((code) => validCodes.has(code));
    return stillValid.length > 0 ? stillValid : Array.from(validCodes);
  }

  function handleLevelChange(level: string) {
    const groups = level === "Foundation" ? [] : caGroups;
    setCaLevel(level);
    setCaGroups(groups);
    setCaPapers((prev) => dropStalePapers(level, groups, prev));
  }

  function handleGroupsChange(groups: string[]) {
    setCaGroups(groups);
    setCaPapers((prev) => dropStalePapers(caLevel, groups, prev));
  }

  async function handleSave() {
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

    setSaving(true);
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
      .update({
        ca_level: caLevel,
        ca_groups: caGroups,
        ca_papers: caPapers,
        ca_target_attempt_date: targetDate || null,
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Something went wrong. Please try again");
      return;
    }

    toast.success("Settings saved");
    router.refresh();
  }

  return (
    <Card className="space-y-6">
      <CaProfileFields
        caLevel={caLevel}
        caGroups={caGroups}
        targetDate={targetDate}
        onLevelChange={handleLevelChange}
        onGroupsChange={handleGroupsChange}
        onTargetDateChange={setTargetDate}
      />

      <CaPaperSelector level={caLevel} groups={caGroups} selectedPapers={caPapers} onChange={setCaPapers} />

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-[#1E3A8A] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#162D6B] disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </Card>
  );
}
