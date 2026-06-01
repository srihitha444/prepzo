"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Clock, Crown, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";

type Step = 1 | 2 | 3;

const TOTAL_STEPS = 3;

const recallOptions = [
  { value: "daily", label: "Every day" },
  { value: "every2days", label: "Every 2 days" },
  { value: "weekly", label: "Weekly" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedExam] = useState<string>("NEET");
  const [dailyGoal, setDailyGoal] = useState<number>(15);
  const [mcqTimer, setMcqTimer] = useState<number>(30);
  const [mcqRecallFrequency, setMcqRecallFrequency] = useState<string>("daily");
  const [flashcardGoal, setFlashcardGoal] = useState<number>(5);
  const [flashcardRecallFrequency, setFlashcardRecallFrequency] = useState<string>("daily");
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState("Prepzo Pro");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleComplete() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    const combinedDailyGoal = dailyGoal + flashcardGoal;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, exam: selectedExam as "NEET", daily_goal: combinedDailyGoal });

    if (error) {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    localStorage.setItem(
      "prepzo_prefs",
      JSON.stringify({
        mcqTimer,
        mcqDailyGoal: dailyGoal,
        mcqRecallFrequency,
        recallFrequency: mcqRecallFrequency,
        flashcardGoal,
        flashcardRecallFrequency,
        newCardsPerDay: flashcardGoal,
      })
    );

    toast.success("Profile saved! Let's get started.");
    router.push("/dashboard");
    router.refresh();
  }

  function openPremiumModal(feature: string) {
    setPremiumFeature(feature);
    setPremiumModalOpen(true);
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
                    Welcome to Prepzo!
                  </h1>
                  <p className="text-[#64748B] leading-relaxed">
                    Complete your NEET setup to personalize your study plan, track progress, and stay aligned with your
                    preparation goals.
                  </p>
                </div>

                <div className="mt-7 grid grid-cols-3 gap-3 text-sm">
                  {[
                    { icon: "⚡", label: "Smart MCQs" },
                    { icon: "🃏", label: "Flashcards" },
                    { icon: "📊", label: "Analytics" },
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
                    MCQ setup
                  </h2>
                  <p className="text-[#64748B] text-sm">
                    Choose your daily question target, timer, and recall rhythm for NEET MCQ practice.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-3">Daily MCQ goal</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 15, 20, 30].map((value) => {
                        const isPremium = value > 15;
                        return (
                          <button
                            key={value}
                            onClick={() => isPremium ? openPremiumModal(`${value} MCQs per day`) : setDailyGoal(value)}
                            className={`relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all ${
                              dailyGoal === value
                                ? "border-[#1E3A8A] bg-[#DBEAFE]"
                                : "border-[#E2E8F0] hover:border-[#3B5FBF]"
                            }`}
                          >
                            {isPremium && (
                              <Crown className="absolute right-2 top-2 text-[#D97706]" size={14} aria-label="Premium" />
                            )}
                            <span className="text-2xl font-bold font-[family-name:var(--font-dm-mono)] text-[#0F172A]">
                              {value}
                            </span>
                            <span className="text-xs text-[#64748B]">MCQs</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                      <Clock size={16} /> MCQ timer per question
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[15, 30, 45, 60].map((seconds) => (
                        <button
                          key={seconds}
                          onClick={() => setMcqTimer(seconds)}
                          className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                            mcqTimer === seconds
                              ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                              : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                          }`}
                        >
                          {seconds}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                      <RotateCcw size={16} /> MCQ recall
                    </label>
                    <p className="text-xs text-[#64748B] mb-3">Recall review frequency</p>
                    <div className="grid grid-cols-3 gap-2">
                      {recallOptions.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setMcqRecallFrequency(value)}
                          className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                            mcqRecallFrequency === value
                              ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                              : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep(3)}
                  className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold transition-all flex items-center justify-center gap-2"
                >
                  Continue <ChevronRight size={16} />
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-2">
                    Flashcard setup
                  </h2>
                  <p className="text-[#64748B] text-sm">
                    Set your daily flashcard target and recall frequency. You can update these later in Settings.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                      <BookOpen size={16} /> Daily flashcard goal
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[5, 10].map((value) => {
                        const isPremium = value === 10;
                        return (
                          <button
                            key={value}
                            onClick={() => isPremium ? openPremiumModal(`${value} flashcards per day`) : setFlashcardGoal(value)}
                            className={`relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all ${
                              flashcardGoal === value
                                ? "border-[#1E3A8A] bg-[#DBEAFE]"
                                : "border-[#E2E8F0] hover:border-[#3B5FBF]"
                            }`}
                          >
                            {isPremium && (
                              <Crown className="absolute right-3 top-3 text-[#D97706]" size={15} aria-label="Premium" />
                            )}
                            <span className="text-3xl font-bold font-[family-name:var(--font-dm-mono)] text-[#0F172A]">
                              {value}
                            </span>
                            <span className="text-xs text-[#64748B]">Flashcards</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                      <RotateCcw size={16} /> Flashcard recall
                    </label>
                    <p className="text-xs text-[#64748B] mb-3">Recall review frequency</p>
                    <div className="grid grid-cols-3 gap-2">
                      {recallOptions.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setFlashcardRecallFrequency(value)}
                          className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                            flashcardRecallFrequency === value
                              ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                              : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

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

      <Modal open={premiumModalOpen} onClose={() => setPremiumModalOpen(false)} title="Available on Pro">
        <div className="space-y-4">
          <div className="rounded-xl bg-[#FEF3C7] border border-[#FDE68A] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#D97706]">
              <Crown size={16} /> {premiumFeature}
            </div>
            <p className="mt-2 text-xs text-[#92400E]">
              You can pick up to 15 MCQs per day and 5 flashcards per day on the free plan. Upgrade to unlock higher daily goals.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPremiumModalOpen(false)}
              className="py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFF] transition-all"
            >
              Keep Free Plan
            </button>
            <button
              onClick={() => {
                setPremiumModalOpen(false);
                router.push("/upgrade");
              }}
              className="py-2.5 rounded-xl bg-[#1E3A8A] text-sm font-semibold text-white hover:bg-[#162D6B] transition-all"
            >
              View Pro
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
