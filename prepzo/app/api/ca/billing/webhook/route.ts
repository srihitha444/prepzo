import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature, periodEnd } from "@/lib/ca/razorpay";
import type { BillingCycle } from "@/lib/ca/plans";

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
 *   payment.captured, subscription.charged, subscription.halted,
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
        payment?: { entity?: { id?: string; order_id?: string; amount?: number } };
      };
    };

    const service = await createServiceClient();
    const now = new Date();

    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (payment?.order_id && payment.id) {
        const { data: referredSub } = await service.from("ca_subscriptions")
          .select("id, user_id, plan, billing_cycle, status, referral_code_id, referral_email, original_first_amount, discount_amount, referral_commission_percent, mandate_authorized")
          .eq("first_payment_order_id", payment.order_id).maybeSingle();
        if (referredSub?.referral_code_id && referredSub.mandate_authorized && referredSub.referral_email) {
          const { data: code } = await service.from("ca_referral_codes").select("user_id").eq("id", referredSub.referral_code_id).maybeSingle();
          if (!code) throw new Error("Referral code missing for a captured first payment");
          const email = referredSub.referral_email.toLowerCase();
          const { data: existingReferral } = await service.from("ca_referrals").select("id, code_id").eq("referred_email", email).maybeSingle();
          if (existingReferral && existingReferral.code_id !== referredSub.referral_code_id) {
            throw new Error("Email already redeemed another referral code");
          }
          let referralId = existingReferral?.id as string | undefined;
          if (!referralId) {
            const commissionEndsAt = new Date(now);
            commissionEndsAt.setUTCMonth(commissionEndsAt.getUTCMonth() + 12);
            const { data: referral, error: referralError } = await service.from("ca_referrals").insert({
              code_id: referredSub.referral_code_id, referrer_user_id: code.user_id,
              referred_user_id: referredSub.user_id, referred_email: email,
              ca_subscription_id: referredSub.id, status: "active", activated_at: now.toISOString(),
              commission_ends_at: commissionEndsAt.toISOString(),
            }).select("id").single();
            if (referralError) throw referralError;
            referralId = referral.id;
          }
          const commission = Math.round(Number(referredSub.original_first_amount) * Number(referredSub.referral_commission_percent) / 100);
          const { error: rewardError } = await service.from("ca_referral_rewards").upsert({
            referral_id: referralId, referrer_user_id: code.user_id, referred_user_id: referredSub.user_id,
            ca_subscription_id: referredSub.id,
            amount_paid: Number(referredSub.original_first_amount) - Number(referredSub.discount_amount),
            razorpay_payment_id: payment.id,
            commission_amount: commission, commission_percent: referredSub.referral_commission_percent, status: "pending",
          }, { onConflict: "razorpay_payment_id", ignoreDuplicates: true });
          if (rewardError) throw rewardError;
          if (referredSub.status !== "active") {
            const end = periodEnd(referredSub.billing_cycle as BillingCycle, now);
            const { error: activateError } = await service.from("ca_subscriptions").update({
              status: "active", first_payment_id: payment.id, current_period_start: now.toISOString(),
              current_period_end: end.toISOString(), updated_at: now.toISOString(),
            }).eq("id", referredSub.id);
            if (activateError) throw activateError;
            await service.from("profiles").update({ plan: referredSub.plan }).eq("id", referredSub.user_id);
          }
        }
      }
      return NextResponse.json({ received: true });
    }

    const subscriptionId = event.payload?.subscription?.entity?.id;
    if (!subscriptionId) {
      // Nothing actionable, but a 200 stops Razorpay retrying forever.
      return NextResponse.json({ received: true });
    }

    const { data: subscription } = await service
      .from("ca_subscriptions")
      .select("id, user_id, plan, billing_cycle, status, current_period_end")
      .eq("razorpay_subscription_id", subscriptionId)
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json({ received: true });
    }

    switch (event.event) {
      case "subscription.charged": {
        // Fires on the first payment AND on every renewal. Extend from the
        // existing period end rather than from now, so a webhook that arrives
        // late doesn't quietly shorten the period the student paid for.
        const base =
          subscription.current_period_end && new Date(subscription.current_period_end) > now
            ? new Date(subscription.current_period_end)
            : now;
        const end = periodEnd(subscription.billing_cycle as BillingCycle, base);

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

        const charge = event.payload?.payment?.entity;
        if (charge?.id && charge.amount) {
          const { data: referral } = await service.from("ca_referrals")
            .select("id, code_id, referrer_user_id, referred_user_id, commission_ends_at")
            .eq("ca_subscription_id", subscription.id).maybeSingle();
          if (referral?.commission_ends_at && new Date(referral.commission_ends_at) > now) {
            const { data: code } = await service.from("ca_referral_codes").select("commission_percent").eq("id", referral.code_id).maybeSingle();
            if (code) {
              const commission = Math.round(Number(charge.amount) * Number(code.commission_percent) / 100);
              const { error: rewardError } = await service.from("ca_referral_rewards").upsert({
                referral_id: referral.id, referrer_user_id: referral.referrer_user_id,
                referred_user_id: referral.referred_user_id, ca_subscription_id: subscription.id,
                razorpay_payment_id: charge.id, amount_paid: charge.amount, commission_amount: commission,
                commission_percent: code.commission_percent, status: "pending",
              }, { onConflict: "razorpay_payment_id", ignoreDuplicates: true });
              if (rewardError) throw rewardError;
            }
          }
        }
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
