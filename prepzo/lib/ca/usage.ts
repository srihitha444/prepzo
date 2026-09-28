import {
  FEATURE_PERIOD,
  FEATURE_LABEL,
  getPlan,
  quotaFor,
  type CaPlanDefinition,
  type MeteredFeature,
} from "@/lib/ca/plans";

/**
 * Server-side quota metering. Every metered action goes through
 * consumeQuota() BEFORE the expensive work starts, so a student can't burn a
 * Gemini call they aren't entitled to.
 *
 * Consumption is atomic (see ca_consume_quota in
 * supabase/ca-plans-and-metering.sql): the cap comparison happens inside the
 * same statement as the increment. A read-then-write would let two requests
 * fired together both pass the check.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any;

/**
 * Start of the current window, in UTC.
 *
 * UTC rather than IST is a real decision: a student in India sees their daily
 * AI Teacher allowance reset at 05:30 local, not midnight. Monthly windows are
 * barely affected, but the daily one is noticeable — worth revisiting if
 * students ask why their messages come back mid-morning. Consistency matters
 * more than the exact boundary, since period_start is a stored key: changing
 * the rule later strands existing counter rows in the old window.
 */
export function periodStart(feature: MeteredFeature, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  if (FEATURE_PERIOD[feature] === "month") d.setUTCDate(1);
  return d.toISOString();
}

export interface QuotaState {
  feature: MeteredFeature;
  used: number;
  cap: number;
  remaining: number;
  marketedAsUnlimited: boolean;
}

export async function getUsage(
  supabase: ServiceClient,
  userId: string,
  planName: string | null | undefined,
  features: MeteredFeature[]
): Promise<QuotaState[]> {
  const plan = getPlan(planName);
  const { data } = await supabase
    .from("ca_usage_counters")
    .select("feature, period_start, used")
    .eq("user_id", userId)
    .in("feature", features);

  return features.map((feature) => {
    const quota = quotaFor(plan, feature);
    const row = (data || []).find(
      (r: { feature: string; period_start: string }) =>
        r.feature === feature && new Date(r.period_start).toISOString() === periodStart(feature)
    );
    const used = row?.used ?? 0;
    return {
      feature,
      used,
      cap: quota.cap,
      remaining: Math.max(0, quota.cap - used),
      marketedAsUnlimited: quota.marketedAsUnlimited,
    };
  });
}

export interface ConsumeResult {
  ok: boolean;
  used: number;
  cap: number;
  /** Set when ok is false — ready to show the student. */
  message?: string;
  /** What the caller passes to releaseQuota() if the work later fails. */
  periodStart: string;
}

export async function consumeQuota(
  supabase: ServiceClient,
  userId: string,
  planName: string | null | undefined,
  feature: MeteredFeature
): Promise<ConsumeResult> {
  const plan = getPlan(planName);
  const quota = quotaFor(plan, feature);
  const start = periodStart(feature);

  if (quota.cap <= 0) {
    return { ok: false, used: 0, cap: 0, periodStart: start, message: exhaustedMessage(plan, feature) };
  }

  const { data, error } = await supabase.rpc("ca_consume_quota", {
    p_user_id: userId,
    p_feature: feature,
    p_period_start: start,
    p_cap: quota.cap,
  });

  if (error) {
    // Fail CLOSED. A metering outage must not become a free-for-all on a
    // feature that costs a Gemini call per use.
    console.error(`[usage] ca_consume_quota failed for ${feature}:`, error);
    return {
      ok: false,
      used: 0,
      cap: quota.cap,
      periodStart: start,
      message: "We couldn't check your plan usage just now. Please try again in a moment.",
    };
  }

  // NULL means the cap was already reached — see the function's comment.
  if (data === null || data === undefined) {
    return { ok: false, used: quota.cap, cap: quota.cap, periodStart: start, message: exhaustedMessage(plan, feature) };
  }

  return { ok: true, used: data as number, cap: quota.cap, periodStart: start };
}

/** Give back a unit when the work it paid for failed after consumption. */
export async function releaseQuota(
  supabase: ServiceClient,
  userId: string,
  feature: MeteredFeature,
  start?: string
): Promise<void> {
  const { error } = await supabase.rpc("ca_release_quota", {
    p_user_id: userId,
    p_feature: feature,
    p_period_start: start ?? periodStart(feature),
  });
  // Best-effort: the student's action already failed and is being reported.
  // Losing one unit of quota is bad, but failing the error path is worse.
  if (error) console.error(`[usage] ca_release_quota failed for ${feature}:`, error);
}

function exhaustedMessage(plan: CaPlanDefinition, feature: MeteredFeature): string {
  const quota = quotaFor(plan, feature);
  const window = FEATURE_PERIOD[feature] === "day" ? "today" : "this month";
  const label = FEATURE_LABEL[feature];

  if (quota.marketedAsUnlimited) {
    // Hitting an "unlimited" cap means the abuse guard fired, not that the
    // student bought the wrong plan — don't tell them to upgrade.
    return `You've hit the fair-use limit of ${quota.cap} ${label} ${window}. Get in touch if you genuinely need more.`;
  }
  if (plan.id === "premium") {
    return `You've used all ${quota.cap} ${label} ${window}.`;
  }
  return `You've used all ${quota.cap} ${label} ${window} on the ${plan.name} plan. Upgrade for more.`;
}

/**
 * The caller's CURRENT plan, accounting for expiry.
 *
 * profiles.plan is the fast path, but it only changes when something writes
 * to it — a subscription that simply runs out never writes anything, so a
 * lapsed Premium user would keep Premium forever. Rather than depend on a
 * cron job that might not run, this verifies a paid plan against
 * ca_subscriptions on read and self-heals: an expired subscription is marked
 * `expired` and the profile is dropped back to Free, right here.
 *
 * Free costs one query; a paid plan costs two. Worth it to make "what can
 * this user do" answerable without trusting a background job.
 */
export async function resolvePlan(supabase: ServiceClient, userId: string): Promise<CaPlanDefinition> {
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", userId).single();
  const claimed = getPlan(profile?.plan);
  if (claimed.id === "free") return claimed;

  // 'halted' is included deliberately: Razorpay has stopped retrying a failed
  // renewal, but the student still paid for the period they're in. Access ends
  // when current_period_end passes, not the moment a renewal fails. A
  // cancelled-at-period-end subscription stays 'active' with
  // cancel_requested_at set, so it matches here too and keeps its period.
  const { data: subscription } = await supabase
    .from("ca_subscriptions")
    .select("id, plan, current_period_end")
    .eq("user_id", userId)
    .in("status", ["active", "halted"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  const stillValid =
    subscription?.current_period_end && new Date(subscription.current_period_end).getTime() > Date.now();

  if (stillValid) return getPlan(subscription.plan);

  // Lapsed, or the profile claims a paid plan with no subscription behind it
  // at all (a manual edit, or a half-finished checkout). Either way, Free.
  if (subscription?.id) {
    await supabase
      .from("ca_subscriptions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", subscription.id);
  }
  await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
  return getPlan("free");
}

/** Resolve the caller's plan once, for routes that need both plan and limits. */
export async function getUserPlan(supabase: ServiceClient, userId: string): Promise<CaPlanDefinition> {
  return resolvePlan(supabase, userId);
}
