import { TERMS_VERSION } from "@/lib/ca/plans";

export interface ReferralCode {
  id: string;
  user_id: string;
  discount_percent: number;
  commission_percent: number;
  valid_months: number;
  created_at: string;
}

function referralCodeExpiry(createdAt: string, validMonths: number): Date {
  const expiry = new Date(createdAt);
  const originalDay = expiry.getUTCDate();
  expiry.setUTCDate(1);
  expiry.setUTCMonth(expiry.getUTCMonth() + validMonths);
  const lastDay = new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate();
  expiry.setUTCDate(Math.min(originalDay, lastDay));
  return expiry;
}

/**
 * Resolves a referral code for this buyer, or says why it can't be used.
 * Shared by the checkout preview and create-subscription so the discount the
 * student is shown is the discount they are charged.
 */
export async function lookupReferralCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  rawCode: string,
  user: { id: string; email?: string | null }
): Promise<{ code: ReferralCode } | { error: string; status: number }> {
  const email = user.email?.trim().toLowerCase();
  if (!email) return { error: "Your account needs a verified email to use a referral code.", status: 400 };

  const normalizedCode = rawCode.trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(normalizedCode)) return { error: "Referral codes must be 3 to 5 letters.", status: 400 };

  const { data } = await service.from("ca_referral_codes")
    .select("id, user_id, discount_percent, commission_percent, valid_months, created_at")
    .eq("code", normalizedCode).eq("status", "active").maybeSingle();
  if (!data) return { error: "That referral code is invalid or inactive.", status: 400 };
  if (referralCodeExpiry(data.created_at, data.valid_months) <= new Date()) {
    return { error: "That referral code has expired.", status: 400 };
  }
  if (data.user_id === user.id) return { error: "You can't use your own referral code.", status: 400 };

  const { data: existingUse } = await service.from("ca_referrals").select("id").eq("referred_email", email).maybeSingle();
  if (existingUse) return { error: "This email has already used a referral code.", status: 409 };

  return { code: data as ReferralCode };
}

/**
 * Terms are accepted once, at signup, and recorded on the auth user's
 * metadata. Accounts that predate that (or were created through "Continue
 * with Google" on the login page) have nothing recorded and are asked once at
 * checkout instead. A newer TERMS_VERSION asks again.
 */
export function hasAcceptedTerms(user: { user_metadata?: Record<string, unknown> | null }): boolean {
  return user.user_metadata?.terms_version === TERMS_VERSION;
}
