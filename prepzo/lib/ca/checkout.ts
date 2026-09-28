import type { BillingCycle, CaPlan } from "@/lib/ca/plans";

/**
 * Browser-side checkout: create the order server-side, open Razorpay, then
 * hand the signed result back for verification.
 *
 * Nothing here decides a price. The server reads it from lib/ca/plans.ts and
 * the amount is fixed on the order before Razorpay ever sees the browser —
 * otherwise the page could name its own price.
 */

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayResponse {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RazorpayConstructor = new (options: Record<string, any>) => { open: () => void };

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function startCheckout(params: {
  plan: CaPlan;
  cycle: BillingCycle;
  /** The student ticked the Terms box. The server verifies this too. */
  acceptTerms: boolean;
  userEmail?: string;
  userName?: string;
}): Promise<{ plan: CaPlan }> {
  const ready = await loadScript();
  if (!ready) throw new Error("Couldn't load the payment window. Check your connection and try again.");

  const orderRes = await fetch("/api/ca/billing/create-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: params.plan, cycle: params.cycle, accept_terms: params.acceptTerms }),
  });
  const order = await orderRes.json();
  if (!orderRes.ok) throw new Error(order.error || "Couldn't start checkout");

  const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.key_id,
      // subscription_id instead of order_id is what makes this a recurring
      // mandate rather than a single charge — Razorpay shows the student the
      // renewal terms and collects authorisation for future debits.
      subscription_id: order.subscription_id,
      name: "Prepzo",
      description: `${order.plan_name} plan — renews ${params.cycle === "yearly" ? "yearly" : "monthly"}`,
      prefill: { email: params.userEmail, name: params.userName },
      theme: { color: "#1E3A8A" },
      handler: async (response: RazorpayResponse) => {
        try {
          const verifyRes = await fetch("/api/ca/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const verified = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(verified.error || "We couldn't confirm your payment");
          resolve({ plan: verified.plan as CaPlan });
        } catch (error) {
          // The money may well have been taken — the webhook is the backstop
          // that upgrades them regardless, so say so rather than implying the
          // payment failed.
          reject(
            new Error(
              error instanceof Error
                ? `${error.message}. If you were charged, your plan will update shortly.`
                : "Payment confirmation failed"
            )
          );
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
    });
    checkout.open();
  });
}
