"use client";

import { Check, CreditCard, Loader2, Tag } from "lucide-react";
import { loadRazorpayScript, type RazorpayPaymentResponse } from "@/lib/razorpay";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import toast from "react-hot-toast";

interface PricingCardProps {
  plan: "monthly";
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  userEmail?: string;
  userName?: string;
}

export function PricingCard({
  plan,
  price,
  period,
  features,
  highlighted,
  userEmail,
  userName,
}: PricingCardProps) {
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const payablePrice = appliedReferralCode ? "Rs 89.10" : price;

  async function getRequestHeaders() {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  async function applyReferralCode() {
    const code = referralCode.trim();
    if (!code) {
      setAppliedReferralCode(null);
      return;
    }

    setValidatingCode(true);
    try {
      const res = await fetch("/api/referrals/validate", {
        method: "POST",
        headers: await getRequestHeaders(),
        body: JSON.stringify({ code }),
      });
      const result = await res.json();
      if (!res.ok || !result.valid) {
        setAppliedReferralCode(null);
        toast.error(result.error || "Referral code could not be applied");
        return;
      }
      setAppliedReferralCode(result.code);
      setReferralCode(result.code);
      toast.success("Referral discount applied");
    } catch {
      toast.error("Could not validate referral code");
    } finally {
      setValidatingCode(false);
    }
  }

  async function handleCheckout() {
    setLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment gateway. Please try again.");
        return;
      }

      const res = await fetch("/api/payment/create-subscription", {
        method: "POST",
        headers: await getRequestHeaders(),
        body: JSON.stringify({ plan, referralCode: appliedReferralCode || undefined }),
      });
      const order = await res.json();
      if (!res.ok || (!order.order_id && !order.subscription_id)) {
        const message =
          res.status === 401
            ? "Please sign in first, then try payment again."
            : order.error || "Failed to create order";
        toast.error(message);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Prepzo",
        description: order.description,
        ...(order.order_id ? { order_id: order.order_id } : {}),
        ...(order.subscription_id ? { subscription_id: order.subscription_id } : {}),
        prefill: {
          email: userEmail || "",
          name: userName || "",
        },
        theme: { color: "#1E3A8A" },
        handler: async (response: RazorpayPaymentResponse) => {
          const verifyRes = await fetch(order.subscription_id ? "/api/payment/verify-subscription" : "/api/verify-payment", {
            method: "POST",
            headers: await getRequestHeaders(),
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const result = await verifyRes.json();
          if (result.success) {
            toast.success("Payment successful! Welcome to Pro.");
            window.location.href = "/dashboard";
          } else {
            toast.error(result.error || "Payment verification failed. Please contact support.");
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.error("Payment cancelled.");
          },
        },
      });

      rzp.on("payment.failed", (response) => {
        setLoading(false);
        toast.error(response.error?.description || "Payment failed. Please try again.");
      });

      rzp.open();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-[14px] p-6 sm:p-7 ${
      highlighted
        ? "pricing-card-navy bg-[#1E3A8A] text-white shadow-[0_18px_48px_rgba(30,58,138,0.22)] relative overflow-hidden"
        : "bg-white border border-[#E2E8F0] shadow-[var(--shadow-card)]"
    }`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wide ${highlighted ? "text-white/70" : "text-[#64748B]"}`}>
            Prepzo Pro
          </p>
          <h3 className={`mt-1 text-xl font-bold ${highlighted ? "text-white" : "text-[#0F172A]"}`}>
            Monthly subscription
          </h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${highlighted ? "bg-white/12 text-white" : "bg-[#DBEAFE] text-[#1E3A8A]"}`}>
          Cancel anytime
        </span>
      </div>

      <div className="mb-2 flex items-end gap-2">
        <span className={`text-5xl font-bold font-[family-name:var(--font-fraunces)] ${highlighted ? "text-white" : "text-[#0F172A]"}`}>
          {payablePrice}
        </span>
        <span className={`pb-2 text-sm ${highlighted ? "text-white/70" : "text-[#64748B]"}`}>{period}</span>
      </div>
      <p className={`mb-6 text-xs ${highlighted ? "text-white/70" : "text-[#64748B]"}`}>
        {appliedReferralCode ? "First month with referral, then Rs 99/month." : "Billed monthly through Razorpay."}
      </p>

      <ul className="mb-6 grid gap-3 sm:grid-cols-2">
        {features.slice(0, 6).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm leading-5">
            <Check size={15} className={`shrink-0 mt-0.5 ${highlighted ? "text-[#86EFAC]" : "text-[#16A34A]"}`} />
            <span className={highlighted ? "text-white" : "text-[#0F172A]"}>
              {f}
            </span>
          </li>
        ))}
      </ul>

      <div className={`mb-3 rounded-[10px] border p-3 ${highlighted ? "border-white/20 bg-white/10" : "border-[#E2E8F0] bg-[#F8FAFF]"}`}>
        <label className={`mb-2 flex items-center gap-2 text-xs font-bold ${highlighted ? "text-white" : "text-[#0F172A]"}`}>
          <Tag size={14} />
          Have a referral code?
        </label>
        <div className="flex gap-2">
          <input
            value={referralCode}
            onChange={(e) => {
              setReferralCode(e.target.value.toUpperCase());
              setAppliedReferralCode(null);
            }}
            placeholder="CODE"
            className="min-w-0 flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm font-semibold uppercase text-[#0F172A] outline-none focus:border-[#1E3A8A]"
          />
          <button
            type="button"
            onClick={applyReferralCode}
            disabled={validatingCode || !referralCode.trim()}
            className="rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-[#1E3A8A] disabled:opacity-60"
          >
            {validatingCode ? "Checking" : "Apply"}
          </button>
        </div>
        <div className={`mt-2 text-xs ${highlighted ? "text-white/75" : "text-[#64748B]"}`}>
          {appliedReferralCode ? "Applied successfully. First month is Rs 89.10, then Rs 99/month." : "Optional: valid codes reduce the first month to Rs 89.10."}
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`mt-5 w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 min-h-[50px] ${
          highlighted
            ? "pricing-card-cta bg-white text-[#1E3A8A] hover:bg-[#F8FAFF]"
            : "bg-[#1E3A8A] text-white hover:bg-[#162D6B]"
        }`}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {loading ? "Opening checkout..." : appliedReferralCode ? "Start with Rs 89.10" : "Start Monthly Subscription"}
      </button>
    </div>
  );
}
