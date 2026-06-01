import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import type { Subscription } from "@/lib/supabase/types";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
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
    if (subscription.plan === "monthly") {
      endsAt.setMonth(endsAt.getMonth() + 1);
    } else {
      endsAt.setFullYear(endsAt.getFullYear() + 1);
    }

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify payment error:", error);
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
