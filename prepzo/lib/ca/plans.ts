/**
 * The CA plan matrix — the single source of truth for every tier, price,
 * limit and entitlement. Pricing pages, upgrade prompts and server-side
 * enforcement all read from here, so a number can never say one thing on the
 * landing page and another in the code that blocks the action.
 *
 * Context: CA shipped deliberately free (Phase 10 removed the pricing section
 * and the Razorpay checkout entirely, and made limits unconditional by
 * hardcoding plan="paid"). This reintroduces paid tiers.
 */

export type CaPlan = "free" | "pro" | "premium";

/**
 * The version of the Terms a subscriber is accepting, recorded against each
 * purchase. Matches the "Last updated" date in
 * content/terms/terms-and-conditions.md — bump both together, so a dispute
 * about an auto-renewing charge can be answered with the exact text the
 * student saw.
 */
export const TERMS_VERSION = "2026-09-24";
export type BillingCycle = "monthly" | "quarterly" | "half_yearly" | "yearly";

/**
 * A metered allowance. `cap` is ALWAYS a real number — there is no true
 * "unlimited" anywhere, because an unbounded allowance is an unbounded bill
 * (every upload is a Gemini vision call). `marketedAsUnlimited` only changes
 * what the UI says; enforcement always uses `cap`.
 */
export interface Quota {
  cap: number;
  marketedAsUnlimited: boolean;
}

const limited = (cap: number): Quota => ({ cap, marketedAsUnlimited: false });
const unlimited = (cap: number): Quota => ({ cap, marketedAsUnlimited: true });

/** Every metered action. Used as the `feature` key in ca_usage_counters. */
export type MeteredFeature =
  | "uploads"
  | "cheatsheets"
  | "mock_tests"
  | "tutor_messages";

/** Tutor messages reset daily; everything else resets monthly. */
export const FEATURE_PERIOD: Record<MeteredFeature, "day" | "month"> = {
  uploads: "month",
  cheatsheets: "month",
  mock_tests: "month",
  tutor_messages: "day",
};

export const FEATURE_LABEL: Record<MeteredFeature, string> = {
  // One allowance covers every document the student uploads, whether a study
  // note or a real exam paper — both cost the same Gemini vision call.
  uploads: "document uploads",
  cheatsheets: "cheatsheets",
  mock_tests: "mock tests",
  tutor_messages: "AI Teacher messages",
};

export interface CaPlanDefinition {
  id: CaPlan;
  name: string;
  tagline: string;
  /** Rupees per month on the monthly plan. 0 for free. */
  monthlyPrice: number;
  /** Rupees for a 3-month block. null when the tier has no quarterly option. */
  quarterlyPrice: number | null;
  /** Rupees for a 6-month block. null when the tier has no half-yearly option. */
  halfYearlyPrice: number | null;
  /** Rupees per year on the annual plan. null when the tier has no annual option. */
  yearlyPrice: number | null;

  quotas: Record<MeteredFeature, Quota>;

  /** Ceilings on the student-chosen count in the generate picker (Phase 14). */
  questionsPerUpload: number;
  flashcardsPerUpload: number;

  cheatsheetPdfDownload: boolean;
  /**
   * History (past practice sessions, flashcard sessions, mock attempts and the
   * score trend) is a paid feature. Unlike the quotas this is a straight
   * on/off entitlement, so it is checked at the page rather than metered.
   */
  historyAccess: boolean;
}

