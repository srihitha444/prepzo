import { getRequestUser } from "@/lib/supabase/api-auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  getRazorpay,
  getReferralDiscountedAmount,
  normalizeReferralCode,
  PLANS,
  REFERRAL_DISCOUNT_PERCENT,
  type PlanKey,
} from "@/lib/razorpay";
import { NextResponse } from "next/server";

function getPaymentErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      error?: { description?: string; reason?: string; code?: string };
      description?: string;
      message?: string;
    };

    return (
      maybeError.error?.description ||
      maybeError.error?.reason ||
      maybeError.description ||
      maybeError.message ||
      "Failed to create autopay subscription"
    );
  }

  return "Failed to create autopay subscription";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceClient = await createServiceClient();
    const user = await getRequestUser(request, supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.RAZORPAY_MONTHLY_PLAN_ID) {
      return NextResponse.json(
        { error: "Autopay is not configured yet. Add RAZORPAY_MONTHLY_PLAN_ID from Razorpay Dashboard." },
        { status: 503 }
      );
    }

    const { plan, referralCode }: { plan?: PlanKey; referralCode?: string } = await request.json();
    if (plan !== "monthly") {
      return NextResponse.json({ error: "Invalid autopay plan" }, { status: 400 });
    }

    const planData = PLANS[plan];
    const planId = process.env.RAZORPAY_MONTHLY_PLAN_ID;
    let offerId: string | undefined;
    let subscriptionAmount: number = planData.amount;
    let referralCodeId: string | null = null;
    let referralCodeValue: string | null = null;
    let discountAmount = 0;
    let discountPercent = 0;

    if (referralCode) {
      if (!process.env.RAZORPAY_REFERRAL_FIRST_MONTH_OFFER_ID) {
        return NextResponse.json(
          { error: "Referral first-month discount is not configured yet. Add RAZORPAY_REFERRAL_FIRST_MONTH_OFFER_ID from Razorpay Dashboard." },
          { status: 503 }
        );
      }

      const code = normalizeReferralCode(referralCode);
      if (code.length < 4) {
        return NextResponse.json({ error: "Referral code is too short" }, { status: 400 });
      }

      const { data: codeRow } = await serviceClient
        .from("referral_codes")
        .select("id, user_id, code, status, expires_at")
        .ilike("code", code)
        .maybeSingle();

      if (!codeRow) {
        return NextResponse.json({ error: "Referral code is invalid" }, { status: 400 });
      }

      if (String(codeRow.status || "").toLowerCase() !== "active") {
        return NextResponse.json({ error: "Referral code is not active" }, { status: 400 });
      }

      if (codeRow.user_id === user.id) {
        return NextResponse.json({ error: "You cannot use your own referral code" }, { status: 400 });
      }

      if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ error: "Referral code has expired" }, { status: 400 });
      }

      const { data: existingReferral } = await serviceClient
        .from("referrals")
        .select("id")
        .eq("referred_user_id", user.id)
        .maybeSingle();

      if (existingReferral) {
        return NextResponse.json({ error: "A referral has already been used on this account" }, { status: 400 });
      }

      offerId = process.env.RAZORPAY_REFERRAL_FIRST_MONTH_OFFER_ID;
      subscriptionAmount = getReferralDiscountedAmount(planData.amount);
      referralCodeId = codeRow.id;
      referralCodeValue = codeRow.code;
      discountAmount = planData.amount - subscriptionAmount;
      discountPercent = REFERRAL_DISCOUNT_PERCENT;
    }

    const razorpay = getRazorpay();
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 12,
      customer_notify: 1,
      ...(offerId ? { offer_id: offerId } : {}),
      notes: {
        user_id: user.id,
        plan,
        ...(referralCodeValue ? { referral_code: referralCodeValue } : {}),
      },
    });

    await serviceClient.from("subscriptions").insert({
      user_id: user.id,
      razorpay_subscription_id: subscription.id,
      plan,
      amount: subscriptionAmount,
      original_amount: planData.amount,
      discount_amount: discountAmount,
      discount_percent: discountPercent,
      referral_code_id: referralCodeId,
      status: "pending",
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      amount: subscriptionAmount,
      original_amount: planData.amount,
      discount_amount: discountAmount,
      referral_code: referralCodeValue,
      currency: planData.currency,
      description: `${planData.description} Autopay`,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    const message = getPaymentErrorMessage(error);
    console.error("Create Razorpay subscription error:", {
      message,
      error,
      hasPlanId: Boolean(process.env.RAZORPAY_MONTHLY_PLAN_ID),
      keyMode: process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_") ? "live" : "test",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
