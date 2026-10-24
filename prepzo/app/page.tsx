"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, Check, FileText, MessageCircle, NotebookPen, PenLine, Plus, Sparkles } from "lucide-react";
import { PricingTable } from "@/components/ca/PricingTable";
import { Reveal } from "@/components/landing/Reveal";
import {
  CheatsheetSample,
  DescriptiveSample,
  HeroOutput,
  McqSample,
  RealPaperSample,
  RecallSample,
  TutorSample,
} from "@/components/landing/samples";
import { createClient } from "@/lib/supabase/client";
import { CA_SYLLABUS, formatLabel, type CaLevel } from "@/lib/ca-syllabus";
import type { CaPlan } from "@/lib/ca/plans";

/**
 * Landing page. Every claim here is something the product does today — see
 * the inventory behind components/landing/samples.tsx. There are deliberately
 * no testimonials, user counts, ratings, logos or outcome claims: add them
 * only when real ones exist. Paper formats are read from CA_SYLLABUS, the
 * same data question generation uses, so the page can't drift from the app.
 */

const display = "font-[family-name:var(--font-fraunces)]";
const mono = "font-[family-name:var(--font-dm-mono)]";

type TabKey = "mcq" | "descriptive" | "tutor" | "cheatsheet";

const TABS: { key: TabKey; label: string; icon: typeof PenLine }[] = [
  { key: "mcq", label: "MCQs", icon: Sparkles },
  { key: "descriptive", label: "Answer marking", icon: PenLine },
  { key: "tutor", label: "AI Teacher", icon: MessageCircle },
  { key: "cheatsheet", label: "Cheatsheets", icon: NotebookPen },
];

const HERO_CYCLE = ["descriptive", "mcq", "flashcard"] as const;

