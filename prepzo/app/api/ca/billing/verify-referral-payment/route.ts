import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { verifyOrderSignature, periodEnd } from "@/lib/ca/razorpay";
import type { BillingCycle } from "@/lib/ca/plans";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json() as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
    if (!orderId || !paymentId || !signature || !verifyOrderSignature({ orderId, paymentId, signature })) {
      return NextResponse.json({ error: "We couldn't verify this payment." }, { status: 400 });
    }

    const service = await createServiceClient();
    const { data: sub } = await service.from("ca_subscriptions")
      .select("id, user_id, plan, billing_cycle, status, referral_code_id, referral_email, original_first_amount, discount_amount, referral_commission_percent, first_payment_id, mandate_authorized")
      .eq("first_payment_order_id", orderId).maybeSingle();
    if (!sub) return NextResponse.json({ error: "We couldn't find that referral checkout." }, { status: 404 });
    if (sub.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!sub.referral_code_id || !sub.mandate_authorized) {
      return NextResponse.json({ error: "Authorize the recurring plan before completing the discounted payment." }, { status: 409 });
    }

    const start = new Date();
    const end = periodEnd(sub.billing_cycle as BillingCycle, start);
    const commissionEndsAt = new Date(start);
    commissionEndsAt.setUTCMonth(commissionEndsAt.getUTCMonth() + 12);
    const { data: code } = await service.from("ca_referral_codes").select("user_id, code").eq("id", sub.referral_code_id).single();
    if (!code || !sub.referral_email || !user.email) throw new Error("Referral information is incomplete");
    const referredEmail = user.email.trim().toLowerCase();
    const { data: priorReferral } = await service.from("ca_referrals").select("id").eq("referred_email", referredEmail).maybeSingle();
    let referralId = priorReferral?.id as string | undefined;
    if (!referralId) {
      const { data: referral, error: referralError } = await service.from("ca_referrals").insert({
        code_id: sub.referral_code_id, referrer_user_id: code.user_id, referred_user_id: user.id,
        referred_email: referredEmail, ca_subscription_id: sub.id, status: "active", activated_at: start.toISOString(),
        commission_ends_at: commissionEndsAt.toISOString(),
      }).select("id").single();
      if (referralError) throw referralError;
      referralId = referral.id;
    }
    const commission = Math.round(Number(sub.original_first_amount) * Number(sub.referral_commission_percent) / 100);
    const { error: rewardError } = await service.from("ca_referral_rewards").upsert({
      referral_id: referralId, referrer_user_id: code.user_id, referred_user_id: user.id,
      ca_subscription_id: sub.id, amount_paid: Number(sub.original_first_amount) - Number(sub.discount_amount),
      razorpay_payment_id: paymentId, commission_amount: commission, commission_percent: sub.referral_commission_percent, status: "pending",
    }, { onConflict: "razorpay_payment_id", ignoreDuplicates: true });
    if (rewardError) throw rewardError;

    const { error: updateError } = await service.from("ca_subscriptions").update({
      status: "active", first_payment_id: paymentId, current_period_start: start.toISOString(),
      current_period_end: end.toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", sub.id);
    if (updateError) throw updateError;

    await service.from("profiles").update({ plan: sub.plan }).eq("id", user.id);
    return NextResponse.json({ success: true, plan: sub.plan, renews_on: end.toISOString(), discount_amount: sub.discount_amount });
  } catch (error) {
    console.error("CA referral payment verification error:", error);
    return NextResponse.json({ error: "Could not confirm the discounted payment" }, { status: 500 });
  }
}
