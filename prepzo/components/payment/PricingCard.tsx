"use client";

import { Check, Loader2 } from "lucide-react";
import { loadRazorpayScript, type RazorpayPaymentResponse } from "@/lib/razorpay";
import { useState } from "react";
import toast from "react-hot-toast";

interface PricingCardProps {
  plan: "monthly" | "yearly";
  price: string;
  period: string;
  savings?: string;
  features: string[];
  highlighted?: boolean;
  userEmail?: string;
  userName?: string;
}

export function PricingCard({
  plan,
  price,
  period,
  savings,
  features,
  highlighted,
  userEmail,
  userName,
}: PricingCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment gateway. Please try again.");
        return;
      }

      // Create order
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const order = await res.json();
      if (!order.order_id) {
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
          email: userEmail || "",
          name: userName || "",
        },
        theme: { color: "#1E3A8A" },
        handler: async (response: RazorpayPaymentResponse) => {
          const verifyRes = await fetch("/api/payment/verify", {
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
            toast.success("Payment successful! Welcome to Pro 🎉");
            window.location.href = "/dashboard";
          } else {
            toast.error("Payment verification failed. Please contact support.");
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.open();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-[14px] p-7 ${
      highlighted
        ? "bg-[#1E3A8A] text-white shadow-[0_8px_40px_rgba(30,58,138,0.3)] relative overflow-hidden"
        : "bg-white border border-[#E2E8F0] shadow-[var(--shadow-card)]"
    }`}>
      {highlighted && (
        <div className="absolute top-4 right-4">
          <span className="bg-[#D97706] text-white text-xs font-bold px-3 py-1 rounded-full">BEST VALUE</span>
        </div>
      )}

      <div className="mb-1">
        <h3 className={`text-lg font-bold ${highlighted ? "text-white" : "text-[#0F172A]"}`}>
          {plan === "monthly" ? "Monthly" : "Yearly"}
        </h3>
      </div>

      <div className="flex items-end gap-1 mb-1">
        <span className={`text-4xl font-bold font-[family-name:var(--font-fraunces)] ${highlighted ? "text-white" : "text-[#0F172A]"}`}>
          {price}
        </span>
        <span className={`pb-1 ${highlighted ? "text-white/70" : "text-[#64748B]"}`}>{period}</span>
      </div>

      {savings && (
        <p className={`text-xs mb-6 ${highlighted ? "text-white/60" : "text-[#16A34A]"}`}>{savings}</p>
      )}
      {!savings && <div className="mb-6" />}

      <ul className="space-y-3 mb-7">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check size={14} className={`shrink-0 mt-0.5 ${highlighted ? "text-[#4ADE80]" : "text-[#16A34A]"}`} />
            <span className={highlighted ? "text-white" : "text-[#0F172A]"}>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 min-h-[48px] ${
          highlighted
            ? "bg-white text-[#1E3A8A] hover:bg-[#F8FAFF]"
            : "bg-[#1E3A8A] text-white hover:bg-[#162D6B]"
        }`}
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? "Opening checkout..." : "Get Pro Access"}
      </button>
    </div>
  );
}
