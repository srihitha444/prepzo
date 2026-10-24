import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { createOrder, createSubscription, ensureRazorpayPlan, periodEnd, razorpayKeyId } from "@/lib/ca/razorpay";
import { CA_PLANS, priceFor, toPaise, TERMS_VERSION, type BillingCycle, type CaPlan } from "@/lib/ca/plans";
import { hasAcceptedTerms, lookupReferralCode, type ReferralCode } from "@/lib/ca/referrals";

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

    const body: { plan?: CaPlan; cycle?: BillingCycle; accept_terms?: boolean; referral_code?: string } = await request.json();
    const planId = body.plan;
    const cycle = body.cycle;

    if (planId !== "pro" && planId !== "premium") {
      return NextResponse.json({ error: "Choose a paid plan" }, { status: 400 });
    }
    if (cycle !== "monthly" && cycle !== "quarterly" && cycle !== "half_yearly" && cycle !== "yearly") {
      return NextResponse.json({ error: "Choose a billing cycle" }, { status: 400 });
    }

    // Checked server-side, not just in the UI. A recurring mandate is the
    // charge most likely to be disputed later, so acceptance has to be a real
    // precondition of creating one. It is normally recorded at signup; older
    // accounts tick it once at checkout instead.
    const termsOnRecord = hasAcceptedTerms(user);
    if (!termsOnRecord && body.accept_terms !== true) {
      return NextResponse.json(
        { error: "Please accept the Terms and Conditions and Privacy Policy to continue.", terms_required: true },
        { status: 400 }
      );
    }

    const plan = CA_PLANS[planId];
    const rupees = priceFor(plan, cycle);
    if (rupees === null || rupees <= 0) {
      return NextResponse.json({ error: "That plan isn't available on that billing cycle" }, { status: 400 });
    }

    const service = await createServiceClient();

    if (!termsOnRecord) {
      await service.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() },
      });
    }

    const email = user.email?.trim().toLowerCase();
    let code: ReferralCode | null = null;
    if (body.referral_code) {
      const result = await lookupReferralCode(service, body.referral_code, user);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
      code = result.code;
    }

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

    if (email) {
      const { data: pendingReferral } = await service.from("ca_subscriptions")
        .select("id, plan, billing_cycle, referral_code_id, razorpay_subscription_id, first_payment_order_id, amount, discount_amount, original_first_amount")
        .eq("user_id", user.id).eq("status", "pending").eq("referral_email", email).maybeSingle();
      if (pendingReferral) {
        if (!code || pendingReferral.referral_code_id !== code.id) {
          return NextResponse.json({ error: "You have a referral checkout in progress. Resume it with the same code before trying another." }, { status: 409 });
        }
        if (pendingReferral.plan !== planId || pendingReferral.billing_cycle !== cycle || !pendingReferral.razorpay_subscription_id || !pendingReferral.first_payment_order_id) {
          return NextResponse.json({ error: "You have a referral checkout in progress. Resume it with the same plan and code." }, { status: 409 });
        }
        return NextResponse.json({
          success: true, subscription_id: pendingReferral.razorpay_subscription_id,
          order_id: pendingReferral.first_payment_order_id, key_id: razorpayKeyId(),
          plan_name: CA_PLANS[planId].name, amount: Number(pendingReferral.original_first_amount) - Number(pendingReferral.discount_amount),
          original_amount: pendingReferral.original_first_amount, discount_amount: pendingReferral.discount_amount,
        });
      }
    }

    const originalAmountPaise = toPaise(rupees);
    // The code discounts one month of the selected plan, even when the first
    // payment covers a multi-month billing cycle. The recurring plan itself
    // always remains at its standard full-cycle price.
    const discountPaise = code ? toPaise(plan.monthlyPrice * code.discount_percent / 100) : 0;
    const firstAmountPaise = originalAmountPaise - discountPaise;
    const razorpayPlanId = await ensureRazorpayPlan(service, {
      plan: planId,
      cycle,
      amountPaise: originalAmountPaise,
      name: `Prepzo CA ${plan.name} (${cycle})`,
    });

    const { data: subscription, error: insertError } = await service
      .from("ca_subscriptions")
      .insert({
        user_id: user.id,
        plan: planId,
        billing_cycle: cycle,
        amount: originalAmountPaise,
        referral_code_id: code?.id ?? null,
        original_first_amount: originalAmountPaise,
        discount_amount: discountPaise,
        first_payment_order_id: null,
        first_payment_id: null,
        // Set only after the gateway objects have been created. A failed
        // gateway request must not reserve this email's one-time code forever.
        referral_email: null,
        referral_discount_percent: code?.discount_percent ?? 0,
        referral_commission_percent: code?.commission_percent ?? 0,
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

    const renewalAt = periodEnd(cycle, new Date());
    const rzpSubscription = await createSubscription({
      planId: razorpayPlanId,
      cycle,
      startAt: code ? renewalAt : undefined,
      notes: { user_id: user.id, plan: planId, cycle, subscription_id: subscription.id },
    });

    let firstOrderId: string | null = null;
    if (code) {
      const order = await createOrder({ amountPaise: firstAmountPaise, receipt: subscription.id.replaceAll("-", "").slice(0, 40), notes: { user_id: user.id, subscription_id: subscription.id, referral_code_id: code.id } });
      firstOrderId = order.id;
    }

    const { error: checkoutLinkError } = await service
      .from("ca_subscriptions")
      .update({ razorpay_subscription_id: rzpSubscription.id, first_payment_order_id: firstOrderId, referral_email: code ? email : null, updated_at: new Date().toISOString() })
      .eq("id", subscription.id);
    if (checkoutLinkError) throw checkoutLinkError;

    return NextResponse.json({
      success: true,
      subscription_id: rzpSubscription.id,
      order_id: firstOrderId,
      key_id: razorpayKeyId(),
      plan_name: plan.name,
      amount: code ? firstAmountPaise : originalAmountPaise,
      original_amount: originalAmountPaise,
      discount_amount: discountPaise,
      renewal_at: code ? renewalAt.toISOString() : null,
    });
  } catch (error) {
    console.error("CA create-subscription error:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
