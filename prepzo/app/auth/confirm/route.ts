import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Handles email-link flows (password recovery, magic link, signup
// confirmation) via Supabase's token_hash + verifyOtp() pattern — separate
// from /auth/callback's PKCE code exchange (used only for OAuth). This
// verification happens entirely server-side against the token_hash itself,
// so — unlike the PKCE code exchange — it does NOT require the browser
// completing the flow to be the same one that initiated it. That matters
// specifically for password recovery: the email link is very often opened
// on a different browser/device than the one the reset was requested from,
// which is exactly what broke when recovery was routed through
// /auth/callback (see the reset-password email template in the Supabase
// dashboard, which must point here with token_hash/type/next — see
// docs/ca-platform or ask for the exact template text).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/dashboard";

  const host = (request.headers.get("host") || new URL(request.url).host).toLowerCase();
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const isCaHost =
    host.includes("ca.prepzo.study") ||
    host.includes(".ca.prepzo.study") ||
    host.includes("ca.localhost") ||
    host.includes("www.ca.localhost") ||
    host.includes("www.ca.prepzo.study");
  const loginPath = isCaHost ? "/ca/auth/login" : "/auth/login";
  // `next` is whatever was passed as `redirectTo` to resetPasswordForEmail
  // (a full absolute URL) — pass it through as-is; only prefix it with
  // this route's own origin if it arrived as a bare path.
  const redirectTarget = rawNext.startsWith("http") ? rawNext : `${origin}${rawNext}`;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(redirectTarget);
    }
    return NextResponse.redirect(
      `${origin}${loginPath}?error=auth_callback_failed&message=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(
    `${origin}${loginPath}?error=auth_callback_failed&message=${encodeURIComponent("Missing or invalid confirmation link")}`
  );
}