export const CA_PLANS: Record<CaPlan, CaPlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try it on your own notes",
    monthlyPrice: 0,
    quarterlyPrice: null,
    halfYearlyPrice: null,
    yearlyPrice: null,
    quotas: {
      uploads: limited(2), // 2 free uploads for the whole account (lifetime, not monthly)
      cheatsheets: limited(1),
      mock_tests: limited(1),
      tutor_messages: limited(5),
    },
    questionsPerUpload: 15,
    flashcardsPerUpload: 10,
    cheatsheetPdfDownload: false,
    historyAccess: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For steady, month-on-month prep",
    monthlyPrice: 149,
    quarterlyPrice: 399,
    halfYearlyPrice: 749,
    yearlyPrice: 1399,
    quotas: {
      uploads: limited(15),
      cheatsheets: limited(5),
      mock_tests: limited(6),
      tutor_messages: limited(20),
    },
    questionsPerUpload: 40,
    flashcardsPerUpload: 20,
    cheatsheetPdfDownload: true,
    historyAccess: true,
  },
  premium: {
    id: "premium",
    name: "Premium",
    tagline: "Everything, for the final stretch",
    monthlyPrice: 299,
    quarterlyPrice: 799,
    halfYearlyPrice: 1499,
    // 12 × 299 = 3,588, discounted ~22% and rounded to a _99 ending.
    yearlyPrice: 2799,
    quotas: {
      uploads: unlimited(50),
      cheatsheets: unlimited(50),
      mock_tests: unlimited(30),
      tutor_messages: unlimited(200),
    },
    questionsPerUpload: 100,
    flashcardsPerUpload: 50,
    cheatsheetPdfDownload: true,
    historyAccess: true,
  },
};

export const CA_PLAN_ORDER: CaPlan[] = ["free", "pro", "premium"];
export const PAID_PLANS: CaPlan[] = ["pro", "premium"];

export function getPlan(plan: string | null | undefined): CaPlanDefinition {
  // Anything unrecognised — including the legacy "paid" value and the retired
  // "mid" id (renamed to "pro"; see supabase/ca-rename-mid-to-pro.sql, which
  // migrates any stored rows) — falls back to Free rather than silently
  // granting paid limits. Fail closed, never open.
  return CA_PLANS[plan as CaPlan] ?? CA_PLANS.free;
}

export function quotaFor(plan: CaPlanDefinition, feature: MeteredFeature): Quota {
  return plan.quotas[feature];
}

/** What the UI shows: "Unlimited" or the number. Enforcement never uses this. */
export function quotaLabel(quota: Quota): string {
  return quota.marketedAsUnlimited ? "Unlimited" : String(quota.cap);
}

/** How many months each billing cycle covers. */
export function cycleMonths(cycle: BillingCycle): number {
  switch (cycle) {
    case "monthly": return 1;
    case "quarterly": return 3;
    case "half_yearly": return 6;
    case "yearly": return 12;
  }
}

/** Human-readable label for a billing cycle. */
export function cycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case "monthly": return "Monthly";
    case "quarterly": return "3 Months";
    case "half_yearly": return "6 Months";
    case "yearly": return "Yearly";
  }
}

/** Price suffix shown next to the amount: "/month", "/3 months", etc. */
export function cycleSuffix(cycle: BillingCycle): string {
  switch (cycle) {
    case "monthly": return "/month";
    case "quarterly": return "/3 months";
    case "half_yearly": return "/6 months";
    case "yearly": return "/year";
  }
}

/**
 * Saving vs paying monthly for the same number of months.
 * Returns null for monthly (no saving) or if the cycle price is null.
 * @deprecated Use `cycleSaving` — `yearlySaving` is kept for call-sites that
 * have not been migrated yet.
 */
export function yearlySaving(plan: CaPlanDefinition): number | null {
  return cycleSaving(plan, "yearly");
}

/** Saving vs paying monthly for the same number of months. */
export function cycleSaving(plan: CaPlanDefinition, cycle: BillingCycle): number | null {
  const price = priceFor(plan, cycle);
  if (price === null || cycle === "monthly") return null;
  return plan.monthlyPrice * cycleMonths(cycle) - price;
}

/** Per-month equivalent when paying for a multi-month cycle. */
export function perMonth(plan: CaPlanDefinition, cycle: BillingCycle): number {
  const price = priceFor(plan, cycle);
  if (price === null) return plan.monthlyPrice;
  return Math.round(price / cycleMonths(cycle));
}

export function priceFor(plan: CaPlanDefinition, cycle: BillingCycle): number | null {
  switch (cycle) {
    case "monthly": return plan.monthlyPrice;
    case "quarterly": return plan.quarterlyPrice;
    case "half_yearly": return plan.halfYearlyPrice;
    case "yearly": return plan.yearlyPrice;
  }
}

/** Razorpay works in paise. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** ₹1,199 — en-IN gets Indian digit grouping right (1,00,000 not 100,000). */
export function formatPrice(rupees: number): string {
  return `₹${rupees.toLocaleString("en-IN")}`;
}
