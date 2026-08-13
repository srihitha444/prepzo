"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PricingCard } from "@/components/payment/PricingCard";
import { BarChart3, BookOpenCheck, CheckCircle2, Gauge, Layers, ListChecks } from "lucide-react";
import toast from "react-hot-toast";
import type { Profile } from "@/lib/supabase/types";

export default function UpgradePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSignedInEmail(user.email || "");
        supabase.from("profiles").select("*").single().then(({ data }) => setProfile(data));
      }
      setAuthChecked(true);
    });
  }, []);

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setCreatingAccount(true);
    const supabase = createClient();
    const appUrl =
      (typeof window !== "undefined" ? window.location.origin : null) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const isCaVertical = (() => {
      if (typeof window === "undefined") return false;
      const hostname = window.location.hostname.toLowerCase();
      const preview = new URLSearchParams(window.location.search).get("preview")?.toLowerCase();
      return (
        preview === "ca" ||
        hostname === "ca.prepzo.study" ||
        hostname === "www.ca.prepzo.study" ||
        hostname.endsWith(".ca.prepzo.study") ||
        hostname === "ca.localhost" ||
        hostname === "www.ca.localhost"
      );
    })();
    const callbackPath = isCaVertical ? "/ca/auth/callback" : "/auth/callback";

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${appUrl}${callbackPath}?next=${encodeURIComponent("/upgrade")}`,
      },
    });

    if (signUpError) {
      toast.error(signUpError.message);
      setCreatingAccount(false);
      return;
    }

    if (data.session && data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, name }, { onConflict: "id" });
      toast.success("Account created. You can continue to payment.");
      router.refresh();
      setCreatingAccount(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      toast.success(`Confirmation email sent to ${email}. Confirm your account, then return to upgrade.`);
      setCreatingAccount(false);
      return;
    }

    toast.success("Account created and signed in. You can continue to payment.");
    router.refresh();
    setCreatingAccount(false);
  }

  if (profile?.plan === "paid") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8">
        <h1 className="mb-2 font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
          You&apos;re on Pro
        </h1>
        <p className="text-[#64748B]">You already have full access to all Prepzo features.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      {authChecked && !signedInEmail && (
        <div className="mb-6 rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-2 text-lg font-semibold text-[#0F172A]">Create your account to continue</h2>
          <p className="mb-4 text-sm text-[#64748B]">
            We will create your account and sign you in before checkout.
          </p>
          <form onSubmit={handleCreateAccount} className="grid gap-3 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              className="rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              required
              minLength={6}
              className="rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm md:col-span-2"
            />
            <button
              type="submit"
              disabled={creatingAccount}
              className="rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#162D6B] disabled:opacity-60 md:col-span-2"
            >
              {creatingAccount ? "Creating account..." : "Create account and continue"}
            </button>
          </form>
        </div>
      )}

      <div>
        <div className="mb-6 text-center">
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl font-bold leading-tight text-[#0F172A] md:text-5xl">
            Upgrade to Pro
          </h1>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_430px]">
          <section className="order-2 pt-1 lg:order-1">
            <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-[#0F172A]">Included in Pro</h2>
                <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-bold text-[#1E3A8A]">Rs 99/month</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {INCLUDED_FEATURES.map((item) => (
                  <div key={item.title} className="flex gap-3 rounded-xl bg-[#F8FAFF] p-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#1E3A8A]">
                      <item.icon size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-[#64748B]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="order-1 lg:sticky lg:top-24 lg:order-2">
            <PricingCard
              plan="monthly"
              price="Rs 99"
              period="/month"
              features={PRO_FEATURES}
              highlighted
              userEmail={(profile as { email?: string } | null)?.email || signedInEmail || email}
              userName={profile?.name || name}
            />
            <p className="mt-4 text-center text-xs text-[#64748B]">
              Monthly billing is handled by Razorpay during checkout. Cancel anytime. No hidden charges.
            </p>
          </aside>
          </div>
        </div>
      </div>
  );
}

const PRO_FEATURES = [
  "Unlimited MCQs",
  "PYQ practice coming soon",
  "Full NEET syllabus coverage",
  "Spaced repetition recall",
  "Speed Mode",
  "Detailed analytics",
];

const INCLUDED_FEATURES = [
  {
    title: "Unlimited MCQ practice",
    description: "No 15-question daily cap.",
    icon: ListChecks,
  },
  {
    title: "PYQ access coming soon",
    description: "Practice papers, years, chapters, and topics are coming soon.",
    icon: BookOpenCheck,
  },
  {
    title: "Flashcards + Speed Mode",
    description: "Faster recall practice before tests.",
    icon: Gauge,
  },
  {
    title: "Weak topic tracking",
    description: "See what needs more practice.",
    icon: BarChart3,
  },
  {
    title: "Recall and review decks",
    description: "Correct goes to recall, wrong goes to review.",
    icon: Layers,
  },
  {
    title: "Progress history",
    description: "Track accuracy, PYQs coming soon, streaks, and daily activity.",
    icon: CheckCircle2,
  },
];
