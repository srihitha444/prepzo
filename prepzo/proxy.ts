import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/auth/signup",
  "/auth/callback",
  "/terms",
  "/privacy-policy",
  "/terms-and-conditions",
];
const PUBLIC_PREFIXES = ["/tools", "/blog", "/referral"];
const ADMIN_PATHS = ["/admin"];

const CA_HOSTS = new Set([
  "ca.prepzo.study",
  "www.ca.prepzo.study",
  "ca.localhost",
  "www.ca.localhost",
]);
const PREVIEW_COOKIE = "prepzo_preview_vertical";

function resolveVertical(request: NextRequest): "ca" | "neet" {
  const hostname = (request.headers.get("host") || request.nextUrl.hostname)
    .toLowerCase()
    .split(":")[0];
  const previewParam = request.nextUrl.searchParams.get("preview")?.toLowerCase();
  if (previewParam === "ca") return "ca";
  if (previewParam === "neet") return "neet";
  if (CA_HOSTS.has(hostname) || hostname.endsWith(".ca.prepzo.study")) return "ca";
  if (request.cookies.get(PREVIEW_COOKIE)?.value === "ca") return "ca";
  return "neet";
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const alreadyCaPrefixed = pathname === "/ca" || pathname.startsWith("/ca/");
  // For gating purposes, treat an already-/ca-prefixed path (a direct debug
  // hit, since real CA users never see /ca in the URL bar) the same as its
  // unprefixed equivalent, so public/private status doesn't depend on how
  // the request arrived at this pathname.
  const effectivePathname = alreadyCaPrefixed
    ? pathname === "/ca"
      ? "/"
      : pathname.slice(3)
    : pathname;

  const isPublicPath =
    PUBLIC_PATHS.some((p) => effectivePathname === p || effectivePathname.startsWith("/auth/")) ||
    PUBLIC_PREFIXES.some((p) => effectivePathname === p || effectivePathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/api/");
  const isAdminPath = ADMIN_PATHS.some((p) => effectivePathname.startsWith(p));

  // Resolved before the auth check (not just after) — an unauthenticated hit
  // on the real CA host/preview cookie must bounce to /ca/auth/login, not
  // /auth/login. alreadyCaPrefixed alone used to gate this, which only ever
  // caught a raw /ca/... debug URL — a real ca.prepzo.study visitor's
  // pathname arrives unprefixed (the /ca rewrite happens further below,
  // after this check), so every logged-out CA visitor landed on NEET's
  // login page instead of CA's.
  const vertical = resolveVertical(request);

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = alreadyCaPrefixed || vertical === "ca" ? "/ca/auth/login" : "/auth/login";
    url.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (user && isAdminPath) {
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());
    if (!adminEmails.includes(user.email || "")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  const skipRewrite = pathname.startsWith("/api/") || alreadyCaPrefixed;

  if (vertical === "ca" && !skipRewrite) {
    request.nextUrl.pathname = pathname === "/" ? "/ca" : `/ca${pathname}`;
    const rewriteResponse = NextResponse.rewrite(request.nextUrl);
    supabaseResponse.cookies.getAll().forEach((c) => rewriteResponse.cookies.set(c));
    if (request.nextUrl.searchParams.get("preview") === "ca") {
      rewriteResponse.cookies.set(PREVIEW_COOKIE, "ca", {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return rewriteResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
