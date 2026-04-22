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

    const { plan }: { plan: PlanKey } = await request.json();
    if (!PLANS[plan]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const planData = PLANS[plan];
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: planData.amount,
      currency: planData.currency,
      notes: {
        user_id: user.id,
        plan,
      },
    });

    // Save pending subscription
    await supabase.from("subscriptions").insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      plan,
      amount: planData.amount,
      status: "pending",
    });

    return NextResponse.json({
      order_id: order.id,
      amount: planData.amount,
      currency: planData.currency,
      description: planData.description,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
