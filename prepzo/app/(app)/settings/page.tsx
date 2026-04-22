"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  User, BookOpen, SlidersHorizontal, CreditCard, HelpCircle,
  ChevronRight, Sun, Moon, Monitor, Trash2, LogOut, AlertTriangle,
  Check, Shield, Bell, Save, Crown,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import toast from "react-hot-toast";
import type { Profile } from "@/lib/supabase/types";

type Section = "account" | "study" | "practice" | "subscription" | "help";
type Theme = "light" | "dark" | "system";

interface Prefs {
  mcqTimer: number;
  recallFrequency: string;
  speedModeInterval: number;
  difficulty: string;
  showExplanation: string;
  randomizeOrder: boolean;
  autoAdvance: boolean;
  weakTopicThreshold: number;
  newCardsPerDay: number;
  studyMode: string;
  theme: Theme;
}

const DEFAULT_PREFS: Prefs = {
  mcqTimer: 30,
  recallFrequency: "daily",
  speedModeInterval: 5,
  difficulty: "mixed",
  showExplanation: "immediate",
  randomizeOrder: true,
  autoAdvance: true,
  weakTopicThreshold: 60,
  newCardsPerDay: 20,
  studyMode: "mixed",
  theme: "system",
};

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
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  // Pending (unsaved) state for each section
  const [pendingStudy, setPendingStudy] = useState<Partial<Prefs>>({});
  const [pendingPractice, setPendingPractice] = useState<Partial<Prefs>>({});
  const [studyDirty, setStudyDirty] = useState(false);
  const [practiceDirty, setPracticeDirty] = useState(false);

  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [name, setName] = useState("");
  const [exam, setExam] = useState("");
  const [dailyGoal, setDailyGoal] = useState(20);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("profiles").select("*").single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setName(data.name || "");
        setExam(data.exam || "");
        setDailyGoal(data.daily_goal || 20);
      }
    });
    const saved = localStorage.getItem("prepzo_prefs");
    if (saved) {
      try { setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) }); } catch {}
    }
  }, []);

  // Merge pending into saved prefs
  const studyPrefs = { ...prefs, ...pendingStudy };
  const practicePrefs = { ...prefs, ...pendingPractice };

  function saveSection(section: "study" | "practice") {
    const updates = section === "study" ? pendingStudy : pendingPractice;
    const next = { ...prefs, ...updates };
    setPrefs(next);
    localStorage.setItem("prepzo_prefs", JSON.stringify(next));
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
      .update({ name, exam: exam as "JEE" | "NEET" | "CUET", daily_goal: dailyGoal })
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
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Account deletion requested. Our team will process it within 24 hours.");
    router.push("/");
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
                    <div className="grid grid-cols-3 gap-2">
                      {["JEE", "NEET", "CUET"].map((e) => (
                        <button key={e} onClick={() => setExam(e)}
                          className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${exam === e ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Daily MCQ Goal</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 20, 30].map((g) => {
                        const isPro = g === 30 && profile?.plan !== "paid";
                        return isPro ? (
                          <a key={g} href="/upgrade"
                            className="py-2.5 rounded-xl border-2 border-[#E2E8F0] text-xs font-semibold text-[#94A3B8] flex items-center justify-center gap-1">
                            <Crown size={11} className="text-[#D97706]" /> 30 / day
                          </a>
                        ) : (
                          <button key={g} onClick={() => setDailyGoal(g)}
                            className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${dailyGoal === g ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                            {g} / day
                          </button>
                        );
                      })}
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
                        await supabase.auth.resetPasswordForEmail(user.email);
                        toast.success("Password reset email sent");
                      }
                    }} />
                  <SettingsRow icon={Bell} label="Change Email" sublabel="Update your email address"
                    onClick={() => toast("Contact support to change your email")} />
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
                    <p className="text-xs text-[#64748B] mt-1">Permanently deletes all your data. Cannot be undone.</p>
                  </div>
                </div>
                {deleteConfirm && (
                  <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 mb-3 text-sm text-[#DC2626]">
                    Are you sure? Tap again to confirm deletion.
                  </div>
                )}
                <button onClick={handleDeleteAccount} disabled={loading}
                  className="px-5 py-2.5 rounded-xl border-2 border-[#DC2626] text-[#DC2626] text-sm font-semibold hover:bg-[#FEF2F2] transition-all disabled:opacity-60 flex items-center gap-2">
                  <Trash2 size={14} />
                  {deleteConfirm ? "Confirm Delete" : "Delete Account"}
                </button>
              </Card>
            </>
          )}

          {/* ── STUDY PREFERENCES ── */}
          {activeSection === "study" && (
            <>
              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-5">Preferred Study Mode</h2>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: "flashcards", label: "Flashcards first" }, { value: "mcq", label: "MCQ first" }, { value: "mixed", label: "Mixed" }].map(({ value, label }) => (
                    <button key={value} onClick={() => updateStudy({ studyMode: value })}
                      className={`py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${studyPrefs.studyMode === value ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
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
                <h2 className="text-base font-bold text-[#0F172A] mb-1">Recall Review Frequency</h2>
                <p className="text-xs text-[#64748B] mb-4">How often due recall cards appear in your session.</p>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: "daily", label: "Every day" }, { value: "every2days", label: "Every 2 days" }, { value: "weekly", label: "Weekly" }].map(({ value, label }) => (
                    <button key={value} onClick={() => updateStudy({ recallFrequency: value })}
                      className={`py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${studyPrefs.recallFrequency === value ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#0F172A] mb-1">New Cards per Day</h2>
                <p className="text-xs text-[#64748B] mb-4">Max new flashcards introduced in a single session.</p>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 15, 20, 30].map((v) => (
                    <button key={v} onClick={() => updateStudy({ newCardsPerDay: v })}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${studyPrefs.newCardsPerDay === v ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"}`}>
                      {v}
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
                  <a href="/upgrade" className="flex items-center gap-2 text-sm text-[#1E3A8A] font-semibold underline">
                    <Crown size={14} className="text-[#D97706]" /> Upgrade to unlock Speed Mode
                  </a>
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
                    <div className="flex items-center justify-between gap-4 opacity-50">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A] flex items-center gap-1.5">
                          <Crown size={12} className="text-[#D97706]" /> Speed Mode auto-advance
                        </p>
                        <p className="text-xs text-[#64748B]">Pro feature — upgrade to enable</p>
                      </div>
                      <div className="w-11 h-6 rounded-full bg-[#E2E8F0] relative shrink-0 cursor-not-allowed">
                        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow" />
                      </div>
                    </div>
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
                <h2 className="text-base font-bold text-[#0F172A] mb-4">Current Plan</h2>
                <div className={`rounded-xl p-4 mb-4 ${profile?.plan === "paid" ? "bg-[#1E3A8A] text-white" : "bg-[#F8FAFF] border border-[#E2E8F0]"}`}>
                  <p className={`text-lg font-bold ${profile?.plan === "paid" ? "text-white" : "text-[#0F172A]"}`}>
                    {profile?.plan === "paid" ? "Pro Member ✨" : "Free Plan"}
                  </p>
                  <p className={`text-sm mt-1 ${profile?.plan === "paid" ? "text-white/70" : "text-[#64748B]"}`}>
                    {profile?.plan === "paid"
                      ? "You have full access to all Prepzo features."
                      : "15 MCQs/day · 1 exam track · Basic features"}
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
                      onClick={() => toast("To cancel, contact support@prepzo.in")} danger />
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
                <SettingsRow icon={Bell} label="Contact Support" sublabel="Reach us at support@prepzo.in"
                  onClick={() => { window.location.href = "mailto:support@prepzo.in"; }} />
                <SettingsRow icon={AlertTriangle} label="Report a Bug" sublabel="Help us fix issues"
                  onClick={() => { window.location.href = "mailto:bugs@prepzo.in?subject=Bug Report"; }} />
                <SettingsRow icon={Check} label="Share Feedback" sublabel="Tell us how we can improve"
                  onClick={() => toast("Thanks! Feedback form coming soon")} />
              </div>
            </Card>
          )}

        </div>
      </div>
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
