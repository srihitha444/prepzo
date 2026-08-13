import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_description") || searchParams.get("error");
  const next = searchParams.get("next") ?? "/dashboard";
  // Don't trust `new URL(request.url).origin` — on this Next.js/Turbopack
  // dev setup it reflects the server's bind address (0.0.0.0) rather than
  // the Host header the browser actually sent, causing redirects to an
  // unreachable http://0.0.0.0:3000 origin. Reconstruct origin from the
  // Host header instead (same fix already applied in proxy.ts).
  const host = (request.headers.get("host") || new URL(request.url).host).toLowerCase();
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  // TEMP DIAGNOSTIC — remove once the CA PKCE issue is resolved.
  const incomingCookieNames = (await cookies()).getAll().map((c) => c.name);
  console.log("[auth/callback DEBUG] host:", host, "| origin:", origin, "| url:", request.url);
  console.log("[auth/callback DEBUG] incoming cookie names:", incomingCookieNames);
  const isCaHost =
    host.includes("ca.prepzo.study") ||
    host.includes(".ca.prepzo.study") ||
    host.includes("ca.localhost") ||
    host.includes("www.ca.localhost") ||
    host.includes("www.ca.prepzo.study");
  const loginPath = isCaHost ? "/ca/auth/login" : "/auth/login";

  if (providerError) {
    return NextResponse.redirect(
      `${origin}${loginPath}?error=auth_callback_failed&message=${encodeURIComponent(providerError)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("exam")
          .eq("id", user.id)
          .single();

        const profileData = profile as { exam: string | null } | null;
        if (!profileData?.exam) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("Supabase auth callback failed:", error.message);
    return NextResponse.redirect(
      `${origin}${loginPath}?error=auth_callback_failed&message=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(
    `${origin}${loginPath}?error=auth_callback_failed&message=${encodeURIComponent("Missing auth code")}`
  );
}
