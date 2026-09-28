import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature, periodEnd } from "@/lib/ca/razorpay";

/**
 * Razorpay webhook. With auto-renewing subscriptions this is not a backstop —
 * it is the primary channel. Only the FIRST payment passes through the
 * browser; every renewal after that happens on Razorpay's schedule with
 * nobody watching, so if this route is wrong, subscriptions silently stop
 * extending and students lose access they have paid for.
 *
 * Deliberately NOT authenticated as a user: Razorpay calls this, not a
 * browser. The signature over the raw body is the only thing that makes it
 * trustworthy, so the body is read as text BEFORE parsing — re-serialising
 * parsed JSON would change the bytes and break the HMAC.
 *
 * Configure against RAZORPAY_WEBHOOK_SECRET, subscribed to:
 *   subscription.charged, subscription.halted,
 *   subscription.cancelled, subscription.completed
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error("CA billing webhook: signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        subscription?: { entity?: { id?: string; status?: string } };
        payment?: { entity?: { id?: string } };
      };
    };

    const subscriptionId = event.payload?.subscription?.entity?.id;
    if (!subscriptionId) {
      // Nothing actionable, but a 200 stops Razorpay retrying forever.
      return NextResponse.json({ received: true });
    }

    const service = await createServiceClient();
    const { data: subscription } = await service
      .from("ca_subscriptions")
      .select("id, user_id, plan, billing_cycle, status, current_period_end")
      .eq("razorpay_subscription_id", subscriptionId)
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json({ received: true });
    }

    const now = new Date();

    switch (event.event) {
      case "subscription.charged": {
        // Fires on the first payment AND on every renewal. Extend from the
        // existing period end rather than from now, so a webhook that arrives
        // late doesn't quietly shorten the period the student paid for.
        const base =
          subscription.current_period_end && new Date(subscription.current_period_end) > now
            ? new Date(subscription.current_period_end)
            : now;
        const end = periodEnd(subscription.billing_cycle as "monthly" | "yearly", base);

        await service
          .from("ca_subscriptions")
          .update({
            status: "active",
            razorpay_payment_id: event.payload?.payment?.entity?.id ?? null,
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", subscription.id);

        await service.from("profiles").update({ plan: subscription.plan }).eq("id", subscription.user_id);
        break;
      }

      case "subscription.halted": {
        // Razorpay retried a failed renewal and gave up. Access ends, but
        // resolvePlan() does the downgrade off current_period_end — leaving
        // the paid-for period intact rather than cutting them off mid-month.
        await service
          .from("ca_subscriptions")
          .update({ status: "halted", updated_at: now.toISOString() })
          .eq("id", subscription.id);
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed": {
        await service
          .from("ca_subscriptions")
          .update({ status: "cancelled", updated_at: now.toISOString() })
          .eq("id", subscription.id);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("CA billing webhook error:", error);
    // A 500 makes Razorpay retry, which is what we want for a transient fault.
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
