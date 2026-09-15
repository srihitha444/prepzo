import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths reachable without a session. Everything under /auth/ is public too
// (handled below) — a logged-out visitor has to be able to reach login,
// signup, password reset and the OAuth/email callbacks.
// robots.txt and sitemap.xml are in here because the matcher below runs on
// them: without an entry a crawler hitting either gets bounced to /auth/login
// and never sees the file at all.
// www.prepzo.study is the only canonical host. The CA app used to live on
// ca.prepzo.study and the apex has always redirected in DNS; both are folded
// in here so a single deploy retires the subdomain without needing the domain
// detached in the Vercel dashboard. Deliberately an allowlist of real hosts
// rather than "anything that isn't canonical" — preview *.vercel.app URLs and
// localhost must keep serving normally, or every preview build would bounce
// to production and become untestable.
const CANONICAL_HOST = "www.prepzo.study";
const REDIRECT_HOSTS = new Set([
  "ca.prepzo.study",
  "www.ca.prepzo.study",
  "prepzo.study",
]);

const PUBLIC_PATHS = [
  "/",
  "/terms",
  "/privacy-policy",
  "/robots.txt",
  "/sitemap.xml",
];

export async function proxy(request: NextRequest) {
  // Before any session work: a redirected host never needs its cookies
  // refreshed, and a 308 keeps the method and body intact for anything
  // POSTing to an old URL.
  const host = (request.headers.get("host") || request.nextUrl.host).toLowerCase().split(":")[0];
  if (REDIRECT_HOSTS.has(host)) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(target, 308);
  }

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

  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/");

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
