import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { ReferralForm } from "@/components/public/ReferralForm";

export const metadata: Metadata = {
  title: "Prepzo Referral Program",
  description:
    "Join Prepzo's referral interest list. Refer friends, earn rewards, and hear from the Prepzo team.",
  alternates: {
    canonical: "/referral",
  },
  openGraph: {
    title: "Prepzo Referral Program",
    description: "Refer friends, earn rewards, and join the Prepzo referral interest list.",
    url: "/referral",
    type: "website",
  },
};

export default function ReferralPage() {
  return (
    <main className="referral-shell min-h-[calc(100vh-65px)] bg-white px-4 py-12 text-[#0F172A] dark:bg-[#0F172A] dark:text-white sm:px-6 md:py-20">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-10 lg:grid-cols-[0.82fr_1.18fr]">
        <section className="pt-4 text-left md:pt-8 lg:pt-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#DBEAFE] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[#1E3A8A] dark:bg-[#172554] dark:text-[#BFDBFE]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1E3A8A] dark:bg-[#BFDBFE]" />
            Prepzo referrals
          </div>

          <h1 className="max-w-xl font-[family-name:var(--font-fraunces)] text-[2.45rem] font-bold leading-[1.08] tracking-normal text-[#0F172A] dark:text-white sm:text-5xl">
            Refer friends. <span className="text-[#1E3A8A] dark:text-[#93C5FD]">Earn rewards.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-8 text-[#334155] dark:text-[#CBD5E1]">
            Join the interest list for Prepzo&apos;s referral program. Share Prepzo with NEET students,
            and we will reach out to you to share further details.
          </p>

          <a
            href="mailto:collab@prepzo.study"
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#E2E8F0] px-4 text-sm font-semibold text-[#64748B] transition-colors hover:border-[#1E3A8A] hover:text-[#1E3A8A] dark:border-[#334155] dark:text-[#CBD5E1] dark:hover:border-[#93C5FD] dark:hover:text-[#BFDBFE]"
          >
            <Mail size={16} />
            collab@prepzo.study
          </a>
        </section>

        <section className="rounded-[14px] border border-[#E2E8F0] bg-white p-6 text-left shadow-[0_14px_44px_rgba(30,58,138,0.10)] dark:border-[#334155] dark:bg-[#162033] sm:p-9">
        <div className="mb-7">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A] dark:text-white">
            Referral signup
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#64748B] dark:text-[#CBD5E1]">
            Tell us who you are and where you can promote Prepzo. We will reach out to you to share further details.
          </p>
        </div>

        <ReferralForm />
      </section>
      </div>
    </main>
  );
}