export default function CaLandingPage() {
  const [tab, setTab] = useState<TabKey>("mcq");
  const [level, setLevel] = useState<CaLevel>("Intermediate");
  const [heroStep, setHeroStep] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<CaPlan>("free");
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userName, setUserName] = useState<string | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("error")) {
      window.location.replace(`/auth/callback${window.location.search}`);
      return;
    }

    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.auth.getUser().then(({ data: { user } }: any) => {
        if (!user) return;
        setSignedIn(true);
        setUserEmail(user.email);
        supabase
          .from("profiles")
          .select("plan, full_name")
          .eq("id", user.id)
          .single()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then(({ data: profile }: any) => {
            if (profile?.plan) setCurrentPlan(profile.plan);
            if (profile?.full_name) setUserName(profile.full_name);
          });
      });
    } catch {
      // Signed-out visitor: nothing to load.
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cycle the hero's sample output, unless the visitor prefers less motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setHeroStep((s) => (s + 1) % HERO_CYCLE.length), 3200);
    return () => window.clearInterval(id);
  }, []);

  const syllabus = CA_SYLLABUS[level];

  return (
    <div className="lp min-h-screen">
      {/* Without JS the reveal observer never runs; don't leave sections invisible. */}
      <noscript>
        <style>{`.lp-reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      {/* NAV */}
      <header
        data-scrolled={scrolled}
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/80 shadow-[0_1px_0_#E2E8F0] backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className={`${display} text-2xl font-bold text-[#1E3A8A]`}>
            Prepzo CA
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {[
              ["How it works", "#how"],
              ["Features", "#features"],
              ["Pricing", "#pricing"],
              ["FAQ", "#faq"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-sm text-[#64748B] transition-colors hover:text-[#0F172A]">
                {label}
              </a>
            ))}
            <Link href="/auth/login" className="text-sm font-medium text-[#64748B] transition-colors hover:text-[#0F172A]">
              Log in
            </Link>
            <PrimaryLink href="/auth/signup" small>
              Start free
            </PrimaryLink>
          </nav>
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/auth/login" className="text-sm font-medium text-[#64748B]">
              Log in
            </Link>
            <PrimaryLink href="/auth/signup" small>
              Start free
            </PrimaryLink>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative -mt-16 overflow-hidden pt-28 pb-16 md:pt-32 md:pb-24">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10">
          <div className="text-center lg:col-span-7 lg:text-left">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#DBEAFE] px-3.5 py-1.5 text-xs font-medium text-[#1E3A8A]">
                <span aria-hidden>📚</span> For CA Foundation, Intermediate &amp; Final
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className={`${display} mt-6 text-balance text-[2.5rem] font-bold leading-[1.08] tracking-tight text-[#0F172A] sm:text-5xl lg:text-[3.6rem]`}>
                Turn your own CA notes into <span className="lp-marker">exam practice.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#475569] lg:mx-0">
                Upload a chapter as a PDF or a photo. Prepzo writes MCQs and descriptive questions
                from it in your paper&rsquo;s format, marks your written answers point by point, and
                brings back the ones you got wrong.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <ul className="mx-auto mt-6 flex max-w-xl flex-col items-center gap-2 text-sm text-[#334155] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-5 lg:mx-0 lg:justify-start">
                {["Free plan, no card needed", "Works with photos of notes", "Marks handwritten answers"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check size={15} strokeWidth={3} className="text-[#16A34A]" /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={280}>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <PrimaryLink href="/auth/signup">
                  Start free <ArrowRight size={17} />
                </PrimaryLink>
                <a
                  href="#demo"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-7 py-3.5 text-base font-semibold text-[#0F172A] transition-all hover:-translate-y-0.5 hover:border-[#CBD5E1] sm:w-auto"
                >
                  See what it makes <ArrowDown size={16} />
                </a>
              </div>
            </Reveal>
          </div>

          {/* File in → practice out */}
          <Reveal delay={200} className="relative mx-auto w-full max-w-md lg:col-span-5">
            <p className={`${display} absolute -top-9 right-2 hidden rotate-[-4deg] text-base italic text-[#1E3A8A] sm:block`}>
              one chapter in, practice out
              <DoodleArrow />
            </p>
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-3 shadow-[0_20px_50px_-12px_rgba(30,58,138,0.25)]">
              <div className="flex items-center gap-3 rounded-2xl bg-[#F8FAFF] px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#1E3A8A] ring-1 ring-[#E2E8F0]">
                  <FileText size={17} />
                </span>
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium text-[#0F172A]">Accounting — AS 2 Inventories.pdf</p>
                  <p className="text-[11px] text-[#94A3B8]">Split into topics &middot; matched to Advanced Accounting</p>
                </div>
              </div>

              <div className="relative mx-auto my-2 h-10 w-px border-l-2 border-dashed border-[#BFDBFE]" aria-hidden>
                <span className="lp-travel absolute -left-[5px] h-2 w-2 rounded-full bg-[#1E3A8A]" />
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] p-4 text-left">
                <div className="mb-3 flex gap-1.5" role="tablist" aria-label="Example output">
                  {HERO_CYCLE.map((k, i) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={heroStep === i}
                      onClick={() => setHeroStep(i)}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${heroStep === i ? "bg-[#1E3A8A]" : "bg-[#E2E8F0]"}`}
                    >
                      <span className="sr-only">{k}</span>
                    </button>
                  ))}
                </div>
                <div key={heroStep} className="lp-swap-in min-h-[190px]">
                  <HeroOutput kind={HERO_CYCLE[heroStep]} />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SOUND FAMILIAR */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionHead index="01" eyebrow="Sound familiar?" title="Reading isn’t the hard part. Practising is." />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PAINS.map((p, i) => (
              <Reveal key={p.index} delay={i * 90}>
                <div className="h-full rounded-2xl border border-[#E2E8F0] bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between">
                    <span className={`${mono} text-xs font-medium text-[#94A3B8]`}>{p.index}</span>
                    <span className="lp-wiggle inline-block text-2xl" aria-hidden>
                      {p.emoji}
                    </span>
                  </div>
                  <p className="mt-5 text-[15px] leading-relaxed text-[#334155]">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mt-10 text-center text-[15px] text-[#64748B]">
              Prepzo does the practice part. <span className="font-semibold text-[#0F172A]">You bring the notes.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* DEMO TABS */}
      <section id="demo" className="scroll-mt-20 border-y border-[#E2E8F0] bg-[#F8FAFF] py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <SectionHead
            index="02"
            eyebrow="See it work"
            title="One chapter, four ways to practise"
            sub="Examples of what Prepzo makes from a chapter on AS 2 Inventories."
          />
          <Reveal className="mt-10">
            <div className="mx-auto flex max-w-full justify-center overflow-x-auto">
              <div className="relative inline-flex gap-1 rounded-2xl border border-[#E2E8F0] bg-white p-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    aria-pressed={tab === t.key}
                    className={`relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-4 ${
                      tab === t.key
                        ? "bg-[#1E3A8A] text-white shadow-[0_6px_16px_-6px_rgba(30,58,138,0.6)]"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    <t.icon size={15} className="hidden sm:block" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-[0_20px_50px_-20px_rgba(30,58,138,0.25)] sm:p-8">
              <div key={tab} className="lp-swap-in">
                {tab === "mcq" && <McqSample />}
                {tab === "descriptive" && <DescriptiveSample />}
                {tab === "tutor" && <TutorSample />}
                {tab === "cheatsheet" && <CheatsheetSample />}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-20 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead index="03" eyebrow="How it works" title="From notes to practice in three steps" />
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 90}>
                <div className="relative h-full rounded-2xl border border-[#E2E8F0] bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#DBEAFE] text-xl" aria-hidden>
                      {s.emoji}
                    </span>
                    <span className={`${mono} text-xs font-medium text-[#94A3B8]`}>Step {i + 1}</span>
                  </div>
                  <h3 className={`${display} mt-5 text-xl font-bold leading-snug text-[#0F172A]`}>{s.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#64748B]">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-20 pb-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead index="04" eyebrow="What you get" title="Built for how CA papers are actually written" />
        </div>
        {FEATURES.map((f, i) => (
          <FeatureRow key={f.eyebrow} {...f} reverse={i % 2 === 1} />
        ))}
      </section>

      {/* COVERAGE */}
      <section className="border-y border-[#E2E8F0] bg-[#F8FAFF] py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionHead
            index="05"
            eyebrow="Every level, every paper"
            title="Questions follow your paper’s format"
            sub="Foundation objective papers get four-option MCQs with −0.25 negative marking. Inter and Final questions follow the 70% descriptive, 30% MCQ split."
          />
          <Reveal className="mt-10">
            <div className="flex justify-center">
              <div className="inline-flex gap-1 rounded-2xl border border-[#E2E8F0] bg-white p-1">
                {(Object.keys(CA_SYLLABUS) as CaLevel[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    aria-pressed={level === l}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all sm:px-5 ${
                      level === l ? "bg-[#1E3A8A] text-white" : "text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    {l === "Intermediate" ? "Inter" : l}
                  </button>
                ))}
              </div>
            </div>
            <div key={level} className="lp-swap-in mt-6 rounded-3xl border border-[#E2E8F0] bg-white p-5 sm:p-8">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#F1F5F9] pb-4">
                <h3 className={`${display} text-2xl font-bold text-[#0F172A]`}>CA {level}</h3>
                <span className={`${mono} text-xs text-[#64748B]`}>
                  {syllabus.papers.length} papers &middot; {syllabus.totalMarks} marks
                  {syllabus.groups ? " · 2 groups" : ""}
                </span>
              </div>
              <div className={syllabus.groups ? "grid gap-5 md:grid-cols-2" : ""}>
                {(syllabus.groups ?? [{ name: null, papers: syllabus.papers }]).map((g) => (
                  <div key={g.name ?? "all"}>
                    {g.name && <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#1E3A8A]">{g.name}</p>}
                    <ul className={`grid gap-2.5 ${syllabus.groups ? "" : "sm:grid-cols-2"}`}>
                      {g.papers.map((p) => (
                        <li
                          key={p.code}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] px-3.5 py-3 text-sm"
                        >
                          <span className="min-w-0">
                            <span className={`${mono} mr-2 text-[11px] text-[#94A3B8]`}>{p.code}</span>
                            <span className="font-medium text-[#0F172A]">{p.name}</span>
                          </span>
                          <span className="shrink-0 rounded-md bg-[#F1F5F9] px-2 py-1 text-[10px] font-semibold text-[#64748B]">
                            {formatLabel(p)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* GOOD TO KNOW */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionHead index="06" eyebrow="Good to know" title="What Prepzo is, and what it isn’t" />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {NOTES.map((n, i) => (
              <Reveal key={n.title} delay={i * 90}>
                <div
                  className={`h-full rounded-2xl border p-6 transition-transform duration-200 hover:rotate-0 ${n.tone} ${
                    i === 1 ? "md:rotate-[1deg]" : "md:-rotate-[1deg]"
                  }`}
                >
                  <span className="text-2xl" aria-hidden>
                    {n.emoji}
                  </span>
                  <h3 className="mt-3 font-semibold text-[#0F172A]">{n.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">{n.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="scroll-mt-20 border-t border-[#E2E8F0] py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionHead
            index="07"
            eyebrow="Pricing"
            title="Start free. Upgrade when you need more."
            sub="Try every core tool on the free plan, no card needed. Paid plans raise the limits and add study history, PDF cheatsheets and review ordering."
          />
          <div className="mt-10">
            <PricingTable
              signedIn={signedIn}
              currentPlan={currentPlan}
              userEmail={userEmail}
              userName={userName}
              linkToPricing
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-[#E2E8F0] bg-[#F8FAFF] py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHead index="08" eyebrow="FAQ" title="Questions you might have" />
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-[#64748B]">
            Something else?{" "}
            <a href="mailto:support@prepzo.study" className="font-semibold text-[#1E3A8A] underline-offset-2 hover:underline">
              support@prepzo.study
            </a>
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 md:py-28">
        <Reveal className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-[#1E3A8A] px-6 py-14 text-center sm:px-12">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle,#ffffff_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative">
              <span className="text-3xl" aria-hidden>
                ✍️
              </span>
              <h2 className={`${display} mt-4 text-3xl font-bold leading-tight text-white md:text-4xl`}>
                Start with the chapter you&rsquo;ve been avoiding.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[#DBEAFE]">
                Upload it, make ten questions, and see where you&rsquo;d lose marks. Free, and no card
                needed.
              </p>
              <Link
                href="/auth/signup"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#1E3A8A] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.98]"
              >
                Start free <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#E2E8F0] py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 text-center sm:px-6 md:flex-row md:justify-between md:text-left">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span className={`${display} text-xl font-bold text-[#1E3A8A]`}>Prepzo CA</span>
            <p className="max-w-xs text-sm leading-relaxed text-[#64748B]">
              Practice from your own notes, for CA Foundation, Intermediate and Final.
            </p>
            <p className="max-w-xs text-xs leading-5 text-[#94A3B8]">
              An independent study tool, not affiliated with ICAI.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <FooterCol title="Product" links={[["How it works", "#how"], ["Pricing", "/pricing"], ["FAQ", "#faq"]]} />
            <FooterCol title="Account" links={[["Log in", "/auth/login"], ["Sign up", "/auth/signup"]]} />
            <FooterCol title="Legal" links={[["Terms", "/terms"], ["Privacy Policy", "/privacy-policy"]]} />
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-[#E2E8F0] px-4 pt-6 sm:flex-row sm:px-6">
          <p className="text-xs text-[#94A3B8]">
            © {new Date().getFullYear()} Prepzo &middot; Made in Hyderabad for CA students{" "}
            <span aria-hidden>📚</span>
          </p>
          <div className="flex items-center gap-2">
            <a href="mailto:support@prepzo.study" className="mr-2 text-xs text-[#64748B] hover:text-[#0F172A]">
              support@prepzo.study
            </a>
            <SocialLink href="https://www.linkedin.com/company/131964161/" label="Prepzo on LinkedIn">
              <LinkedInIcon />
            </SocialLink>
            <SocialLink href="https://www.instagram.com/prepzo.study?igsh=eXpzNnAxazZva3ds" label="Prepzo on Instagram">
              <InstagramIcon />
            </SocialLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Building blocks ─────────────────────────────────────────── */

function PrimaryLink({ href, children, small }: { href: string; children: React.ReactNode; small?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(30,58,138,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#162D6B] active:translate-y-0 active:scale-[0.98] ${
        small ? "px-4 py-2 text-sm" : "w-full px-7 py-3.5 text-base sm:w-auto"
      }`}
    >
      {children}
    </Link>
  );
}

function SectionHead({ index, eyebrow, title, sub }: { index: string; eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className={`${mono} text-xs font-medium uppercase tracking-[0.14em] text-[#1E3A8A]`}>
        {index} / {eyebrow}
      </p>
      <h2 className={`${display} mt-3 text-balance text-3xl font-bold leading-tight tracking-tight text-[#0F172A] md:text-4xl`}>{title}</h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-[#64748B]">{sub}</p>}
    </Reveal>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  note,
  sample,
  reverse,
}: {
  eyebrow: string;
  title: string;
  body: string;
  note?: string;
  sample: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="py-10 md:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className={`flex flex-col items-center gap-10 md:gap-14 ${reverse ? "md:flex-row-reverse" : "md:flex-row"}`}>
          <Reveal className="flex-1 text-center md:text-left">
            <span className="inline-block rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-semibold text-[#1E3A8A]">{eyebrow}</span>
            <h3 className={`${display} mt-4 text-balance text-2xl font-bold leading-tight text-[#0F172A] md:text-3xl`}>{title}</h3>
            <p className="mt-4 leading-relaxed text-[#64748B]">{body}</p>
            {note && (
              <p className="mt-5 inline-flex items-start gap-2 rounded-xl bg-[#FEF3C7] px-3.5 py-2.5 text-left text-xs leading-relaxed text-[#78350F]">
                <span aria-hidden>💡</span>
                {note}
              </p>
            )}
          </Reveal>
          <Reveal delay={120} className="w-full min-w-0 flex-1">
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-[0_20px_50px_-24px_rgba(30,58,138,0.3)] transition-transform duration-300 hover:-translate-y-1 sm:p-6">
              {sample}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold text-[#0F172A]">{q}</span>
        <Plus size={18} className={`shrink-0 text-[#1E3A8A] transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed text-[#475569]">{a}</p>
        </div>
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col items-center gap-2 md:items-start">
      <p className="mb-1 font-semibold text-[#0F172A]">{title}</p>
      {links.map(([label, href]) => (
        <Link key={label} href={href} className="text-[#64748B] transition-colors hover:text-[#0F172A]">
          {label}
        </Link>
      ))}
    </div>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-[#E2E8F0] text-[#64748B] transition-colors hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
    >
      {children}
    </a>
  );
}

function DoodleArrow() {
  return (
    <svg aria-hidden viewBox="0 0 80 50" className="absolute -bottom-9 left-2 h-10 w-16 text-[#1E3A8A]" fill="none">
      <path d="M70 4 C 55 6, 30 10, 22 38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 30 L 22 40 L 30 31" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M6.94 8.98H3.56v10.78h3.38V8.98ZM5.25 4.24a1.96 1.96 0 1 0 0 3.92 1.96 1.96 0 0 0 0-3.92Zm14.5 9.34c0-3.25-1.73-4.76-4.04-4.76a3.49 3.49 0 0 0-3.15 1.73h-.05V8.98H9.27v10.78h3.37v-5.33c0-1.41.27-2.77 2.01-2.77 1.72 0 1.74 1.61 1.74 2.86v5.24h3.36v-6.18Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M7.7 2h8.6A5.7 5.7 0 0 1 22 7.7v8.6a5.7 5.7 0 0 1-5.7 5.7H7.7A5.7 5.7 0 0 1 2 16.3V7.7A5.7 5.7 0 0 1 7.7 2Zm0 2A3.7 3.7 0 0 0 4 7.7v8.6A3.7 3.7 0 0 0 7.7 20h8.6a3.7 3.7 0 0 0 3.7-3.7V7.7A3.7 3.7 0 0 0 16.3 4H7.7Zm4.3 3.25A4.75 4.75 0 1 1 12 16.75a4.75 4.75 0 0 1 0-9.5Zm0 2A2.75 2.75 0 1 0 12 14.75a2.75 2.75 0 0 0 0-5.5Zm5.05-2.45a1.11 1.11 0 1 1 0 2.22 1.11 1.11 0 0 1 0-2.22Z" />
    </svg>
  );
}

/* ── Content ─────────────────────────────────────────────────── */

const PAINS = [
  {
    index: "01",
    emoji: "🫠",
    text: "You’ve read the chapter three times, and you still couldn’t say whether you’d score on it.",
  },
  {
    index: "02",
    emoji: "😮‍💨",
    text: "Making your own question bank takes longer than studying the chapter did.",
  },
  {
    index: "03",
    emoji: "🤷",
    text: "You write out descriptive answers, but nobody tells you which points would have earned the marks.",
  },
];

const STEPS = [
  {
    emoji: "📤",
    title: "Upload a chapter",
    body: "A PDF, or photos of your notes, up to 10 MB. Prepzo splits it into topics and matches each one to its paper.",
  },
  {
    emoji: "🎯",
    title: "Choose what to make",
    body: "Pick the topics and how many questions or flashcards you want. They come out in your paper’s format, with explanations and model answers.",
  },
  {
    emoji: "✍️",
    title: "Practise and get marked",
    body: "Answer MCQs, write descriptive answers (typed or photographed), and see exactly where the marks went.",
  },
];

const FEATURES = [
  {
    eyebrow: "Answer marking",
    title: "Write it like the exam hall. Get it marked point by point.",
    body: "Type your answer, or photograph your handwritten sheets — up to six pages. Prepzo reads them, compares your answer with a model answer and its mark allocation, and shows what earned marks, what you missed, and how to present it better.",
    note: "Marks are an AI estimate to guide your practice, not an examiner’s verdict.",
    sample: <DescriptiveSample compact />,
  },
  {
    eyebrow: "Past & mock papers",
    title: "Practise on the real paper, not a lookalike.",
    body: "Upload a past or mock paper you already have. Prepzo copies the questions word for word — tables and sub-parts included — and keeps each case-study passage attached to every question that depends on it. Then attempt it as a mock test, with negative marking where the paper has it.",
    note: "Prepzo doesn’t ship with question papers. You upload your own.",
    sample: <RealPaperSample />,
  },
  {
    eyebrow: "AI Teacher",
    title: "Ask doubts about your notes, not the whole internet.",
    body: "The AI Teacher reads what you uploaded and answers from it first. Keep a separate chat for each upload, or one general chat across everything you’ve added.",
    sample: <TutorSample />,
  },
  {
    eyebrow: "Revision order",
    title: "Wrong answers come back. Right ones wait their turn.",
    body: "On Pro and Premium, practice sessions are ordered for you. A question you got wrong returns within a day; one you got right comes back after a gap. Flashcards work the same way, and you choose how often you review.",
    sample: <RecallSample />,
  },
];

const NOTES = [
  {
    emoji: "🤖",
    title: "AI can be wrong",
    body: "Questions, model answers and marks are generated by AI. Check anything important against ICAI material, especially amounts, rates and section numbers.",
    tone: "border-[#FDE68A] bg-[#FFFBEB]",
  },
  {
    emoji: "🔒",
    title: "Your uploads stay yours",
    body: "Other students can’t see your files, answers or scores. Delete any upload, or your whole account, whenever you like.",
    tone: "border-[#BFDBFE] bg-[#F8FAFF]",
  },
  {
    emoji: "🏛️",
    title: "Not affiliated with ICAI",
    body: "Prepzo is an independent study tool. It works from the material you give it and doesn’t come with ICAI study material or papers.",
    tone: "border-[#E2E8F0] bg-white",
  },
];

const FAQS = [
  {
    q: "What exactly does Prepzo do?",
    a: "You upload your CA study notes or a question paper. Prepzo turns notes into MCQs, descriptive questions, flashcards and cheatsheets; turns papers into mock tests; marks your written answers; and has an AI Teacher you can ask about your notes.",
  },
  {
    q: "What can I upload?",
    a: "PDFs and images (JPG, PNG or WEBP) up to 10 MB each — typed notes, handwritten notes, or a past or mock paper you have. Word files aren’t supported yet, so save them as PDF first.",
  },
  {
    q: "Does it come with ICAI past papers or study material?",
    a: "No. Prepzo works only from what you upload. If you have a past or mock paper, upload it and Prepzo turns it into a mock test.",
  },
  {
    q: "Can I write answers by hand?",
    a: "Yes. Photograph up to six pages of a handwritten answer. Prepzo reads your writing first, and if any part is blurry or unclear it shows you what it read so you can correct it before marking.",
  },
  {
    q: "How accurate is the marking?",
    a: "It’s an estimate. Your answer is compared with a model answer and its mark allocation, and both are AI-generated unless your uploaded paper included solutions. Use the feedback to see what to fix, not as a prediction of your exam result.",
  },
  {
    q: "Is the free plan really free?",
    a: "Yes, and you don’t need a card to sign up. It lets you try uploads, questions, flashcards, answer marking, a mock test and the AI Teacher, with small limits. Study history, PDF cheatsheets and review ordering come with Pro and Premium. The pricing table above shows the exact limits.",
  },
  {
    q: "Who can see my notes?",
    a: "Only you. Other students can’t see your files, answers or scores. To generate content, your uploads are processed by Google’s Gemini AI.",
  },
  {
    q: "How do paid plans renew and cancel?",
    a: "Paid plans renew automatically each billing cycle until you cancel. You can cancel from the pricing page at any time and keep your plan until the end of the period you’ve paid for.",
  },
  {
    q: "Which languages does it support?",
    a: "English only, for now.",
  },
];
