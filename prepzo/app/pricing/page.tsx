
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PricingTable } from "@/components/ca/PricingTable";
import { resolvePlan } from "@/lib/ca/usage";

export const metadata = {
  title: "Plans & Pricing | Prepzo",
  description: "Upgrade your Prepzo CA plan for more uploads, questions, flashcards and AI Teacher messages.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Deliberately viewable signed out: this is linked from the landing page,
  // and bouncing a prospective student to a login form before they can see
  // what anything costs loses them. Checkout still requires an account —
  // create-subscription rejects an unauthenticated request.

  // resolvePlan rather than reading profiles.plan: it also expires a lapsed
  // subscription, so someone landing here to renew sees Free instead of the
  // plan they no longer have.
  const service = await createServiceClient();
  const plan = user ? await resolvePlan(service, user.id) : null;

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null as { full_name: string | null } | null };

  // Only surface the management strip for a plan that actually renews.
  const { data: sub } =
    !user || plan?.id === "free"
      ? { data: null }
      : await service
          .from("ca_subscriptions")
          .select("current_period_end, cancel_requested_at")
          .eq("user_id", user.id)
          .in("status", ["active", "halted"])
          .order("current_period_end", { ascending: false })
          .limit(1)
          .maybeSingle();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-center text-2xl font-semibold text-[#0F172A]">Plans &amp; Pricing</h1>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-[#64748B]">
        Every plan works on your own notes — upload, generate questions and flashcards, and study them on a spaced
        schedule. Paid plans raise the limits.
      </p>

      <div className="mt-10">
        <PricingTable
          signedIn={Boolean(user)}
          currentPlan={plan?.id}
          subscription={sub ? { renewsOn: sub.current_period_end, cancelRequested: Boolean(sub.cancel_requested_at) } : null}
          userEmail={user?.email}
          userName={profile?.full_name ?? undefined}
        />
      </div>
    </div>
  );
}
