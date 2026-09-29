import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { createSubscription, ensureRazorpayPlan } from "@/lib/ca/razorpay";
import { CA_PLANS, priceFor, toPaise, TERMS_VERSION, type BillingCycle, type CaPlan } from "@/lib/ca/plans";

/**
 * Starts a recurring subscription: ensures a Razorpay plan exists for this
 * price point, creates the subscription, and records it as `pending` for the
 * browser to authorise.
 *
 * The amount comes from lib/ca/plans.ts on the server and never from the
 * request — a client-supplied price is a client-chosen price.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { plan?: CaPlan; cycle?: BillingCycle; accept_terms?: boolean } = await request.json();
    const planId = body.plan;
    const cycle = body.cycle;

    if (planId !== "pro" && planId !== "premium") {
      return NextResponse.json({ error: "Choose a paid plan" }, { status: 400 });
    }
    if (cycle !== "monthly" && cycle !== "yearly") {
      return NextResponse.json({ error: "Choose a billing cycle" }, { status: 400 });
    }

    // Checked server-side, not just in the UI. A recurring mandate is the
    // charge most likely to be disputed later, so the acceptance has to be a
    // real precondition of creating one — a checkbox nobody verifies proves
    // nothing.
    if (body.accept_terms !== true) {
      return NextResponse.json(
        { error: "Please accept the Terms and Conditions and Privacy Policy to continue." },
        { status: 400 }
      );
    }

    const plan = CA_PLANS[planId];
    const rupees = priceFor(plan, cycle);
    if (rupees === null || rupees <= 0) {
      return NextResponse.json({ error: "That plan isn't available on that billing cycle" }, { status: 400 });
    }

    const service = await createServiceClient();

    // Refuse to stack mandates. Without this, a student on Mid who buys
    // Premium would end up with two live subscriptions and be charged twice
    // every cycle — they have to cancel or let the current one lapse first.
    const { data: existing } = await service
      .from("ca_subscriptions")
      .select("id, plan, current_period_end")
      .eq("user_id", user.id)
      .eq("status", "active")
      .is("cancel_requested_at", null)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        {
          error: `You already have an active ${CA_PLANS[existing.plan as CaPlan]?.name ?? existing.plan} subscription. Cancel it first to switch plans.`,
        },
        { status: 409 }
      );
    }

    const amountPaise = toPaise(rupees);
    const razorpayPlanId = await ensureRazorpayPlan(service, {
      plan: planId,
      cycle,
      amountPaise,
      name: `Prepzo CA ${plan.name} (${cycle})`,
    });

    const { data: subscription, error: insertError } = await service
      .from("ca_subscriptions")
      .insert({
        user_id: user.id,
        plan: planId,
        billing_cycle: cycle,
        amount: amountPaise,
        razorpay_plan_id: razorpayPlanId,
        status: "pending",
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      })
      .select("id")
      .single();

    if (insertError || !subscription) {
      console.error("CA subscription insert failed:", insertError);
      return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
    }

    const rzpSubscription = await createSubscription({
      planId: razorpayPlanId,
      cycle,
      notes: { user_id: user.id, plan: planId, cycle, subscription_id: subscription.id },
    });

    await service
      .from("ca_subscriptions")
      .update({ razorpay_subscription_id: rzpSubscription.id, updated_at: new Date().toISOString() })
      .eq("id", subscription.id);

    return NextResponse.json({
      success: true,
      subscription_id: rzpSubscription.id,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      plan_name: plan.name,
      amount: amountPaise,
    });
  } catch (error) {
    console.error("CA create-subscription error:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
