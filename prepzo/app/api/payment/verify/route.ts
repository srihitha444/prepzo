import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { NextResponse } from "next/server";
import crypto from "crypto";
import type { Subscription } from "@/lib/supabase/types";
import { REFERRAL_COMMISSION_PERCENT, REFERRAL_VALID_MONTHS } from "@/lib/razorpay";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    }: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ success: false, error: "Missing payment fields" }, { status: 400 });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(razorpay_signature);

    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
    }

    // Get the subscription
    const { data: subscriptionRaw } = await serviceClient
      .from("subscriptions")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .eq("user_id", user.id)
      .single();

    const subscription = subscriptionRaw as Subscription | null;

    if (!subscription) {
      return NextResponse.json({ success: true });
    }

    // Calculate end date
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + 1);

    // Update subscription
    await serviceClient
      .from("subscriptions")
      .update({
        razorpay_payment_id,
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .eq("id", subscription.id);

    // Update user plan
    await serviceClient
      .from("profiles")
      .update({ plan: "paid" })
      .eq("id", user.id);

    const { data: activeReferral } = await serviceClient
      .from("referrals")
      .select("*")
      .eq("referred_user_id", user.id)
      .in("status", ["active", "pending"])
      .maybeSingle();

    let referral = activeReferral;

    if (!referral && subscription.referral_code_id) {
      const { data: codeRow } = await serviceClient
        .from("referral_codes")
        .select("id, user_id, status, expires_at")
        .eq("id", subscription.referral_code_id)
        .eq("status", "active")
        .maybeSingle();

      if (
        codeRow &&
        codeRow.user_id !== user.id &&
        (!codeRow.expires_at || new Date(codeRow.expires_at).getTime() >= Date.now())
      ) {
        const commissionEndsAt = new Date(startsAt);
        commissionEndsAt.setMonth(commissionEndsAt.getMonth() + REFERRAL_VALID_MONTHS);

        const { data: createdReferral } = await serviceClient
          .from("referrals")
          .insert({
            code_id: codeRow.id,
            referrer_user_id: codeRow.user_id,
            referred_user_id: user.id,
            first_subscription_id: subscription.id,
            status: "active",
            activated_at: startsAt.toISOString(),
            commission_ends_at: commissionEndsAt.toISOString(),
          })
          .select("*")
          .single();

        referral = createdReferral;
      }
    }

    if (referral?.status === "active" && referral.commission_ends_at) {
      const commissionEndsAt = new Date(referral.commission_ends_at);
      if (startsAt.getTime() <= commissionEndsAt.getTime()) {
        const paidAmount = subscription.amount || 0;
        const commissionAmount = Math.round(paidAmount * REFERRAL_COMMISSION_PERCENT / 100);
        const payoutMonth = new Date(startsAt.getFullYear(), startsAt.getMonth(), 1);

        if (commissionAmount > 0) {
          await serviceClient
            .from("referral_rewards")
            .insert({
              referral_id: referral.id,
              subscription_id: subscription.id,
              referrer_user_id: referral.referrer_user_id,
              referred_user_id: user.id,
              amount_paid: paidAmount,
              commission_amount: commissionAmount,
              commission_percent: REFERRAL_COMMISSION_PERCENT,
              currency: "INR",
              status: "pending",
              payout_month: payoutMonth.toISOString().slice(0, 10),
            });
        }
      } else {
        await serviceClient
          .from("referrals")
          .update({ status: "expired" })
          .eq("id", referral.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify payment error:", error);
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
