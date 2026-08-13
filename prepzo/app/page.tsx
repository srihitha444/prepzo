"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Atom,
  Check,
  ChevronRight,
  FlaskConical,
  HeartPulse,
  Leaf,
  Repeat2,
  Smartphone,
  Timer,
  TrendingUp,
  Zap,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { loadRazorpayScript, type PlanKey, type RazorpayPaymentResponse } from "@/lib/razorpay";
import { createClient } from "@/lib/supabase/client";

export default function LandingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("error")) {
      const callbackUrl = `/auth/callback${window.location.search}`;
      window.location.replace(callbackUrl);
    }
  }, []);

  async function handleProCheckout(plan: PlanKey) {
    setLoadingPlan(plan);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/upgrade?plan=${plan}`);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment gateway. Please try again.");
        return;
      }

      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const order = await res.json();

      if (!res.ok || !order.order_id) {
        toast.error(order.error || "Failed to create order");
        return;
      }

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Prepzo",
        description: order.description,
        order_id: order.order_id,
        prefill: {
          email: user.email || "",
          name: String(user.user_metadata?.full_name || user.user_metadata?.name || ""),
        },
        theme: { color: "#1E3A8A" },
        handler: async (response: RazorpayPaymentResponse) => {
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const result = await verifyRes.json();

          if (result.success) {
            toast.success("Payment successful! Welcome to Pro");
            window.location.href = "/dashboard";
          } else {
            toast.error(result.error || "Payment verification failed. Please contact support.");
          }
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
            toast.error("Payment cancelled.");
          },
        },
      });

      rzp.on("payment.failed", (response) => {
        setLoadingPlan(null);
        toast.error(response.error?.description || "Payment failed. Please try again.");
      });

      rzp.open();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="landing-page min-h-screen bg-white text-[#0F172A]">
      {/* NAV */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#1E3A8A]">
            Prepzo
          </span>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              Features
            </a>
            <Link href="/tools" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              Tools
            </Link>
            <Link href="/blog" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              Blog
            </Link>
            <a href="#pricing" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              Pricing
            </a>
            <Link href="/auth/login" className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
              Login
            </Link>
            <Link href="/auth/signup" className="px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-sm font-semibold transition-all">
              Try for Free
            </Link>
          </nav>
          <Link href="/auth/signup" className="md:hidden px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold">
            Try for Free
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden pt-14 pb-16 md:pt-20 md:pb-24">
        <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/80 to-white pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">

            {/* LEFT: Text */}
            <div className="landing-hero-copy flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#DBEAFE] border border-[#BFDBFE] text-[#1E3A8A] text-xs font-medium mb-7">
                <span>✨</span>
                Prep smarter
              </div>
              <h1 className="font-[family-name:var(--font-fraunces)] text-5xl sm:text-6xl font-bold text-[#0F172A] leading-[1.1] mb-5">
                <span className="text-[#1E3A8A]">Crack</span>{" "}
                NEET
              </h1>
              <p className="text-lg text-[#64748B] max-w-lg mb-9 leading-relaxed">
                The smartest way to prep for NEET with subject-focused practice and exam-style questions.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                <Link href="/auth/signup" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-base font-semibold transition-all shadow-lg shadow-[#1E3A8A]/30">
                  Try for Free
                </Link>
                <a href="#features" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white hover:bg-[#F8FAFF] border border-[#E2E8F0] text-[#0F172A] text-base font-semibold transition-all flex items-center justify-center gap-2">
                  See How It Works <ChevronRight size={16} />
                </a>
              </div>
            </div>

            {/* RIGHT: Quiz UI Mockup with subject scroll */}
            <div className="flex-shrink-0 w-full md:w-[420px]">
              <QuizMockup />
            </div>

          </div>
        </div>
      </section>

      {/* EXAM CARDS */}
      <section className="py-16 md:py-24 bg-[#F8FAFF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">NEET Preparation</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Select a subject and start practicing with NEET-style questions.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {NEET_SUBJECTS.map((subject) => (
              <div
                key={subject.name}
                className="flex min-h-[300px] flex-col rounded-2xl border border-[#E2E8F0] bg-white p-7 shadow-[0_10px_32px_rgba(30,58,138,0.08)]"
              >
                <div className="mb-7">
                  <subject.icon size={34} strokeWidth={1.8} className={subject.iconClass} />
                </div>
                <h3 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold leading-tight text-[#0F172A]">
                  {subject.name}
                </h3>
                <ul className="mt-6 flex-1 space-y-3">
                  {subject.topics.map((topic) => (
                    <li key={topic} className="flex items-center gap-3 text-sm text-[#0F172A]">
                      <Check size={16} className="shrink-0 text-[#16A34A]" />
                      <span>{topic}</span>
                    </li>
                  ))}
                  <li className="text-sm font-semibold text-[#1E3A8A]">
                    + more
                  </li>
                </ul>
                <Link
                  href="/auth/signup"
                  className="mt-7 flex min-h-[52px] w-full items-center justify-center rounded-xl border border-[#E2E8F0] px-4 text-center text-base font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF]"
                >
                  Start {subject.name} -&gt;
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">Everything You Need to Top</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Built for NEET aspirants who want to stop forgetting and start scoring higher.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="p-6 rounded-[14px] hover:bg-[#F8FAFF] transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#DBEAFE] flex items-center justify-center mb-4">
                  <feature.icon size={22} className="text-[#1E3A8A]" />
                </div>
                <h3 className="font-semibold text-[#0F172A] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-16 md:py-24 bg-[#F8FAFF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">Simple, Transparent Pricing</h2>
            <p className="text-[#64748B]">Start completely free Upgrade only when you&apos;re ready for advanced practice</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto items-stretch">

            {/* Free */}
            <div className="pricing-card-navy bg-[#1E3A8A] rounded-[14px] border border-[#1E3A8A] shadow-[0_8px_40px_rgba(30,58,138,0.28)] p-7 flex flex-col text-white">
              <h3 className="text-lg font-bold text-white mb-1">Free</h3>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-bold font-[family-name:var(--font-fraunces)] text-white">₹0</span>
                <span className="text-white/70 pb-1">/month</span>
              </div>
              <ul className="space-y-3 mb-7 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white">
                    <Check size={14} className="text-white/70 shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="pricing-card-cta block w-full text-center py-3 rounded-xl bg-white text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF] transition-all">
                Get Started Free
              </Link>
            </div>

            {/* Pro Monthly */}
            <div className="pricing-card-navy bg-[#1E3A8A] rounded-[14px] border border-[#1E3A8A] shadow-[0_8px_40px_rgba(30,58,138,0.28)] p-7 flex flex-col text-white">
              <h3 className="text-lg font-bold text-white mb-1">Pro Monthly</h3>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-bold font-[family-name:var(--font-fraunces)] text-white">₹99</span>
                <span className="text-white/70 pb-1">/month</span>
              </div>
              <ul className="space-y-3 mb-7 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white">
                    <Check size={14} className="text-[#4ADE80] shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handleProCheckout("monthly")}
                disabled={loadingPlan !== null}
                className="pricing-card-cta flex w-full items-center justify-center gap-2 py-3 rounded-xl bg-white text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF] transition-all disabled:opacity-60"
              >
                {loadingPlan === "monthly" && <Loader2 size={16} className="animate-spin" />}
                {loadingPlan === "monthly" ? "Opening checkout..." : "Get Pro Monthly"}
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer border-t border-[#E2E8F0] py-14">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 text-center sm:px-6 md:flex-row md:items-start md:justify-between md:text-left">
          <div className="flex min-w-[220px] flex-col items-center gap-1 md:items-start">
            <span className="font-[family-name:var(--font-fraunces)] text-xl font-bold text-[#1E3A8A]">Prepzo</span>
            <p className="mt-2 max-w-xs text-xs leading-5 text-[#64748B]">
              Prepzo is an independent study platform and is not affiliated with NTA or NEET.
            </p>
            <p className="text-xs text-[#64748B]">Made for India students</p>
          </div>

          <div className="flex min-w-[220px] flex-col items-center gap-3 text-sm text-[#64748B] md:items-start">
            <p className="text-sm font-semibold text-[#0F172A]">Support</p>
            <a href="mailto:support@prepzo.study" className="hover:text-[#0F172A] transition-colors">support@prepzo.study</a>
            <div className="flex items-center gap-2">
              <a
                href="https://www.linkedin.com/company/131964161/"
                target="_blank"
                rel="noreferrer"
                aria-label="Prepzo on LinkedIn"
                className="grid h-9 w-9 place-items-center rounded-full border border-[#E2E8F0] text-[#64748B] transition-colors hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
              >
                <LinkedInIcon />
              </a>
              <a
                href="https://www.instagram.com/prepzo.study?igsh=eXpzNnAxazZva3ds"
                target="_blank"
                rel="noreferrer"
                aria-label="Prepzo on Instagram"
                className="grid h-9 w-9 place-items-center rounded-full border border-[#E2E8F0] text-[#64748B] transition-colors hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
              >
                <InstagramIcon />
              </a>
            </div>
          </div>

          <div className="flex flex-1 justify-end">
            <div className="grid gap-4 text-sm font-medium text-[#64748B] md:grid-cols-3 md:justify-items-end md:text-right">
              <div className="flex flex-col gap-2">
                <Link href="/auth/login" className="hover:text-[#0F172A] transition-colors">Login</Link>
                <Link href="/auth/signup" className="hover:text-[#0F172A] transition-colors">Sign Up</Link>
                <a href="#pricing" className="hover:text-[#0F172A] transition-colors">Pricing</a>
              </div>
              <div className="flex flex-col gap-2">
                <Link href="/tools" className="hover:text-[#0F172A] transition-colors">Study Tools</Link>
                <Link href="/blog" className="hover:text-[#0F172A] transition-colors">Blog</Link>
                <Link href="/referral" className="hover:text-[#0F172A] transition-colors">Referral</Link>
              </div>
              <div className="flex flex-col gap-2">
                <Link href="/terms" className="hover:text-[#0F172A] transition-colors">Terms</Link>
                <Link href="/privacy-policy" className="hover:text-[#0F172A] transition-colors">Privacy Policy</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── QUIZ MOCKUP WITH SUBJECT SCROLL ──────────────────────────────
function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M6.94 8.98H3.56v10.78h3.38V8.98ZM5.25 4.24a1.96 1.96 0 1 0 0 3.92 1.96 1.96 0 0 0 0-3.92Zm14.5 9.34c0-3.25-1.73-4.76-4.04-4.76a3.49 3.49 0 0 0-3.15 1.73h-.05V8.98H9.27v10.78h3.37v-5.33c0-1.41.27-2.77 2.01-2.77 1.72 0 1.74 1.61 1.74 2.86v5.24h3.36v-6.18Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M7.7 2h8.6A5.7 5.7 0 0 1 22 7.7v8.6a5.7 5.7 0 0 1-5.7 5.7H7.7A5.7 5.7 0 0 1 2 16.3V7.7A5.7 5.7 0 0 1 7.7 2Zm0 2A3.7 3.7 0 0 0 4 7.7v8.6A3.7 3.7 0 0 0 7.7 20h8.6a3.7 3.7 0 0 0 3.7-3.7V7.7A3.7 3.7 0 0 0 16.3 4H7.7Zm4.3 3.25A4.75 4.75 0 1 1 12 16.75a4.75 4.75 0 0 1 0-9.5Zm0 2A2.75 2.75 0 1 0 12 14.75a2.75 2.75 0 0 0 0-5.5Zm5.05-2.45a1.11 1.11 0 1 1 0 2.22 1.11 1.11 0 0 1 0-2.22Z" />
    </svg>
  );
}

const SAMPLE_QUESTIONS = [
  {
    subject: "Physics",
    exam: "NEET",
    qNum: 7,
    total: 20,
    timer: "22s",
    correct: 5,
    wrong: 1,
    accuracy: 83,
    question: "A ball thrown vertically upward with velocity 20 m/s. The maximum height reached is:",
    options: ["10 m", "20 m", "30 m", "40 m"],
    correctIndex: 1,
  },
  {
    subject: "Chemistry",
    exam: "NEET",
    qNum: 4,
    total: 20,
    timer: "18s",
    correct: 3,
    wrong: 1,
    accuracy: 75,
    question: "The hybridisation of carbon in diamond is:",
    options: ["sp", "sp²", "sp³", "sp³d"],
    correctIndex: 2,
  },
  {
    subject: "Biology",
    exam: "NEET",
    qNum: 9,
    total: 20,
    timer: "25s",
    correct: 7,
    wrong: 2,
    accuracy: 78,
    question: "Which organelle is known as the powerhouse of the cell?",
    options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"],
    correctIndex: 2,
  },
];

function QuizMockup() {
  const [activeIdx, setActiveIdx] = useState(0);
  const q = SAMPLE_QUESTIONS[activeIdx];

  return (
    <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[0_8px_40px_rgba(30,58,138,0.12)] overflow-hidden">
      {/* Subject tabs */}
      <div className="flex border-b border-[#E2E8F0] overflow-x-auto">
        {SAMPLE_QUESTIONS.map((s, i) => (
          <button
            key={s.subject}
            onClick={() => setActiveIdx(i)}
            className={`flex-shrink-0 px-4 py-2.5 text-xs font-semibold transition-all border-b-2 ${
              activeIdx === i
                ? "border-[#1E3A8A] text-[#1E3A8A] bg-[#F8FAFF]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {s.subject}
          </button>
        ))}
      </div>

      {/* Question card */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium bg-[#DBEAFE] text-[#1E3A8A] px-2.5 py-1 rounded-full">{q.exam} {q.subject}</span>
            <span className="text-xs text-[#64748B]">Q {q.qNum} / {q.total}</span>
          </div>
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#E2E8F0" strokeWidth="4"/>
              <circle cx="20" cy="20" r="16" fill="none" stroke="#1E3A8A" strokeWidth="4" strokeDasharray="100" strokeDashoffset="35" strokeLinecap="round"/>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-[family-name:var(--font-dm-mono)] text-[#1E3A8A]">{q.timer}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs mb-4">
          <span className="text-[#16A34A] font-semibold">✓ {q.correct}</span>
          <span className="text-[#DC2626] font-semibold">✗ {q.wrong}</span>
          <span className="text-[#64748B]">{q.accuracy}% accuracy</span>
        </div>

        <p className="text-sm font-medium text-[#0F172A] mb-4 leading-snug">{q.question}</p>

        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <div
              key={i}
              className={`w-full px-4 py-3 rounded-xl text-sm border ${
                i === q.correctIndex
                  ? "bg-[#DCFCE7] border-[#16A34A] text-[#15803D] font-medium"
                  : "border-[#E2E8F0] text-[#0F172A]"
              }`}
            >
              <span className="font-medium text-[#64748B] mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const NEET_SUBJECTS = [
  {
    name: "Physics",
    icon: Atom,
    iconClass: "text-[#1E3A8A]",
    topics: ["Mechanics", "Electrodynamics", "Modern Physics"],
  },
  {
    name: "Chemistry",
    icon: FlaskConical,
    iconClass: "text-[#2563EB]",
    topics: ["Physical Chemistry", "Organic Chemistry", "Inorganic Chemistry"],
  },
  {
    name: "Botany",
    icon: Leaf,
    iconClass: "text-[#16A34A]",
    topics: ["Plant Physiology", "Genetics", "Ecology"],
  },
  {
    name: "Zoology",
    icon: HeartPulse,
    iconClass: "text-[#D97706]",
    topics: ["Human Physiology", "Reproduction", "Evolution"],
  },
];

const FEATURES = [
  { title: "MCQs by Section", description: "Set your goal get fresh exam-level MCQs organised by topic — practice what you need whenever you want", icon: Zap },
  { title: "Spaced Repetition System", description: "Every card you practice — right or wrong — comes back at the perfect time using spaced repetition so you never forget before the exam", icon: Repeat2 },
  { title: "30-Second Countdown Timer", description: "Train under real exam pressure A live countdown timer helps you build speed section by section", icon: Timer },
  { title: "Speed Mode Flashcards", description: "Auto-advancing cards Revise 50+ concepts in under 5 minutes", icon: Zap },
  { title: "Weak Topic Detection", description: "Automatically spots your weak topics (below 60%) and shows you exactly what to focus on next", icon: TrendingUp },
  { title: "Mobile-First Design", description: "Study anywhere Swipe tap and track your streak anytime on your phone", icon: Smartphone },
];

const FREE_FEATURES = [
  "15 MCQs per day",
  "NEET practice track",
  "PYQ coming soon",
  "5 flashcards per session",
  "Progress tracking",
  "Limited Recall Deck",
];

const PRO_FEATURES = [
  "Full access MCQs + Flashcard",
  "PYQ Practice coming soon",
  "Full NEET syllabus coverage",
  "Speed Mode",
  "Detailed analytics",
  "Weak topic detection",
  "Full progress history",
];
