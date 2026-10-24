import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { lookupReferralCode } from "@/lib/ca/referrals";
import { CA_PLANS, priceFor, toPaise, type BillingCycle, type CaPlan } from "@/lib/ca/plans";

/**
 * Checkout preview for a referral code: checks it and returns the discounted
 * first payment so the student sees the real total before Razorpay opens.
 * Nothing is reserved here — create-subscription re-checks the code.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: { code?: string; plan?: CaPlan; cycle?: BillingCycle } = await request.json();
    if (body.plan !== "pro" && body.plan !== "premium") {
      return NextResponse.json({ error: "Choose a paid plan" }, { status: 400 });
    }
    const plan = CA_PLANS[body.plan];
    const rupees = body.cycle ? priceFor(plan, body.cycle) : null;
    if (!rupees) return NextResponse.json({ error: "Choose a billing cycle" }, { status: 400 });

    const service = await createServiceClient();
    const result = await lookupReferralCode(service, body.code ?? "", user);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const originalAmount = toPaise(rupees);
    const discountAmount = toPaise(plan.monthlyPrice * result.code.discount_percent / 100);
    return NextResponse.json({
      valid: true,
      original_amount: originalAmount,
      discount_amount: discountAmount,
      amount: originalAmount - discountAmount,
    });
  } catch (error) {
    console.error("CA referral preview error:", error);
    return NextResponse.json({ error: "Could not check that code" }, { status: 500 });
  }
}
