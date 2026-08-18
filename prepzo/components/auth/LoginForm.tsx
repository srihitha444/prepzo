"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface LoginFormProps {
  brandName?: string;
  tagline?: string;
}

function LoginFormContent({
  brandName = "Prepzo",
  tagline = "Welcome back! Sign in to continue.",
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const authError = searchParams.get("error");
  const authMessage = searchParams.get("message");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  // Prefer the actual page origin over the static env var: this app now
  // serves multiple hosts (prepzo.study, ca.prepzo.study, and their
  // localhost equivalents), and the OAuth/email redirect must land back on
  // whichever origin initiated the flow, or the PKCE verifier stored in
  // that origin's browser storage won't be found on callback.
  const appUrl =
    (typeof window !== "undefined" ? window.location.origin : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const isCaVertical = (() => {
    if (typeof window === "undefined") return false;
    const hostname = window.location.hostname.toLowerCase();
    const preview = new URLSearchParams(window.location.search).get("preview")?.toLowerCase();
    return (
      preview === "ca" ||
      hostname === "ca.prepzo.study" ||
      hostname === "www.ca.prepzo.study" ||
      hostname.endsWith(".ca.prepzo.study") ||
      hostname === "ca.localhost" ||
      hostname === "www.ca.localhost"
    );
  })();
  const callbackPath = isCaVertical ? "/ca/auth/callback" : "/auth/callback";
  const signupPath = isCaVertical ? "/ca/auth/signup" : "/auth/signup";
  const resetPasswordPath = isCaVertical ? "/ca/auth/reset-password" : "/auth/reset-password";

  useEffect(() => {
    if (authError === "auth_callback_failed") {
      toast.error(authMessage || "Sign-in callback failed. Check Supabase Auth redirect URLs.");
    }
  }, [authError, authMessage]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const supabase = createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const user = signInData.user;
    if (user) {
      await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        }, { onConflict: "id" });
    }

    const { data: profileRaw } = await supabase
      .from("profiles")
      .select("exam")
      .single();
    const profile = profileRaw as { exam: string | null } | null;
    if (!profile?.exam) {
      router.push(isCaVertical ? "/ca/onboarding" : "/onboarding");
    } else {
      router.push(redirectTo || "/dashboard");
    }
    router.refresh();
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setForgotLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}${callbackPath}?next=${encodeURIComponent(resetPasswordPath)}`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForgotSent(true);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        flowType: "pkce",
        redirectTo: `${appUrl}${callbackPath}?next=${encodeURIComponent(redirectTo || "/dashboard")}`,
      },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="font-[family-name:var(--font-fraunces)] text-3xl font-bold text-[#1E3A8A]">
              {brandName}
            </span>
          </Link>
          <p className="text-[#64748B] mt-2 text-sm">{tagline}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[14px] shadow-[var(--shadow-card)] p-8 border border-[#E2E8F0]">
          {authError === "auth_callback_failed" && (
            <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#991B1B]">
              <p className="font-semibold">Sign-in callback failed</p>
              <p className="mt-1 text-xs leading-5">
                {authMessage || `Add ${appUrl}${callbackPath} to Supabase Auth redirect URLs, then retry.`}
              </p>
            </div>
          )}

          {mode === "forgot" ? (
            forgotSent ? (
              <div className="text-center">
                <p className="text-sm text-[#0F172A]">
                  If an account exists for <span className="font-semibold">{email}</span>, a password reset link is on its way.
                </p>
                <button
                  onClick={() => {
                    setMode("login");
                    setForgotSent(false);
                  }}
                  className="mt-4 text-sm font-semibold text-[#1E3A8A] hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-[#64748B]">
                  Enter your account email and we&apos;ll send you a link to reset your password.
                </p>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold text-sm transition-all disabled:opacity-60 active:scale-[0.98] min-h-[44px]"
                >
                  {forgotLoading ? "Sending..." : "Send reset link"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full text-center text-sm font-semibold text-[#1E3A8A] hover:underline"
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : (
            <>
              {/* Google */}
              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFF] text-[#0F172A] font-medium text-sm transition-all disabled:opacity-60"
              >
                <GoogleIcon />
                {googleLoading ? "Signing in..." : "Continue with Google"}
              </button>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-xs text-[#64748B]">or</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] transition-all"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-medium text-[#0F172A]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-semibold text-[#1E3A8A] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white font-semibold text-sm transition-all disabled:opacity-60 active:scale-[0.98] min-h-[44px]"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-[#64748B] mt-6">
          Don&apos;t have an account?{" "}
          <Link href={signupPath} className="text-[#1E3A8A] font-semibold hover:underline">
            Sign up free
          </Link>
        </p>
        <p className="text-center text-xs text-[#64748B] mt-4">
          By signing in, you agree to our <Link href="/terms" className="text-[#1E3A8A] font-semibold hover:underline">Terms</Link> and <Link href="/privacy-policy" className="text-[#1E3A8A] font-semibold hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

export function LoginForm(props: LoginFormProps) {
  return (
    <Suspense fallback={null}>
      <LoginFormContent {...props} />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}
