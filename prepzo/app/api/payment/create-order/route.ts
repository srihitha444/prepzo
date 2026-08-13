import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import {
  getRazorpay,
  getReferralDiscountedAmount,
  normalizeReferralCode,
  PLANS,
  REFERRAL_DISCOUNT_PERCENT,
  type PlanKey,
} from "@/lib/razorpay";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceClient = await createServiceClient();
    const user = await getRequestUser(request, supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      plan,
      amount,
      currency = "INR",
      receipt,
      referralCode,
    }: {
      plan?: PlanKey;
      amount?: number;
      currency?: string;
      receipt?: string;
      referralCode?: string;
    } = await request.json();

    if (plan && !PLANS[plan]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (!plan && (!Number.isInteger(amount) || amount < 100)) {
      return NextResponse.json({ error: "Amount must be at least 100 paise" }, { status: 400 });
    }

    const planData = plan ? PLANS[plan] : null;
    const originalAmount = planData?.amount ?? amount!;
    let orderAmount = originalAmount;
    const orderCurrency = planData?.currency ?? currency;
    let referralCodeId: string | null = null;
    let referralCodeValue: string | null = null;

    if (referralCode && plan) {
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

      referralCodeId = codeRow.id;
      referralCodeValue = codeRow.code;
      orderAmount = getReferralDiscountedAmount(originalAmount);
    }

    const razorpay = getRazorpay();
    const orderReceipt = receipt || `pz_${Date.now().toString(36)}_${user.id.slice(0, 8)}`;

    const order = await razorpay.orders.create({
      amount: orderAmount,
      currency: orderCurrency,
      receipt: orderReceipt,
      notes: {
        user_id: user.id,
        ...(plan ? { plan } : {}),
        ...(referralCodeValue ? { referral_code: referralCodeValue } : {}),
      },
    });

    if (plan && planData) {
      await serviceClient.from("subscriptions").insert({
        user_id: user.id,
        razorpay_order_id: order.id,
        plan,
        amount: orderAmount,
        original_amount: originalAmount,
        discount_amount: originalAmount - orderAmount,
        discount_percent: referralCodeId ? REFERRAL_DISCOUNT_PERCENT : 0,
        referral_code_id: referralCodeId,
        status: "pending",
      });
    }

    return NextResponse.json({
      order_id: order.id,
      amount: orderAmount,
      original_amount: originalAmount,
      discount_amount: originalAmount - orderAmount,
      referral_code: referralCodeValue,
      currency: orderCurrency,
      description: planData?.description ?? "Prepzo payment",
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Create order error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      error.statusCode === 401
    ) {
      return NextResponse.json({ error: "Razorpay authentication failed" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
