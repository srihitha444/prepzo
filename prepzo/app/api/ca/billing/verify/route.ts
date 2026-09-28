import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { verifySubscriptionSignature, periodEnd } from "@/lib/ca/razorpay";

/**
 * Called by the browser once Razorpay checkout authorises the mandate.
 * Verifies the signature, activates the subscription and moves
 * profiles.plan.
 *
 * The signature check is the whole security boundary: without it, a POST with
 * any made-up payment id would upgrade the caller. The webhook is the backstop
 * for when the browser never gets here (closed tab, lost connection), and
 * every renewal after this one arrives through the webhook alone — both paths
 * are idempotent, so whichever lands first wins.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: {
      razorpay_subscription_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    } = await request.json();

    const {
      razorpay_subscription_id: subscriptionId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = body;

    if (!subscriptionId || !paymentId || !signature) {
      return NextResponse.json({ error: "Incomplete payment details" }, { status: 400 });
    }

    if (!verifySubscriptionSignature({ subscriptionId, paymentId, signature })) {
      console.error(`CA billing: signature mismatch for subscription ${subscriptionId}`);
      return NextResponse.json({ error: "We couldn't verify this payment." }, { status: 400 });
    }

    const service = await createServiceClient();
    const { data: subscription } = await service
      .from("ca_subscriptions")
      .select("id, user_id, plan, billing_cycle, status")
      .eq("razorpay_subscription_id", subscriptionId)
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json({ error: "We couldn't find that subscription." }, { status: 404 });
    }
    // A valid signature proves the payment, not who is asking about it.
    if (subscription.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (subscription.status === "active") {
      return NextResponse.json({ success: true, plan: subscription.plan, already_active: true });
    }

    const start = new Date();
    const end = periodEnd(subscription.billing_cycle as "monthly" | "yearly", start);

    await service
      .from("ca_subscriptions")
      .update({
        status: "active",
        razorpay_payment_id: paymentId,
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    await service.from("profiles").update({ plan: subscription.plan }).eq("id", subscription.user_id);

    return NextResponse.json({ success: true, plan: subscription.plan, renews_on: end.toISOString() });
  } catch (error) {
    console.error("CA billing verify error:", error);
    return NextResponse.json({ error: "Could not confirm your payment" }, { status: 500 });
  }
}
