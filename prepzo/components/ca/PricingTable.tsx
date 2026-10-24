"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  CA_PLANS,
  CA_PLAN_ORDER,
  formatPrice,
  quotaLabel,
  cycleSaving,
  cycleLabel,
  cycleSuffix,
  perMonth,
  priceFor,
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
  linkToPricing = false,
  needsTerms = false,
}: {
  signedIn?: boolean;
  currentPlan?: CaPlan;
  subscription?: ActiveSubscription | null;
  userEmail?: string;
  userName?: string;
  /** Landing page: paid buttons go to /pricing instead of opening checkout. */
  linkToPricing?: boolean;
  /** Terms are accepted at signup; only accounts with nothing on record are asked at checkout. */
  needsTerms?: boolean;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [checkoutPlan, setCheckoutPlan] = useState<CaPlan | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
        <div className="inline-flex flex-nowrap overflow-x-auto max-w-full justify-center rounded-xl border border-[#E2E8F0] bg-white p-1 gap-1 shadow-xs">
          {(["monthly", "quarterly", "half_yearly", "yearly"] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                cycle === c ? "bg-[#1E3A8A] text-white shadow-xs" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {cycleLabel(c)}
              {c === "quarterly" && <span className="ml-1 sm:ml-1.5 text-[11px] sm:text-xs font-medium opacity-80">save 11%</span>}
              {c === "half_yearly" && <span className="ml-1 sm:ml-1.5 text-[11px] sm:text-xs font-medium opacity-80">save 16%</span>}
              {c === "yearly" && <span className="ml-1 sm:ml-1.5 text-[11px] sm:text-xs font-medium opacity-80">save 22%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {CA_PLAN_ORDER.map((id) => {
          const plan = CA_PLANS[id];
          const isCurrent = currentPlan === id;
          const isFreePlan = plan.monthlyPrice === 0;
          const cyclePrice = priceFor(plan, cycle);
          const price = cyclePrice !== null ? cyclePrice : plan.monthlyPrice;
          const saving = cycleSaving(plan, cycle);
          const showCyclePrice = !isFreePlan && cyclePrice !== null;
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
                  {isFreePlan ? "" : cycleSuffix(cycle)}
                </span>
                {showCyclePrice && cycle !== "monthly" && (
                  <p className="mt-1 text-xs text-[#64748B]">
                    {formatPrice(perMonth(plan, cycle))}/month
                  </p>
                )}
                {showCyclePrice && saving !== null && (
                  <p className="mt-1 text-xs font-medium text-[#15803D]">Saves {formatPrice(saving)}</p>
                )}
                {cycle !== "monthly" && cyclePrice === null && isFreePlan && (
                  <p className="mt-1 text-xs text-[#64748B]">Always free</p>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-[#0F172A]">
                <Feature>
                  {id === "free"
                    ? `${quotaLabel(plan.quotas.uploads)} free uploads for the whole account`
                    : `${quotaLabel(plan.quotas.uploads)} document uploads a month`}
                </Feature>
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
                ) : linkToPricing ? (
                  <Link
                    href="/pricing"
                    className="flex w-full items-center justify-center rounded-xl bg-[#1E3A8A] py-3 text-sm font-semibold text-white transition-all hover:bg-[#162D6B]"
                  >
                    Get {plan.name}
                  </Link>
                ) : (
                  <button
                    onClick={() => setCheckoutPlan(id)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] py-3 text-sm font-semibold text-white transition-all hover:bg-[#162D6B]"
                  >
                    Get {plan.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {checkoutPlan && (
        <CheckoutDialog
          plan={checkoutPlan}
          cycle={cycle}
          needsTerms={needsTerms}
          userEmail={userEmail}
          userName={userName}
          onClose={() => setCheckoutPlan(null)}
          onPaid={() => {
            setCheckoutPlan(null);
            router.refresh();
          }}
        />
      )}

      <p className="mt-6 text-center text-xs text-[#64748B]">
        Prices in INR, inclusive of applicable taxes. Plans renew automatically each billing cycle until
        you cancel. You can cancel any time and keep your plan until the period you&apos;ve paid for ends.
      </p>
    </div>
  );
}

/**
 * The step between "Get Pro" and Razorpay: what you're buying, an optional
 * referral code (checked against the server so the total shown is the total
 * charged), and — only for accounts that never accepted at signup — the terms.
 */
function CheckoutDialog({
  plan,
  cycle,
  needsTerms,
  userEmail,
  userName,
  onClose,
  onPaid,
}: {
  plan: CaPlan;
  cycle: BillingCycle;
  needsTerms: boolean;
  userEmail?: string;
  userName?: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const definition = CA_PLANS[plan];
  const fullPrice = priceFor(definition, cycle) ?? definition.monthlyPrice;
  const [codeInput, setCodeInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; total: number } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  // Unticked by default. Pre-ticking it would not be acceptance of an
  // auto-renewing charge in any meaningful sense.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [paying, setPaying] = useState(false);

  async function applyCode() {
    setCheckingCode(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/ca/billing/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput, plan, cycle }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not check that code");
      setApplied({ code: codeInput, discount: json.discount_amount / 100, total: json.amount / 100 });
    } catch (error) {
      setApplied(null);
      setCodeError(error instanceof Error ? error.message : "Could not check that code");
    } finally {
      setCheckingCode(false);
    }
  }

  async function pay() {
    setPaying(true);
    try {
      await startCheckout({
        plan,
        cycle,
        acceptTerms: needsTerms ? acceptedTerms : undefined,
        userEmail,
        userName,
        referralCode: applied?.code,
      });
      toast.success(`You're on ${definition.name} now.`);
      onPaid();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      // Dismissing the Razorpay modal isn't an error worth shouting about.
      if (message === "Payment cancelled") toast(message);
      else toast.error(message);
    } finally {
      setPaying(false);
    }
  }

  const total = applied ? applied.total : fullPrice;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4"
      onClick={paying ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Checkout: ${definition.name}`}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[#0F172A]">{definition.name}</h3>
            <p className="text-xs text-[#64748B]">Billed {cycleLabel(cycle).toLowerCase()}</p>
          </div>
          <button onClick={onClose} disabled={paying} aria-label="Close" className="text-[#64748B] hover:text-[#0F172A]">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5">
          <label htmlFor="referral-code" className="mb-1 block text-sm font-medium text-[#334155]">
            Referral code <span className="font-normal text-[#64748B]">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              id="referral-code"
              value={codeInput}
              onChange={(event) => {
                setCodeInput(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5));
                setApplied(null);
                setCodeError(null);
              }}
              placeholder="3–5 letters"
              maxLength={5}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-[#CBD5E1] px-3 py-2.5 text-sm uppercase outline-none focus:border-[#1E3A8A]"
            />
            <button
              onClick={applyCode}
              disabled={codeInput.length < 3 || checkingCode || Boolean(applied)}
              className="rounded-xl border border-[#CBD5E1] px-4 text-sm font-semibold text-[#1E3A8A] disabled:opacity-50"
            >
              {checkingCode ? "Checking..." : applied ? "Applied" : "Apply"}
            </button>
          </div>
          {codeError && <p className="mt-1 text-xs text-[#DC2626]">{codeError}</p>}
        </div>

        <dl className="mt-5 space-y-1.5 border-t border-[#E2E8F0] pt-4 text-sm">
          <div className="flex justify-between text-[#475569]">
            <dt>{definition.name}, {cycleLabel(cycle)}</dt>
            <dd>{formatPrice(fullPrice)}</dd>
          </div>
          {applied && (
            <div className="flex justify-between text-[#15803D]">
              <dt>Referral {applied.code} (first payment only)</dt>
              <dd>−{formatPrice(applied.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between font-semibold text-[#0F172A]">
            <dt>Due today</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[#64748B]">
          Renews automatically at {formatPrice(fullPrice)}
          {cycleSuffix(cycle)} until you cancel. You can cancel any time from this page.
        </p>

        {needsTerms && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#E2E8F0] px-3 py-2.5">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#1E3A8A]"
            />
            <span className="text-xs leading-relaxed text-[#475569]">
              I accept the{" "}
              <Link href="/terms" target="_blank" className="font-semibold text-[#1E3A8A] underline">
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" target="_blank" className="font-semibold text-[#1E3A8A] underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        )}

        <button
          onClick={pay}
          disabled={paying || (needsTerms && !acceptedTerms)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] py-3 text-sm font-semibold text-white transition-all hover:bg-[#162D6B] disabled:opacity-50"
        >
          {paying && <Loader2 size={15} className="animate-spin" />}
          {paying ? "Opening payment..." : `Pay ${formatPrice(total)}`}
        </button>
      </div>
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
