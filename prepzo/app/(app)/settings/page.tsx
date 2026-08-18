"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  User, BookOpen, SlidersHorizontal, CreditCard, HelpCircle,
  ChevronRight, Sun, Moon, Monitor, Trash2, LogOut, AlertTriangle,
  Check, Shield, Bell, Save, Crown, Copy, Gift,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import type { Profile } from "@/lib/supabase/types";

type Section = "account" | "study" | "practice" | "subscription" | "help";
type Theme = "light" | "dark" | "system";

interface Prefs {
  mcqDailyGoal: number;
  mcqTimer: number;
  mcqRecallFrequency: string;
  recallFrequency: string;
  flashcardGoal: number;
  flashcardRecallFrequency: string;
  speedModeInterval: number;
  recallSpeedModeInterval: number;
  reviewSpeedModeInterval: number;
  difficulty: string;
  showExplanation: string;
  randomizeOrder: boolean;
  autoAdvance: boolean;
  weakTopicThreshold: number;
  weakTopicMinAttempts: number;
  newCardsPerDay: number;
  studyMode: string;
  theme: Theme;
}

const DEFAULT_PREFS: Prefs = {
  mcqDailyGoal: 15,
  mcqTimer: 30,
  mcqRecallFrequency: "daily",
  recallFrequency: "daily",
  flashcardGoal: 5,
  flashcardRecallFrequency: "daily",
  speedModeInterval: 5,
  recallSpeedModeInterval: 5,
  reviewSpeedModeInterval: 7,
  difficulty: "mixed",
  showExplanation: "immediate",
  randomizeOrder: true,
  autoAdvance: true,
  weakTopicThreshold: 60,
  weakTopicMinAttempts: 5,
  newCardsPerDay: 5,
  studyMode: "mixed",
  theme: "system",
};

function getInitialPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  const saved = localStorage.getItem("prepzo_prefs");
  if (!saved) return DEFAULT_PREFS;

  try {
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      mcqDailyGoal: parsed.mcqDailyGoal || DEFAULT_PREFS.mcqDailyGoal,
      mcqRecallFrequency: parsed.mcqRecallFrequency || parsed.recallFrequency || DEFAULT_PREFS.mcqRecallFrequency,
      flashcardGoal: parsed.flashcardGoal || parsed.newCardsPerDay || DEFAULT_PREFS.flashcardGoal,
      flashcardRecallFrequency:
        parsed.flashcardRecallFrequency || parsed.recallFrequency || DEFAULT_PREFS.flashcardRecallFrequency,
      recallSpeedModeInterval:
        parsed.recallSpeedModeInterval || parsed.speedModeInterval || DEFAULT_PREFS.recallSpeedModeInterval,
      reviewSpeedModeInterval:
        parsed.reviewSpeedModeInterval || parsed.speedModeInterval || DEFAULT_PREFS.reviewSpeedModeInterval,
      newCardsPerDay: parsed.newCardsPerDay || parsed.flashcardGoal || DEFAULT_PREFS.newCardsPerDay,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function clampFreePrefs(prefs: Prefs): Prefs {
  return {
    ...prefs,
    mcqDailyGoal: Math.min(prefs.mcqDailyGoal || DEFAULT_PREFS.mcqDailyGoal, 15),
    flashcardGoal: Math.min(prefs.flashcardGoal || DEFAULT_PREFS.flashcardGoal, 5),
    newCardsPerDay: Math.min(prefs.newCardsPerDay || DEFAULT_PREFS.newCardsPerDay, 5),
  };
}

function getCombinedGoal(prefs: Prefs): number {
  return (prefs.mcqDailyGoal || DEFAULT_PREFS.mcqDailyGoal) + (prefs.flashcardGoal || DEFAULT_PREFS.flashcardGoal);
}

const NAV = [
  { id: "account" as Section, label: "Account & Profile", icon: User },
  { id: "study" as Section, label: "Study Preferences", icon: BookOpen },
  { id: "practice" as Section, label: "Practice & Quiz", icon: SlidersHorizontal },
  { id: "subscription" as Section, label: "Subscription & Billing", icon: CreditCard },
  { id: "help" as Section, label: "Help & Support", icon: HelpCircle },
];

export default function SettingsPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("account");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(getInitialPrefs);

  // Pending (unsaved) state for each section
  const [pendingStudy, setPendingStudy] = useState<Partial<Prefs>>({});
  const [pendingPractice, setPendingPractice] = useState<Partial<Prefs>>({});
  const [studyDirty, setStudyDirty] = useState(false);
  const [practiceDirty, setPracticeDirty] = useState(false);

  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [sendingEmailChange, setSendingEmailChange] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState("Prepzo Pro");

  const [name, setName] = useState("");
  const [dailyGoal, setDailyGoal] = useState(20);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("profiles").select("*").single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setName(data.name || "");
        setDailyGoal(data.daily_goal || 20);
        if (data.plan !== "paid") {
          setPrefs((current) => {
            const next = clampFreePrefs(current);
            localStorage.setItem("prepzo_prefs", JSON.stringify(next));
            return next;
          });
        }
      }
    });

    fetch("/api/referrals/me")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.referral_code?.code) setReferralCode(data.referral_code.code);
      })
      .catch(() => {});
  }, []);

  // Merge pending into saved prefs
  const studyPrefs = { ...prefs, ...pendingStudy };
  const practicePrefs = { ...prefs, ...pendingPractice };

  function openPremiumModal(feature: string) {
    setPremiumFeature(feature);
    setPremiumModalOpen(true);
  }

  async function saveSection(section: "study" | "practice") {
    const updates = section === "study" ? pendingStudy : pendingPractice;
    let next = { ...prefs, ...updates };
    if (profile?.plan !== "paid") next = clampFreePrefs(next);
    setPrefs(next);
    localStorage.setItem("prepzo_prefs", JSON.stringify(next));

    if (section === "study" && profile) {
      const combinedGoal = getCombinedGoal(next);
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ daily_goal: combinedGoal })
        .eq("id", profile.id);
      if (error) {
        toast.error("Failed to save daily goal");
        return;
      }
      setDailyGoal(combinedGoal);
    }

    if (section === "study") { setPendingStudy({}); setStudyDirty(false); }
    else { setPendingPractice({}); setPracticeDirty(false); }
    toast.success("Settings saved — applies to your next session");
  }

  function updateStudy(updates: Partial<Prefs>) {
    setPendingStudy((p) => ({ ...p, ...updates }));
    setStudyDirty(true);
  }

  function updatePractice(updates: Partial<Prefs>) {
    setPendingPractice((p) => ({ ...p, ...updates }));
    setPracticeDirty(true);
  }

  // Theme saves immediately and fires event so ThemeProvider picks it up
  function saveTheme(theme: Theme) {
    const next = { ...prefs, ...pendingStudy, ...pendingPractice, theme };
    setPrefs(next);
    localStorage.setItem("prepzo_prefs", JSON.stringify(next));
    window.dispatchEvent(new Event("prepzo-theme-change"));
    toast.success(`Theme set to ${theme}`);
  }

  async function saveProfile() {
    if (!profile) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ name, daily_goal: dailyGoal })
      .eq("id", profile.id);
    setLoading(false);
    if (error) { toast.error("Failed to save profile"); return; }
    toast.success("Profile updated");
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleDeleteAccount() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete account");

      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Account deleted");
      router.push("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  async function submitEmailChange() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSendingEmailChange(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setSendingEmailChange(false);
    if (error) {
      toast.error(error.message || "Failed to start email change");
      return;
    }
    toast.success(`Confirmation link sent to ${newEmail} — click it to finish the change`);
    setChangingEmail(false);
    setNewEmail("");
  }

  async function copyReferralCode() {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied");
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-6">Settings</h1>

      <div className="flex flex-col md:flex-row gap-6">

        {/* SIDEBAR NAV */}
        <aside className="md:w-52 shrink-0">
          <Card className="p-2 space-y-0.5">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  activeSection === item.id
                    ? "bg-[#1E3A8A] text-white"
                    : "text-[#64748B] hover:bg-[#F8FAFF] hover:text-[#0F172A]"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </Card>

          {/* Theme picker — saves immediately */}
          <Card className="p-3 mt-3">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2 px-1">Theme</p>
            <div className="flex gap-1">
              {([["light", Sun, "Light"], ["dark", Moon, "Dark"], ["system", Monitor, "System"]] as [Theme, React.ElementType, string][]).map(([val, Icon, label]) => (
                <button
                  key={val}
                  onClick={() => saveTheme(val)}
                  title={label}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs transition-all ${
                    prefs.theme === val ? "bg-[#1E3A8A] text-white" : "text-[#64748B] hover:bg-[#F8FAFF]"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        {/* CONTENT */}
        <div className="flex-1 space-y-4">

          {/* ── ACCOUNT ── */}
          {activeSection === "account" && (
            <>
              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-5">Edit Profile</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Full Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Target Exam</label>
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] px-4 py-3 text-sm font-semibold text-[#0F172A]">
                      NEET
                    </div>
                  </div>
                  <button onClick={saveProfile} disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-sm font-semibold transition-all disabled:opacity-60">
                    {loading ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-4">Account Actions</h2>
                <div className="space-y-2">
                  <SettingsRow icon={Shield} label="Update Password" sublabel="Change your login password"
                    onClick={async () => {
                      const supabase = createClient();
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user?.email) {
                        await supabase.auth.resetPasswordForEmail(user.email, {
                          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
                        });
                        toast.success("Password reset email sent");
                      }
                    }} />
                  <SettingsRow icon={Bell} label="Change Email" sublabel="Update your email address"
                    onClick={() => setChangingEmail((v) => !v)} />
                  {changingEmail && (
                    <div className="ml-4 flex gap-2 rounded-xl bg-[#F8FAFF] p-3">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="New email address"
                        className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:border-[#1E3A8A] focus:outline-none"
                      />
                      <button
                        onClick={submitEmailChange}
                        disabled={sendingEmailChange || !newEmail.trim()}
                        className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-[#162D6B] disabled:opacity-50"
                      >
                        {sendingEmailChange ? "Sending..." : "Send link"}
                      </button>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-4">Session</h2>
                <button onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-[#64748B] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-all">
                  <LogOut size={16} /> Sign Out
                </button>
              </Card>

              <Card className="border-[#FECACA]">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle size={18} className="text-[#DC2626] shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-base font-bold text-[#DC2626]">Delete Account</h2>
                    <p className="text-xs text-[#64748B] mt-1">
                      This immediately and permanently deletes your account and all your data. This cannot be undone.
                    </p>
                  </div>
                </div>
                {deleteConfirm && (
                  <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 mb-3 text-sm text-[#DC2626]">
                    Are you sure? Tap again to permanently delete your account.
                  </div>
                )}
                <button onClick={handleDeleteAccount} disabled={deleting}
                  className="px-5 py-2.5 rounded-xl border-2 border-[#DC2626] text-[#DC2626] text-sm font-semibold hover:bg-[#FEF2F2] transition-all disabled:opacity-60 flex items-center gap-2">
                  <Trash2 size={14} />
                  {deleting ? "Deleting..." : deleteConfirm ? "Confirm Delete" : "Delete Account"}
                </button>
              </Card>
            </>
          )}

          {/* ── STUDY PREFERENCES ── */}
          {activeSection === "study" && (
            <>
              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-1">Daily MCQ Goal</h2>
                <p className="text-xs text-[#64748B] mb-4">Questions you want to complete each day.</p>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 15, 20, 30].map((g) => {
                    const isPro = g > 15 && profile?.plan !== "paid";
                    return (
                      <button key={g} onClick={() => isPro ? openPremiumModal(`${g} MCQs per day`) : updateStudy({ mcqDailyGoal: g })}
                        className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-1 ${
                          studyPrefs.mcqDailyGoal === g
                            ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                            : isPro
                              ? "border-[#E2E8F0] text-[#94A3B8] hover:border-[#F59E0B]"
                              : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                        }`}>
                        {isPro && <Crown size={12} className="text-[#D97706]" />} {g}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-1">MCQ Recall Frequency</h2>
                <p className="text-xs text-[#64748B] mb-4">How often MCQ recall reviews appear.</p>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: "daily", label: "Every day" }, { value: "every2days", label: "Every 2 days" }, { value: "weekly", label: "Weekly" }].map(({ value, label }) => (
                    <button key={value} onClick={() => updateStudy({ mcqRecallFrequency: value, recallFrequency: value })}
                      className={`py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${studyPrefs.mcqRecallFrequency === value ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-1">Weak Topic Threshold</h2>
                <p className="text-xs text-[#64748B] mb-4">Topics below this accuracy are flagged for extra practice.</p>
                <div className="grid grid-cols-4 gap-2">
                  {[50, 55, 60, 65].map((v) => (
                    <button key={v} onClick={() => updateStudy({ weakTopicThreshold: v })}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${studyPrefs.weakTopicThreshold === v ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-1">Weak Topic Attempts</h2>
                <p className="text-xs text-[#64748B] mb-4">Minimum attempts before a topic can be flagged as weak.</p>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 10, 15].map((v) => (
                    <button key={v} onClick={() => updateStudy({ weakTopicMinAttempts: v })}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${studyPrefs.weakTopicMinAttempts === v ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-1">Daily Flashcard Goal</h2>
                <p className="text-xs text-[#64748B] mb-4">Flashcards you want in each session.</p>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((v) => {
                    const isPro = v > 5 && profile?.plan !== "paid";
                    return (
                      <button key={v} onClick={() => isPro ? openPremiumModal(`${v} flashcards per session`) : updateStudy({ flashcardGoal: v, newCardsPerDay: v })}
                        className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-1 ${
                          studyPrefs.flashcardGoal === v
                            ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                            : isPro
                              ? "border-[#E2E8F0] text-[#94A3B8] hover:border-[#F59E0B]"
                              : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                        }`}>
                        {isPro && <Crown size={12} className="text-[#D97706]" />}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-1">Flashcard Recall Frequency</h2>
                <p className="text-xs text-[#64748B] mb-4">How often flashcard recall reviews appear.</p>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: "daily", label: "Every day" }, { value: "every2days", label: "Every 2 days" }, { value: "weekly", label: "Weekly" }].map(({ value, label }) => (
                    <button key={value} onClick={() => updateStudy({ flashcardRecallFrequency: value })}
                      className={`py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${studyPrefs.flashcardRecallFrequency === value ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </Card>

              {studyDirty && (
                <button onClick={() => saveSection("study")}
                  className="flex items-center gap-2 w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold text-sm justify-center transition-all">
                  <Save size={16} /> Save Study Preferences
                </button>
              )}
            </>
          )}

          {/* ── PRACTICE & QUIZ ── */}
          {activeSection === "practice" && (
            <>
              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-1">MCQ Timer per Question</h2>
                <p className="text-xs text-[#64748B] mb-4">Default countdown time for each MCQ.</p>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map((s) => (
                    <button key={s} onClick={() => updatePractice({ mcqTimer: s })}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${practicePrefs.mcqTimer === s ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                      {s}s
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-[#0F172A]">Speed Mode Auto-Advance</h2>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] text-xs font-semibold">
                    <Crown size={10} /> Pro
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mb-4">How long each flashcard shows before moving on.</p>
                {profile?.plan !== "paid" ? (
                  <button onClick={() => openPremiumModal("Speed Mode auto-advance")} className="flex items-center gap-2 text-sm text-[#1E3A8A] font-semibold underline">
                    <Crown size={14} className="text-[#D97706]" /> Upgrade to unlock Speed Mode
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 5, 7].map((s) => (
                      <button key={s} onClick={() => updatePractice({ speedModeInterval: s })}
                        className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${practicePrefs.speedModeInterval === s ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                        {s}s
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-[#0F172A]">Recall Deck Speed</h2>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] text-xs font-semibold">
                    <Crown size={10} /> Pro
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mb-4">Auto flip and file recall flashcards during Speed Mode.</p>
                {profile?.plan !== "paid" ? (
                  <button onClick={() => openPremiumModal("Recall deck Speed Mode")} className="flex items-center gap-2 text-sm text-[#1E3A8A] font-semibold underline">
                    <Crown size={14} className="text-[#D97706]" /> Upgrade to unlock Recall Speed
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 5, 7].map((s) => (
                      <button key={s} onClick={() => updatePractice({ recallSpeedModeInterval: s })}
                        className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${practicePrefs.recallSpeedModeInterval === s ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                        {s}s
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-[#0F172A]">Review Deck Speed</h2>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] text-xs font-semibold">
                    <Crown size={10} /> Pro
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mb-4">Auto flip and file review flashcards during Speed Mode.</p>
                {profile?.plan !== "paid" ? (
                  <button onClick={() => openPremiumModal("Review deck Speed Mode")} className="flex items-center gap-2 text-sm text-[#1E3A8A] font-semibold underline">
                    <Crown size={14} className="text-[#D97706]" /> Upgrade to unlock Review Speed
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 7, 10].map((s) => (
                      <button key={s} onClick={() => updatePractice({ reviewSpeedModeInterval: s })}
                        className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${practicePrefs.reviewSpeedModeInterval === s ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                        {s}s
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-1">Question Difficulty</h2>
                <p className="text-xs text-[#64748B] mb-4">Default difficulty mix for quiz sessions.</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[{ value: "mixed", label: "Adaptive" }, { value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }].map(({ value, label }) => (
                    <button key={value} onClick={() => updatePractice({ difficulty: value })}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${practicePrefs.difficulty === value ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-4">Quiz Behaviour</h2>
                <div className="space-y-4">
                  <ToggleRow label="Show explanation immediately" sublabel="Show explanation right after answering"
                    checked={practicePrefs.showExplanation === "immediate"}
                    onChange={(v) => updatePractice({ showExplanation: v ? "immediate" : "end" })} />
                  <ToggleRow label="Randomise question order" sublabel="Shuffle questions in each session"
                    checked={practicePrefs.randomizeOrder}
                    onChange={(v) => updatePractice({ randomizeOrder: v })} />
                  {profile?.plan === "paid" ? (
                    <ToggleRow label="Speed Mode auto-advance" sublabel="Cards advance automatically in Speed Mode"
                      checked={practicePrefs.autoAdvance}
                      onChange={(v) => updatePractice({ autoAdvance: v })} />
                  ) : (
                    <button onClick={() => openPremiumModal("Speed Mode auto-advance")} className="flex items-center justify-between gap-4 opacity-50 text-left w-full">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A] flex items-center gap-1.5">
                          <Crown size={12} className="text-[#D97706]" /> Speed Mode auto-advance
                        </p>
                        <p className="text-xs text-[#64748B]">Pro feature — upgrade to enable</p>
                      </div>
                      <div className="w-11 h-6 rounded-full bg-[#E2E8F0] relative shrink-0 cursor-not-allowed">
                        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow" />
                      </div>
                    </button>
                  )}
                </div>
              </Card>

              {practiceDirty && (
                <button onClick={() => saveSection("practice")}
                  className="flex items-center gap-2 w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold text-sm justify-center transition-all">
                  <Save size={16} /> Save Practice Settings
                </button>
              )}

              {!practiceDirty && (
                <p className="text-xs text-center text-[#94A3B8]">Changes apply from your next quiz session.</p>
              )}
            </>
          )}

          {/* ── SUBSCRIPTION ── */}
          {activeSection === "subscription" && (
            <>
              <Card>
                <div className="mb-4 flex items-center gap-2">
                  <Gift size={18} className="text-[#1E3A8A]" />
                  <h2 className="text-base font-bold text-[#0F172A]">Referral Code</h2>
                </div>
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4">
                  <p className="text-xs font-semibold text-[#64748B]">Friend gets 10% off. You earn 20% commission for one year after they pay.</p>
                  <div className="mt-3 flex gap-2">
                    <div className="flex-1 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 font-[family-name:var(--font-dm-mono)] text-sm font-bold tracking-wide text-[#0F172A]">
                      {referralCode || "Loading..."}
                    </div>
                    <button
                      type="button"
                      onClick={copyReferralCode}
                      disabled={!referralCode}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1E3A8A] px-4 text-sm font-semibold text-white hover:bg-[#162D6B] disabled:opacity-60"
                    >
                      <Copy size={15} />
                      Copy
                    </button>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-4">Current Plan</h2>
                <div className={`rounded-xl p-4 mb-4 ${profile?.plan === "paid" ? "bg-[#1E3A8A] text-white" : "bg-[#F8FAFF] border border-[#E2E8F0]"}`}>
                  <p className={`text-lg font-bold ${profile?.plan === "paid" ? "text-white" : "text-[#0F172A]"}`}>
                    {profile?.plan === "paid" ? "Pro Member ✨" : "Free Plan"}
                  </p>
                  <p className={`text-sm mt-1 ${profile?.plan === "paid" ? "text-white/70" : "text-[#64748B]"}`}>
                    {profile?.plan === "paid"
                      ? "You have full access to all Prepzo features."
                      : "15 MCQs/day · NEET track · Basic features"}
                  </p>
                </div>
                {profile?.plan !== "paid" && (
                  <a href="/upgrade"
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#162D6B] transition-all">
                    Upgrade to Pro — from ₹99/month <ChevronRight size={16} />
                  </a>
                )}
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-4">Billing</h2>
                <div className="space-y-2">
                  <SettingsRow icon={CreditCard} label="Payment History" sublabel="View past transactions"
                    onClick={() => toast("Payment history coming soon")} />
                  {profile?.plan === "paid" && (
                    <SettingsRow icon={AlertTriangle} label="Cancel Subscription"
                      sublabel="Access continues until end of billing period"
                      onClick={() => toast("To cancel, contact support@prepzo.study")} danger />
                  )}
                </div>
              </Card>
            </>
          )}

          {/* ── HELP ── */}
          {activeSection === "help" && (
            <Card>
              <h2 className="text-base font-bold text-[#0F172A] mb-4">Help &amp; Support</h2>
              <div className="space-y-2">
                <SettingsRow icon={HelpCircle} label="Help Center / FAQs" sublabel="Browse common questions and guides"
                  onClick={() => toast("Help Center coming soon")} />
                <SettingsRow icon={Bell} label="Contact Support" sublabel="Reach us at support@prepzo.study"
                  onClick={() => { window.location.href = "mailto:support@prepzo.study"; }} />
                <SettingsRow icon={AlertTriangle} label="Report a Bug" sublabel="Help us fix issues"
                  onClick={() => { window.location.href = "mailto:support@prepzo.study?subject=Bug Report"; }} />
                <SettingsRow icon={Check} label="Share Feedback" sublabel="Tell us how we can improve"
                  onClick={() => toast("Thanks! Feedback form coming soon")} />
              </div>
            </Card>
          )}

        </div>
      </div>

      <Modal open={premiumModalOpen} onClose={() => setPremiumModalOpen(false)} title="Available on Pro">
        <div className="space-y-4">
          <div className="rounded-xl bg-[#FEF3C7] border border-[#FDE68A] p-4">
            <div className="flex items-center gap-2 text-[#D97706] font-semibold text-sm">
              <Crown size={16} /> {premiumFeature}
            </div>
            <p className="text-xs text-[#92400E] mt-2">
              This is a premium feature. Your current plan can use 15 MCQs per day, 5 flashcards per day, all weak topic thresholds, and standard quiz controls.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPremiumModalOpen(false)}
              className="py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFF] transition-all"
            >
              Keep Free Plan
            </button>
            <a
              href="/upgrade"
              className="py-2.5 rounded-xl bg-[#1E3A8A] text-sm font-semibold text-white text-center hover:bg-[#162D6B] transition-all"
            >
              View Pro
            </a>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SettingsRow({ icon: Icon, label, sublabel, onClick, danger }: {
  icon: React.ElementType; label: string; sublabel?: string; onClick?: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-left transition-all ${danger ? "text-[#DC2626] hover:bg-[#FEF2F2]" : "text-[#0F172A] hover:bg-[#F8FAFF]"}`}>
      <Icon size={16} className={danger ? "text-[#DC2626]" : "text-[#64748B]"} />
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        {sublabel && <p className="text-xs text-[#64748B]">{sublabel}</p>}
      </div>
      <ChevronRight size={14} className="text-[#94A3B8]" />
    </button>
  );
}

function ToggleRow({ label, sublabel, checked, onChange }: {
  label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#0F172A]">{label}</p>
        {sublabel && <p className="text-xs text-[#64748B]">{sublabel}</p>}
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${checked ? "bg-[#1E3A8A]" : "bg-[#E2E8F0]"}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
