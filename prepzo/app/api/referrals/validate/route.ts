import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { normalizeReferralCode, REFERRAL_DISCOUNT_PERCENT } from "@/lib/razorpay";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceClient = await createServiceClient();
    const user = await getRequestUser(request, supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code: rawCode }: { code?: string } = await request.json();
    const code = normalizeReferralCode(rawCode || "");

    if (code.length < 4) {
      return NextResponse.json({ valid: false, error: "Enter a valid referral code" }, { status: 400 });
    }

    const { data: codeRow } = await serviceClient
      .from("referral_codes")
      .select("id, user_id, code, status, expires_at")
      .ilike("code", code)
      .maybeSingle();

    if (!codeRow) {
      console.error("Referral code not found during validation", {
        code,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      });
      return NextResponse.json({ valid: false, error: "Referral code not found" }, { status: 404 });
    }

    if (String(codeRow.status || "").toLowerCase() !== "active") {
      return NextResponse.json({ valid: false, error: "Referral code is not active" }, { status: 400 });
    }

    if (codeRow.user_id === user.id) {
      return NextResponse.json({ valid: false, error: "You cannot use your own code" }, { status: 400 });
    }

    if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ valid: false, error: "Referral code has expired" }, { status: 400 });
    }

    const { data: existingReferral } = await serviceClient
      .from("referrals")
      .select("id")
      .eq("referred_user_id", user.id)
      .maybeSingle();

    if (existingReferral) {
      return NextResponse.json({ valid: false, error: "This account already used a referral" }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      code: codeRow.code,
      discount_percent: REFERRAL_DISCOUNT_PERCENT,
    });
  } catch (error) {
    console.error("Validate referral error:", error);
    return NextResponse.json({ valid: false, error: "Could not validate referral code" }, { status: 500 });
  }
}
