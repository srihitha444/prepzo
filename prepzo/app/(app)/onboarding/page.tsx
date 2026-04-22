"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

type Step = 1 | 2 | 3 | 4;

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [dailyGoal, setDailyGoal] = useState<number>(20);

  // Study preferences (saved to localStorage)
  const [mcqTimer, setMcqTimer] = useState<number>(30);
  const [recallFrequency, setRecallFrequency] = useState<string>("daily");
  const [speedModeInterval, setSpeedModeInterval] = useState<number>(5);

  const [loading, setLoading] = useState(false);

  async function handleComplete() {
    if (!selectedExam) {
      toast.error("Please select an exam first");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, exam: selectedExam as "JEE" | "NEET" | "CUET", daily_goal: dailyGoal });
    if (error) {
      toast.error("Something went wrong, please try again");
      setLoading(false);
      return;
    }

    // Save study preferences to localStorage
    localStorage.setItem("prepzo_prefs", JSON.stringify({
      mcqTimer,
      recallFrequency,
      speedModeInterval,
    }));

    toast.success("Profile saved! Let's get started 🚀");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${i + 1 <= step ? "bg-[#1E3A8A]" : "bg-[#E2E8F0]"}`} />
            </div>
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-8 text-center">
            <div className="text-5xl mb-4">🎯</div>
            <h1 className="font-[family-name:var(--font-fraunces)] text-3xl font-bold text-[#0F172A] mb-3">
              Welcome to Prepzo!
            </h1>
            <p className="text-[#64748B] mb-8 leading-relaxed">
              Your personalized exam preparation platform. Let&apos;s set up your profile in a few quick steps.
            </p>
            <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
              {[
                { icon: "⚡", label: "Smart MCQs" },
                { icon: "🃏", label: "Flashcards" },
                { icon: "📊", label: "Analytics" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2 p-3 bg-[#F8FAFF] rounded-xl">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-[#64748B] text-xs font-medium">{item.label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all flex items-center justify-center gap-2"
            >
              Get Started <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Exam picker */}
        {step === 2 && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-8">
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-2">
              Which exam are you preparing for?
            </h2>
            <p className="text-[#64748B] text-sm mb-6">
              We&apos;ll personalise your questions, flashcards, and study plan for your exam.
            </p>
            <div className="space-y-3 mb-8">
              {EXAM_OPTIONS.map((exam) => (
                <button
                  key={exam.name}
                  onClick={() => setSelectedExam(exam.name)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    selectedExam === exam.name
                      ? "border-[#1E3A8A] bg-[#DBEAFE]"
                      : "border-[#E2E8F0] hover:border-[#3B5FBF]"
                  }`}
                >
                  <span className="text-3xl">{exam.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-[#0F172A]">{exam.name}</p>
                    <p className="text-xs text-[#64748B]">{exam.fullName}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedExam === exam.name ? "border-[#1E3A8A] bg-[#1E3A8A]" : "border-[#E2E8F0]"
                  }`}>
                    {selectedExam === exam.name && <Check size={12} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => selectedExam && setStep(3)}
              disabled={!selectedExam}
              className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 3: Daily goal */}
        {step === 3 && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-8">
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-2">
              Set your daily goal
            </h2>
            <p className="text-[#64748B] text-sm mb-6">
              How many MCQs do you want to practice each day?
            </p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { value: 10, label: "Casual" },
                { value: 20, label: "Focused" },
                { value: 30, label: "Serious" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDailyGoal(value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    dailyGoal === value
                      ? "border-[#1E3A8A] bg-[#DBEAFE]"
                      : "border-[#E2E8F0] hover:border-[#3B5FBF]"
                  }`}
                >
                  <span className="text-2xl font-bold font-[family-name:var(--font-dm-mono)] text-[#0F172A]">
                    {value}
                  </span>
                  <span className="text-xs text-[#64748B]">{label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(4)}
              className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all flex items-center justify-center gap-2"
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 4: Study preferences */}
        {step === 4 && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-8">
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-2">
              Personalise your study style
            </h2>
            <p className="text-[#64748B] text-sm mb-7">
              Set how you want to practise. You can always change these in Settings later.
            </p>

            {/* MCQ Timer */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                ⏱ MCQ timer per question
              </label>
              <p className="text-xs text-[#64748B] mb-3">How long should you have to answer each question?</p>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map((s) => (
                  <button
                    key={s}
                    onClick={() => setMcqTimer(s)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      mcqTimer === s ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>

            {/* Recall frequency */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                🔄 Recall review frequency
              </label>
              <p className="text-xs text-[#64748B] mb-3">How often should due recall cards be surfaced?</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "daily", label: "Every day" },
                  { value: "every2days", label: "Every 2 days" },
                  { value: "weekly", label: "Weekly" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setRecallFrequency(value)}
                    className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                      recallFrequency === value ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed mode interval */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                ⚡ Speed Mode auto-advance
              </label>
              <p className="text-xs text-[#64748B] mb-3">How long to show each flashcard before moving on?</p>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 7].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeedModeInterval(s)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      speedModeInterval === s ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleComplete}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? "Setting up..." : "Start Preparing 🚀"}
            </button>
          </div>
        )}

        {/* Step indicator */}
        <p className="text-center text-xs text-[#64748B] mt-4">
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}

const EXAM_OPTIONS = [
  { name: "JEE", fullName: "Joint Entrance Examination (Main)", icon: "⚗️" },
  { name: "NEET", fullName: "National Eligibility cum Entrance Test", icon: "🧬" },
  { name: "CUET", fullName: "Central Universities Entrance Test", icon: "📚" },
];
