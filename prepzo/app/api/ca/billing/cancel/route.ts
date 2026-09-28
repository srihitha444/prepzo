import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { cancelSubscription } from "@/lib/ca/razorpay";

/**
 * Cancels auto-renewal. Required, not optional: the moment plans renew by
 * themselves, a student with no way to stop them is being charged
 * indefinitely with no exit.
 *
 * Cancels at the END of the paid period — they paid for the period they're
 * in, so they keep it. `cancel_requested_at` is what the UI reads to say
 * "active until X, then Free"; resolvePlan() does the actual downgrade when
 * current_period_end passes.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = await createServiceClient();
    const { data: subscription } = await service
      .from("ca_subscriptions")
      .select("id, user_id, razorpay_subscription_id, status, current_period_end, cancel_requested_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json({ error: "You don't have an active subscription." }, { status: 404 });
    }
    if (subscription.cancel_requested_at) {
      return NextResponse.json({
        success: true,
        already_cancelled: true,
        active_until: subscription.current_period_end,
      });
    }

    if (subscription.razorpay_subscription_id) {
      await cancelSubscription(subscription.razorpay_subscription_id);
    }

    await service
      .from("ca_subscriptions")
      .update({ cancel_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", subscription.id);

    return NextResponse.json({ success: true, active_until: subscription.current_period_end });
  } catch (error) {
    console.error("CA billing cancel error:", error);
    return NextResponse.json({ error: "Could not cancel your subscription" }, { status: 500 });
  }
}
