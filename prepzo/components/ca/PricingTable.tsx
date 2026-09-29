"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  CA_PLANS,
  CA_PLAN_ORDER,
  formatPrice,
  quotaLabel,
  yearlySaving,
  type BillingCycle,
  type CaPlan,
} from "@/lib/ca/plans";
import { startCheckout } from "@/lib/ca/checkout";
import Link from "next/link";

/**
 * Every number here is read from lib/ca/plans.ts — the same module the server
 * enforces against, so the page physically cannot advertise a limit the code
 * won't honour.
 */
export interface ActiveSubscription {
  renewsOn: string | null;
  cancelRequested: boolean;
}

export function PricingTable({
  signedIn = true,
  currentPlan = "free",
  subscription,
  userEmail,
  userName,
}: {
  signedIn?: boolean;
  currentPlan?: CaPlan;
  subscription?: ActiveSubscription | null;
  userEmail?: string;
  userName?: string;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [busy, setBusy] = useState<CaPlan | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Unticked by default and required before checkout opens. Pre-ticking it
  // would not be acceptance of an auto-renewing charge in any meaningful
  // sense, and the server rejects the request without it regardless.
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function cancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/ca/billing/cancel", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not cancel");
      toast.success("Auto-renewal is off. You keep your plan until the period ends.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel");
    } finally {
      setCancelling(false);
    }
  }

  async function buy(plan: CaPlan) {
    if (!acceptedTerms) {
      toast.error("Please accept the Terms and Conditions and Privacy Policy first.");
      return;
    }
    setBusy(plan);
    try {
      await startCheckout({ plan, cycle, acceptTerms: acceptedTerms, userEmail, userName });
      toast.success(`You're on ${CA_PLANS[plan].name} now.`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      // Dismissing the Razorpay modal isn't an error worth shouting about.
      if (message === "Payment cancelled") toast(message);
      else toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  const renewalDate = subscription?.renewsOn
    ? new Date(subscription.renewsOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div>
      {subscription && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-sm text-[#0F172A]">
            {subscription.cancelRequested ? (
              <>
                Auto-renewal is <strong>off</strong>.
                {renewalDate ? ` Your plan stays active until ${renewalDate}, then moves to Free.` : ""}
              </>
            ) : (
              <>
                Your plan renews automatically{renewalDate ? ` on ${renewalDate}` : ""}.
              </>
            )}
          </p>
          {!subscription.cancelRequested && (
            <button
              onClick={cancel}
              disabled={cancelling}
              className="rounded-xl border border-[#CBD5E1] px-4 py-2 text-xs font-semibold text-[#475569] transition-all hover:border-[#DC2626] hover:text-[#DC2626] disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel auto-renewal"}
            </button>
          )}
        </div>
      )}

      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1">
          {(["monthly", "yearly"] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                cycle === c ? "bg-[#1E3A8A] text-white" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {c === "monthly" ? "Monthly" : "Yearly"}
              {c === "yearly" && <span className="ml-1.5 text-xs font-medium opacity-80">save 22%</span>}
            </button>
          ))}
        </div>
      </div>

      {signedIn && (
      <label className="mx-auto mb-6 flex max-w-2xl cursor-pointer items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1E3A8A]"
        />
        <span className="text-xs leading-relaxed text-[#475569]">
          I have read and accept the{" "}
          <Link href="/terms" target="_blank" className="font-semibold text-[#1E3A8A] underline">
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" target="_blank" className="font-semibold text-[#1E3A8A] underline">
            Privacy Policy
          </Link>
          . I understand my plan renews automatically until I cancel, that my account is for my
          personal use and cannot be shared, and that I may only upload study material I am
          permitted to use.
        </span>
      </label>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {CA_PLAN_ORDER.map((id) => {
          const plan = CA_PLANS[id];
          const isCurrent = currentPlan === id;
          const saving = yearlySaving(plan);
          const showYearly = cycle === "yearly" && plan.yearlyPrice !== null;
          const price = showYearly ? plan.yearlyPrice! : plan.monthlyPrice;
          const featured = id === "pro";

          return (
            <div
              key={id}
              className={`flex flex-col rounded-2xl border bg-white p-6 ${
                featured ? "border-[#1E3A8A] shadow-[var(--shadow-card)]" : "border-[#E2E8F0]"
              }`}
            >
              {featured && (
                <span className="mb-3 self-start rounded-full bg-[#DBEAFE] px-2.5 py-1 text-xs font-semibold text-[#1E3A8A]">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-[#0F172A]">{plan.name}</h3>
              <p className="mt-1 text-xs text-[#64748B]">{plan.tagline}</p>

              <div className="mt-4">
                <span className="text-3xl font-semibold text-[#0F172A]">{formatPrice(price)}</span>
                <span className="text-sm text-[#64748B]">
                  {plan.monthlyPrice === 0 ? "" : showYearly ? "/year" : "/month"}
                </span>
                {showYearly && saving !== null && (
                  <p className="mt-1 text-xs font-medium text-[#15803D]">Saves {formatPrice(saving)} a year</p>
                )}
                {cycle === "yearly" && plan.yearlyPrice === null && plan.monthlyPrice === 0 && (
                  <p className="mt-1 text-xs text-[#64748B]">Always free</p>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-[#0F172A]">
                <Feature>{quotaLabel(plan.quotas.uploads)} document uploads a month</Feature>
                <Feature>{plan.questionsPerUpload} questions per upload</Feature>
                <Feature>{plan.flashcardsPerUpload} flashcards per upload</Feature>
                <Feature>{quotaLabel(plan.quotas.tutor_messages)} AI Teacher messages a day</Feature>
                <Feature>
                  {quotaLabel(plan.quotas.cheatsheets)} cheatsheets a month
                  {plan.cheatsheetPdfDownload ? ", with PDF download" : ""}
                </Feature>
                <Feature>{quotaLabel(plan.quotas.mock_tests)} mock tests a month</Feature>
                <Feature>
                  {plan.historyAccess ? "Full study history and score trends" : "No study history"}
                </Feature>
              </ul>

              <div className="mt-6">
                {!signedIn ? (
                  <Link
                    href={`/auth/signup?plan=${id}`}
                    className="flex w-full items-center justify-center rounded-xl bg-[#1E3A8A] py-3 text-sm font-semibold text-white transition-all hover:bg-[#162D6B]"
                  >
                    {plan.monthlyPrice === 0 ? "Start free" : `Get ${plan.name}`}
                  </Link>
                ) : isCurrent ? (
                  <div className="rounded-xl border border-[#E2E8F0] py-3 text-center text-sm font-semibold text-[#64748B]">
                    Your current plan
                  </div>
                ) : plan.monthlyPrice === 0 ? (
                  <div className="rounded-xl border border-[#E2E8F0] py-3 text-center text-sm font-semibold text-[#64748B]">
                    Free forever
                  </div>
                ) : (
                  <button
                    onClick={() => buy(id)}
                    disabled={busy !== null || !acceptedTerms}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] py-3 text-sm font-semibold text-white transition-all hover:bg-[#162D6B] disabled:opacity-50"
                  >
                    {busy === id && <Loader2 size={15} className="animate-spin" />}
                    {busy === id ? "Opening checkout..." : `Get ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-[#64748B]">
        Prices in INR, inclusive of applicable taxes. Plans renew automatically each {cycle === "yearly" ? "year" : "month"} until
        you cancel. You can cancel any time and keep your plan until the period you&apos;ve paid for ends.
      </p>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={15} className="mt-0.5 shrink-0 text-[#15803D]" />
      <span>{children}</span>
    </li>
  );
}
