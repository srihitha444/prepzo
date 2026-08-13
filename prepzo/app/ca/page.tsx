"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Repeat2,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import toast from "react-hot-toast";
import { loadRazorpayScript, type PlanKey, type RazorpayPaymentResponse } from "@/lib/razorpay";
import { createClient } from "@/lib/supabase/client";

export default function CaLandingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("error")) {
      const hostname = window.location.hostname.toLowerCase();
      const preview = new URLSearchParams(window.location.search).get("preview")?.toLowerCase();
      const isCaVertical =
        preview === "ca" ||
        hostname === "ca.prepzo.study" ||
        hostname === "www.ca.prepzo.study" ||
        hostname.endsWith(".ca.prepzo.study") ||
        hostname === "ca.localhost" ||
        hostname === "www.ca.localhost";
      const callbackPath = isCaVertical ? "/ca/auth/callback" : "/auth/callback";
      const callbackUrl = `${callbackPath}${window.location.search}`;
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
        name: "Prepzo CA",
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
            Prepzo CA
          </span>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              Pricing
            </a>
            <Link href="/ca/auth/login" className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
              Login
            </Link>
            <Link href="/ca/auth/signup" className="px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-sm font-semibold transition-all">
              Try for Free
            </Link>
          </nav>
          <Link href="/ca/auth/signup" className="md:hidden px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold">
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
                Built for CA aspirants
              </div>
              <h1 className="font-[family-name:var(--font-fraunces)] text-5xl sm:text-6xl font-bold text-[#0F172A] leading-[1.1] mb-5">
                <span className="text-[#1E3A8A]">Prepzo</span> CA
              </h1>
              <p className="text-lg text-[#64748B] max-w-lg mb-9 leading-relaxed">
                Upload your CA study notes and Prepzo turns them into MCQs and flashcards
                automatically — so you spend your time practicing, not making cards.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                <Link href="/ca/auth/signup" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-base font-semibold transition-all shadow-lg shadow-[#1E3A8A]/30">
                  Explore CA Vertical
                </Link>
                <a href="#features" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white hover:bg-[#F8FAFF] border border-[#E2E8F0] text-[#0F172A] text-base font-semibold transition-all flex items-center justify-center gap-2">
                  See How It Works <ChevronRight size={16} />
                </a>
              </div>
            </div>

            {/* RIGHT: Coming soon card */}
            <div className="flex-shrink-0 w-full md:w-[420px]">
              <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[0_8px_40px_rgba(30,58,138,0.12)] p-8 flex flex-col items-center text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#DBEAFE] text-[#1E3A8A]">
                  <FileText size={26} />
                </div>
                <h3 className="font-semibold text-[#0F172A]">Notes-to-MCQ generation</h3>
                <p className="text-sm text-[#64748B]">
                  Coming soon: upload a PDF or photo of your notes and get exam-style MCQs and
                  flashcards back in minutes.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 md:py-24 bg-[#F8FAFF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">How Prepzo CA Works</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">From your own notes to exam-ready practice, in three steps.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-7 shadow-[0_10px_32px_rgba(30,58,138,0.08)]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1E3A8A]">
                  <step.icon size={22} />
                </div>
                <h3 className="font-[family-name:var(--font-fraunces)] text-xl font-bold leading-tight text-[#0F172A]">
                  {i + 1}. {step.title}
                </h3>
                <p className="mt-3 text-sm text-[#64748B] leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">Everything You Need to Clear CA</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Built for CA aspirants who want to stop forgetting and start scoring higher.</p>
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
            <p className="text-[#64748B]">Start completely free. Upgrade only when you&apos;re ready for advanced practice.</p>
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
              <Link href="/ca/auth/signup" className="pricing-card-cta block w-full text-center py-3 rounded-xl bg-white text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF] transition-all">
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
            <span className="font-[family-name:var(--font-fraunces)] text-xl font-bold text-[#1E3A8A]">Prepzo CA</span>
            <p className="mt-2 max-w-xs text-xs leading-5 text-[#64748B]">
              Prepzo is an independent study platform and is not affiliated with ICAI.
            </p>
            <p className="text-xs text-[#64748B]">Made for India students</p>
          </div>

          <div className="flex min-w-[220px] flex-col items-center gap-3 text-sm text-[#64748B] md:items-start">
            <p className="text-sm font-semibold text-[#0F172A]">Support</p>
            <a href="mailto:support@prepzo.study" className="hover:text-[#0F172A] transition-colors">support@prepzo.study</a>
          </div>

          <div className="flex flex-1 justify-end">
            <div className="grid gap-4 text-sm font-medium text-[#64748B] md:grid-cols-2 md:justify-items-end md:text-right">
              <div className="flex flex-col gap-2">
                <Link href="/ca/auth/login" className="hover:text-[#0F172A] transition-colors">Login</Link>
                <Link href="/ca/auth/signup" className="hover:text-[#0F172A] transition-colors">Sign Up</Link>
                <a href="#pricing" className="hover:text-[#0F172A] transition-colors">Pricing</a>
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

const HOW_IT_WORKS = [
  {
    title: "Upload your notes",
    description: "Add a PDF, doc, or photo of your CA study notes for any subject.",
    icon: FileText,
  },
  {
    title: "Get MCQs & flashcards",
    description: "Prepzo turns your notes into exam-style MCQs and flashcards automatically.",
    icon: Sparkles,
  },
  {
    title: "Practice with recall",
    description: "Review with spaced repetition so concepts stick before exam day.",
    icon: Repeat2,
  },
];

const FEATURES = [
  { title: "Notes to MCQs", description: "Turn your own study notes into exam-style multiple choice questions automatically", icon: Sparkles },
  { title: "Spaced Repetition System", description: "Every card you practice — right or wrong — comes back at the perfect time so you never forget before the exam", icon: Repeat2 },
  { title: "Timed Practice", description: "Train under real exam pressure with a live countdown timer", icon: Timer },
  { title: "Weak Topic Detection", description: "Automatically spots your weak topics and shows you exactly what to focus on next", icon: Target },
];

const FREE_FEATURES = [
  "15 MCQs per day",
  "5 flashcards per session",
  "Progress tracking",
  "Limited Recall Deck",
];

const PRO_FEATURES = [
  "Full access MCQs + Flashcards",
  "Unlimited notes uploads (coming soon)",
  "Speed Mode",
  "Detailed analytics",
  "Weak topic detection",
  "Full progress history",
];
