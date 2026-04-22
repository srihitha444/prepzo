"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PricingCard } from "@/components/payment/PricingCard";
import { Check } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";

export default function UpgradePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("profiles").select("*").single().then(({ data }) => setProfile(data));
  }, []);

  if (profile?.plan === "paid") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">✨</div>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] mb-2">
          You&apos;re on Pro!
        </h1>
        <p className="text-[#64748B]">You already have full access to all Prepzo features.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl font-bold text-[#0F172A] mb-3">
          Upgrade to Prepzo Pro
        </h1>
        <p className="text-[#64748B]">Unlock unlimited practice and all features for every exam.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-10">
        <PricingCard
          plan="monthly"
          price="₹99"
          period="/month"
          features={PRO_FEATURES}
          userEmail={profile ? (profile as { email?: string }).email : ""}
          userName={profile?.name || ""}
        />
        <PricingCard
          plan="yearly"
          price="₹799"
          period="/year"
          savings="Save ₹389 vs monthly — 2 months free!"
          features={PRO_FEATURES}
          highlighted
          userEmail={profile ? (profile as { email?: string }).email : ""}
          userName={profile?.name || ""}
        />
      </div>

      {/* Feature comparison */}
      <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              <th className="text-left p-4 font-semibold text-[#0F172A]">Feature</th>
              <th className="text-center p-4 font-semibold text-[#64748B]">Free</th>
              <th className="text-center p-4 font-semibold text-[#1E3A8A]">Pro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F8FAFF]">
            {COMPARISON.map((row) => (
              <tr key={row.feature}>
                <td className="p-4 text-[#0F172A]">{row.feature}</td>
                <td className="p-4 text-center text-[#64748B]">{row.free}</td>
                <td className="p-4 text-center text-[#1E3A8A] font-medium">{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-[#64748B] mt-6">
        Secure payment via Razorpay · Cancel anytime · No hidden charges
      </p>
    </div>
  );
}

const PRO_FEATURES = [
  "Full access to MCQs",
  "All 3 exams (JEE Main, NEET, CUET)",
  "Advanced Recall with spaced repetition",
  "Full + Speed Mode flashcards",
  "Detailed analytics",
  "Weak topic detection",
  "Priority support",
];

const COMPARISON = [
  { feature: "Daily MCQs", free: "15/day", pro: "Unlimited" },
  { feature: "Exams", free: "1 exam", pro: "JEE + NEET + CUET" },
  { feature: "Flashcards", free: "5 per session", pro: "Full + Speed Mode" },
  { feature: "Analytics", free: "Basic", pro: "Detailed" },
  { feature: "Weak topic detection", free: "✗", pro: "✓" },
  { feature: "Progress history", free: "7 days", pro: "Unlimited" },
  { feature: "Support", free: "Help Center", pro: "Priority" },
];

void Check;
