import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay over its REST API rather than the `razorpay` npm package.
 *
 * The package was removed along with the NEET vertical, and the two things we
 * actually need — creating an order and verifying a signature — are one fetch
 * and one HMAC. Re-adding a dependency to wrap that isn't worth it.
 *
 * Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, and
 * NEXT_PUBLIC_RAZORPAY_KEY_ID for the browser checkout.
 */

const API = "https://api.razorpay.com/v1";

function credentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)");
  return { keyId, keySecret };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { keyId, keySecret } = credentials();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      ...(init?.headers || {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Razorpay ${path} failed: ${body?.error?.description || res.status}`);
  }
  return body as T;
}

/**
 * Razorpay plans are immutable, and a subscription needs one. Creating a plan
 * per (tier, cycle, amount) and caching its id means a price change
 * transparently produces a NEW plan rather than quietly charging the old
 * price — which is exactly what would happen if the id were pinned in an env
 * var and the price in plans.ts drifted away from it.
 */
export async function ensureRazorpayPlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: { plan: "pro" | "premium"; cycle: "monthly" | "yearly"; amountPaise: number; name: string }
): Promise<string> {
  const { data: cached } = await supabase
    .from("ca_razorpay_plans")
    .select("razorpay_plan_id")
    .eq("plan", params.plan)
    .eq("billing_cycle", params.cycle)
    .eq("amount", params.amountPaise)
    .maybeSingle();
  if (cached?.razorpay_plan_id) return cached.razorpay_plan_id;

  const created = await call<{ id: string }>("/plans", {
    method: "POST",
    body: JSON.stringify({
      period: params.cycle === "yearly" ? "yearly" : "monthly",
      interval: 1,
      item: {
        name: params.name,
        amount: params.amountPaise,
        currency: "INR",
      },
    }),
  });

  await supabase.from("ca_razorpay_plans").insert({
    plan: params.plan,
    billing_cycle: params.cycle,
    amount: params.amountPaise,
    razorpay_plan_id: created.id,
  });

  return created.id;
}

export interface RazorpaySubscription {
  id: string;
  status: string;
  short_url?: string;
}

/**
 * Creates the recurring subscription the student then authorises in checkout.
 *
 * total_count is how many cycles Razorpay will charge before stopping — it is
 * required, so "forever" has to be spelled as a large number. Ten years' worth
 * either way; a student who somehow reaches the end simply resubscribes.
 */
export async function createSubscription(params: {
  planId: string;
  cycle: "monthly" | "yearly";
  notes: Record<string, string>;
}): Promise<RazorpaySubscription> {
  return call<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: params.planId,
      total_count: params.cycle === "yearly" ? 10 : 120,
      customer_notify: 1,
      notes: params.notes,
    }),
  });
}

/**
 * Cancels at the end of the paid period rather than immediately — the student
 * paid for the period they're in, so `cancel_at_cycle_end: 1`.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await call(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  });
}

/** Constant-time compare, so a wrong signature can't be found by timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a subscription checkout callback.
 *
 * NOTE THE FIELD ORDER. For one-time orders Razorpay signs
 * `order_id|payment_id`; for subscriptions it signs
 * `payment_id|subscription_id` — reversed, and easy to get wrong, in which
 * case every legitimate payment is rejected as a forgery.
 *
 * Without this check anyone could POST a fabricated payment id and be
 * upgraded, so it is the only thing standing between the pricing page and a
 * free Premium plan.
 */
export function verifySubscriptionSignature(params: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = credentials();
  const expected = createHmac("sha256", keySecret)
    .update(`${params.paymentId}|${params.subscriptionId}`)
    .digest("hex");
  return safeEqual(expected, params.signature);
}

/** Webhooks are signed over the raw request body with a separate secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

/** End of the period a payment buys. */
export function periodEnd(cycle: "monthly" | "yearly", from: Date = new Date()): Date {
  const end = new Date(from);
  if (cycle === "yearly") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}
