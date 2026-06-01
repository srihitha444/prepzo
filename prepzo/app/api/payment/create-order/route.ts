import { createClient } from "@/lib/supabase/server";
import { getRazorpay, PLANS, type PlanKey } from "@/lib/razorpay";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      plan,
      amount,
      currency = "INR",
      receipt,
    }: {
      plan?: PlanKey;
      amount?: number;
      currency?: string;
      receipt?: string;
    } = await request.json();

    if (plan && !PLANS[plan]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (!plan && (!Number.isInteger(amount) || amount < 100)) {
      return NextResponse.json({ error: "Amount must be at least 100 paise" }, { status: 400 });
    }

    const planData = plan ? PLANS[plan] : null;
    const orderAmount = planData?.amount ?? amount!;
    const orderCurrency = planData?.currency ?? currency;
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: orderAmount,
      currency: orderCurrency,
      receipt: receipt || `prepzo_${user.id}_${Date.now()}`,
      notes: {
        user_id: user.id,
        ...(plan ? { plan } : {}),
      },
    });

    if (plan && planData) {
      await supabase.from("subscriptions").insert({
        user_id: user.id,
        razorpay_order_id: order.id,
        plan,
        amount: planData.amount,
        status: "pending",
      });
    }

    return NextResponse.json({
      order_id: order.id,
      amount: orderAmount,
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
