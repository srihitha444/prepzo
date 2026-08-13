import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { normalizeReferralCode, REFERRAL_COMMISSION_PERCENT, REFERRAL_DISCOUNT_PERCENT, REFERRAL_VALID_MONTHS } from "@/lib/razorpay";
import { NextResponse } from "next/server";

function buildCode(userId: string, name?: string | null) {
  const prefix = normalizeReferralCode(name || "PREPZO").slice(0, 6) || "PREPZO";
  const suffix = userId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}${suffix}`.slice(0, 16);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const serviceClient = await createServiceClient();
    const user = await getRequestUser(request, supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();

    const { data: existingCode } = await serviceClient
      .from("referral_codes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json({ referral_code: existingCode });
    }

    let code = buildCode(user.id, profile?.name);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: createdCode, error } = await serviceClient
        .from("referral_codes")
        .insert({
          user_id: user.id,
          code,
          discount_percent: REFERRAL_DISCOUNT_PERCENT,
          commission_percent: REFERRAL_COMMISSION_PERCENT,
          valid_months: REFERRAL_VALID_MONTHS,
        })
        .select("*")
        .single();

      if (!error && createdCode) {
        return NextResponse.json({ referral_code: createdCode });
      }

      code = `${buildCode(user.id, profile?.name).slice(0, 12)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }

    return NextResponse.json({ error: "Could not create referral code" }, { status: 500 });
  } catch (error) {
    console.error("Get referral code error:", error);
    return NextResponse.json({ error: "Could not load referral code" }, { status: 500 });
  }
}
