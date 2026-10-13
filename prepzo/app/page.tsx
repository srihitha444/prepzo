"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Layers,
  MessageCircle,
  NotebookPen,
  PenLine,
  Repeat2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { PricingTable } from "@/components/ca/PricingTable";
import { createClient } from "@/lib/supabase/client";
import type { CaPlan } from "@/lib/ca/plans";

/**
 * Every sample rendered on this page is a faithful mock-up of output the
 * product genuinely produces, in the shape it genuinely produces it — the
 * grading sample mirrors AnswerEvaluation's marks/what_was_correct/
 * what_was_missed, the MCQs are real four-option questions with negative
 * marking. It is product demonstration, not social proof: there are
 * deliberately no user counts, testimonials, ratings or outcome claims
 * anywhere here, and none should be added until real data backs them.
 */

type TabKey = "descriptive" | "practice" | "tutor" | "cheatsheet";

const TABS: { key: TabKey; label: string; icon: typeof PenLine }[] = [
  { key: "descriptive", label: "Descriptive Grading", icon: PenLine },
  { key: "practice", label: "Exam MCQs", icon: Sparkles },
  { key: "tutor", label: "AI Tutor", icon: MessageCircle },
  { key: "cheatsheet", label: "Quick Cheatsheets", icon: NotebookPen },
];

export default function CaLandingPage() {
  const [tab, setTab] = useState<TabKey>("descriptive");
  const [activeLevel, setActiveLevel] = useState<string>("Intermediate");
  const [signedIn, setSignedIn] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<CaPlan>("free");
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userName, setUserName] = useState<string | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("error")) {
      const callbackUrl = `/auth/callback${window.location.search}`;
      window.location.replace(callbackUrl);
      return;
    }

    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }: any) => {
        if (user) {
          setSignedIn(true);
          setUserEmail(user.email);
          supabase
            .from("profiles")
            .select("plan, full_name")
            .eq("id", user.id)
            .single()
            .then(({ data: profile }: any) => {
              if (profile?.plan) setCurrentPlan(profile.plan);
              if (profile?.full_name) setUserName(profile.full_name);
            });
        }
      });
    } catch {
      // Unauthenticated visitor fallback
    }
  }, []);

  return (
    <div className="landing-page min-h-screen bg-white text-[#0F172A]">
      {/* NAV */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#1E3A8A]">
            Prepzo CA
          </span>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              How it works
            </a>
            <a href="#features" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              Pricing
            </a>
            <Link href="/auth/login" className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
              Login
            </Link>
            <Link href="/auth/signup" className="px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-sm font-semibold transition-all">
              Start free
            </Link>
          </nav>
          <Link href="/auth/signup" className="md:hidden px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold">
            Start free
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden pt-14 pb-16 md:pt-20 md:pb-24">
        <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/80 to-white pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">

            <div className="landing-hero-copy flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#DBEAFE] border border-[#BFDBFE] text-[#1E3A8A] text-xs font-medium mb-7">
                <span>✨</span>
                Built for CA Foundation, Intermediate and Final
              </div>
              <h1 className="font-[family-name:var(--font-fraunces)] text-4xl sm:text-5xl lg:text-6xl font-bold text-[#0F172A] leading-[1.1] mb-5">
                Your notes are already your syllabus.
                <span className="text-[#1E3A8A]"> Now they&apos;re your question bank.</span>
              </h1>
              <p className="text-lg text-[#64748B] max-w-lg mx-auto md:mx-0 mb-9 leading-relaxed">
                Skip hours of manually building flashcards and question sets. Upload your CA notes
                to generate exam-standard MCQs, step-by-step descriptive questions, and revision
                cheatsheets in minutes.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                <Link href="/auth/signup" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-base font-semibold transition-all shadow-lg shadow-[#1E3A8A]/30">
                  Start free
                </Link>
                <a href="#how" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white hover:bg-[#F8FAFF] border border-[#E2E8F0] text-[#0F172A] text-base font-semibold transition-all flex items-center justify-center gap-2">
                  See how it works <ChevronRight size={16} />
                </a>
              </div>
            </div>

            {/* The transformation, shown rather than described */}
            <div className="flex-shrink-0 w-full md:w-[420px]">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-[0_8px_40px_rgba(30,58,138,0.12)]">
                <div className="flex items-center gap-3 rounded-xl bg-[#F8FAFF] px-4 py-3">
                  <FileText size={18} className="shrink-0 text-[#1E3A8A]" />
                  <span className="truncate text-sm font-medium text-[#0F172A]">
                    Accounting — AS 2 Inventories.pdf
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-[#94A3B8]">
                  <div className="h-px w-10 bg-[#E2E8F0]" />
                  <Sparkles size={13} className="text-[#1E3A8A]" />
                  generated
                  <div className="h-px w-10 bg-[#E2E8F0]" />
                </div>

                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2 mb-2.5">
                    <span className="inline-flex items-center gap-1 rounded bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-semibold text-[#1E3A8A]">
                      Subject: Accounting · Auto-Generated
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      2 marks · −0.25
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-[#0F172A]">
                    As per AS 2, inventories are valued at:
                  </p>
                  <div className="mt-3 space-y-2">
                    {HERO_OPTIONS.map((o) => (
                      <div
                        key={o.k}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${
                          o.ok
                            ? "border-[#16A34A] bg-[#16A34A]/5 font-semibold text-[#15803D]"
                            : "border-[#E2E8F0] text-[#64748B]"
                        }`}
                      >
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                            o.ok ? "bg-[#16A34A] text-white" : "bg-[#F1F5F9] text-[#94A3B8]"
                          }`}
                        >
                          {o.ok ? <Check size={11} strokeWidth={3} /> : o.k}
                        </span>
                        {o.t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* INTERACTIVE PRODUCT DEMO */}
      <section className="py-16 md:py-24 bg-[#F8FAFF] border-y border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
              Turn one chapter into complete exam prep
            </h2>
            <p className="text-[#64748B] max-w-xl mx-auto">
              Every upload automatically yields four distinct study tools—tailored to ICAI testing patterns.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  tab === t.key
                    ? "bg-[#1E3A8A] text-white shadow-md shadow-[#1E3A8A]/20"
                    : "border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_40px_rgba(30,58,138,0.10)] sm:p-7">
            {tab === "descriptive" && <DescriptiveSample />}
            {tab === "practice" && <PracticeSample />}
            {tab === "tutor" && <TutorSample />}
            {tab === "cheatsheet" && <CheatsheetSample />}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">How Prepzo CA works</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">From your own notes to exam-ready practice, in three steps.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-7 shadow-[0_10px_32px_rgba(30,58,138,0.08)]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1E3A8A]">
                  <step.icon size={22} />
                </div>
                <h3 className="font-[family-name:var(--font-fraunces)] text-xl font-bold leading-tight text-[#0F172A]">
                  {i + 1}. {step.title}
                </h3>
                <p className="mt-3 text-sm text-[#64748B] leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section id="features" className="pb-4">
        {FEATURE_ROWS.map((row) => (
          <FeatureRow key={row.eyebrow} {...row} sample={SAMPLES[row.sampleKey]} />
        ))}
      </section>

      {/* COVERAGE */}
      <section className="py-16 md:py-24 bg-[#F8FAFF] border-y border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
              Every level, every paper
            </h2>
            <p className="text-[#64748B] max-w-xl mx-auto">
              Prepzo knows each paper&rsquo;s real format &mdash; objective MCQs, descriptive answers,
              case studies, and where negative marking applies.
            </p>
          </div>

          {/* Interactive Tier Switcher Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1 gap-1 shadow-sm">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl.level}
                  onClick={() => setActiveLevel(lvl.level)}
                  className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
                    activeLevel === lvl.level
                      ? "bg-[#1E3A8A] text-white shadow-sm"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  CA {lvl.level}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Tier Papers Card */}
          {(() => {
            const current = LEVELS.find((l) => l.level === activeLevel) || LEVELS[1];
            return (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] pb-4 mb-6">
                  <div>
                    <h3 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
                      CA {current.level}
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5">{current.meta}</p>
                  </div>
                  <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-semibold text-[#1E3A8A]">
                    {current.badge}
                  </span>
                </div>

                {current.groups ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {current.groups.map((group) => (
                      <div key={group.name} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A] mb-3">
                          {group.name}
                        </h4>
                        <ul className="space-y-2.5">
                          {group.papers.map((p) => (
                            <li
                              key={p.name}
                              className="flex items-center justify-between gap-2 rounded-lg bg-white p-2.5 border border-[#E2E8F0]/70 text-xs shadow-2xs"
                            >
                              <span className="font-medium text-[#0F172A]">{p.name}</span>
                              <span className="shrink-0 text-[10px] font-semibold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                                {p.tag}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {current.papers?.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3.5 text-xs"
                      >
                        <span className="font-medium text-[#0F172A]">{p.name}</span>
                        <span className="shrink-0 text-[10px] font-semibold text-[#64748B] bg-white px-2 py-1 rounded border border-[#E2E8F0]">
                          {p.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-16 md:py-24 border-b border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
              Plans &amp; Pricing
            </h2>
            <p className="text-[#64748B] max-w-xl mx-auto">
              Every plan works on your own notes — upload, generate questions and flashcards, and study them on a spaced
              schedule. Paid plans raise the limits.
            </p>
          </div>
          <PricingTable
            signedIn={signedIn}
            currentPlan={currentPlan}
            userEmail={userEmail}
            userName={userName}
            hideTerms={true}
          />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-5">
            Start with one chapter.
          </h2>
          <p className="mx-auto mb-9 max-w-xl text-lg text-[#64748B] leading-relaxed">
            Upload your most challenging chapter and experience how much faster prep feels with instant evaluation and tailored recall.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A8A]/30 transition-all hover:bg-[#162D6B]"
          >
            Start free <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer border-t border-[#E2E8F0] py-14">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 text-center sm:px-6 md:flex-row md:items-start md:justify-between md:text-left">
          <div className="flex min-w-[220px] flex-col items-center gap-1 md:items-start">
            <span className="font-[family-name:var(--font-fraunces)] text-xl font-bold text-[#1E3A8A]">Prepzo CA</span>
            <p className="mt-2 max-w-xs text-xs leading-5 text-[#64748B]">
              Prepzo is an independent study platform and is not affiliated with ICAI.
            </p>
            <p className="text-xs font-medium text-[#64748B]">Built for Indian CA aspirants</p>
          </div>

          <div className="flex min-w-[220px] flex-col items-center gap-3 text-sm text-[#64748B] md:items-start">
            <p className="text-sm font-semibold text-[#0F172A]">Support</p>
            <a href="mailto:support@prepzo.study" className="hover:text-[#0F172A] transition-colors">support@prepzo.study</a>
            <div className="flex items-center gap-2">
              <a
                href="https://www.linkedin.com/company/131964161/"
                target="_blank"
                rel="noreferrer"
                aria-label="Prepzo on LinkedIn"
                className="grid h-9 w-9 place-items-center rounded-full border border-[#E2E8F0] text-[#64748B] transition-colors hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
              >
                <LinkedInIcon />
              </a>
              <a
                href="https://www.instagram.com/prepzo.study?igsh=eXpzNnAxazZva3ds"
                target="_blank"
                rel="noreferrer"
                aria-label="Prepzo on Instagram"
                className="grid h-9 w-9 place-items-center rounded-full border border-[#E2E8F0] text-[#64748B] transition-colors hover:border-[#1E3A8A] hover:text-[#1E3A8A]"
              >
                <InstagramIcon />
              </a>
            </div>
          </div>

          <div className="flex flex-1 justify-end">
            <div className="grid gap-4 text-sm font-medium text-[#64748B] md:grid-cols-2 md:justify-items-end md:text-right">
              <div className="flex flex-col gap-2">
                <Link href="/pricing" className="hover:text-[#0F172A] transition-colors">Pricing</Link>
                <Link href="/auth/login" className="hover:text-[#0F172A] transition-colors">Login</Link>
                <Link href="/auth/signup" className="hover:text-[#0F172A] transition-colors">Sign Up</Link>
              </div>
              <div className="flex flex-col gap-2">
                <Link href="/terms" className="hover:text-[#0F172A] transition-colors">Terms</Link>
                <Link href="/privacy-policy" className="hover:text-[#0F172A] transition-colors">Privacy Policy</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Layout helper ───────────────────────────────────────────── */

function FeatureRow({
  eyebrow,
  badge,
  badgeColor,
  title,
  body,
  sample,
  highlight,
  reverse,
}: {
  eyebrow: string;
  badge?: string;
  badgeColor?: string;
  title: string;
  body: string;
  sample: React.ReactNode;
  highlight?: { label: string; text: string };
  reverse?: boolean;
}) {
  return (
    <div className="py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className={`flex flex-col items-center gap-10 md:gap-14 ${
            reverse ? "md:flex-row-reverse" : "md:flex-row"
          }`}
        >
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#1E3A8A]">{eyebrow}</span>
              {badge && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badgeColor || "bg-[#DBEAFE] text-[#1E3A8A]"}`}>
                  {badge}
                </span>
              )}
            </div>
            <h3 className="font-[family-name:var(--font-fraunces)] text-2xl md:text-3xl font-bold leading-tight text-[#0F172A]">
              {title}
            </h3>
            <p className="mt-4 text-[#64748B] leading-relaxed">{body}</p>
            {highlight && (
              <div className="mt-5 rounded-xl border-l-4 border-[#1E3A8A] bg-[#F8FAFF] p-3.5 text-left border border-r-[#E2E8F0] border-y-[#E2E8F0]">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#1E3A8A]">
                  {highlight.label}
                </span>
                <span className="mt-0.5 block text-xs text-[#475569]">{highlight.text}</span>
              </div>
            )}
          </div>
          <div className="w-full flex-1 min-w-0">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_36px_rgba(30,58,138,0.08)]">
              {sample}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Samples ─────────────────────────────────────────────────── */

function DescriptiveSample({ compact }: { compact?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            Corporate and Other Laws · Descriptive
          </p>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-[#0F172A]">
            State any four conditions a company must comply with under Section 73(2) of the
            Companies Act, 2013 before accepting deposits from its members.
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-bold text-white">
          2 / 4 marks
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-[#F8FAFF] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Your answer</p>
        <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
          The company must issue a circular to its members showing its financial position, and
          file it with the Registrar. It also has to certify that it has not defaulted in
          repaying any earlier deposits.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/5 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#15803D]">
            <Check size={13} strokeWidth={3} /> What you got right
          </p>
          <ul className="mt-2 space-y-1.5">
            {GOT_RIGHT.map((t) => (
              <li key={t} className="text-[11px] leading-relaxed text-[#475569]">&bull; {t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/5 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#B91C1C]">
            <X size={13} strokeWidth={3} /> What you missed
          </p>
          <ul className="mt-2 space-y-1.5">
            {MISSED.map((t) => (
              <li key={t} className="text-[11px] leading-relaxed text-[#475569]">&bull; {t}</li>
            ))}
          </ul>
        </div>
      </div>

      {!compact && (
        <div className="mt-3 rounded-xl border border-[#E2E8F0] p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">How to score higher</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#475569]">
            For a &ldquo;state any four&rdquo; question, number your points and give one line each
            &mdash; marks are awarded per condition, so four short points beat two detailed ones.
          </p>
        </div>
      )}
    </div>
  );
}

function PracticeSample() {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
        Advanced Accounting · MCQ · 2 marks · &minus;0.25
      </p>
      <p className="mt-2 text-sm font-medium leading-relaxed text-[#0F172A]">
        A company values its closing inventory at &#8377;4,20,000 (cost), whose net realisable
        value is &#8377;3,85,000. As per AS 2, the amount carried in the balance sheet is:
      </p>
      <div className="mt-4 space-y-2">
        {PRACTICE_OPTIONS.map((o) => (
          <div
            key={o.k}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
              o.ok
                ? "border-[#16A34A] bg-[#16A34A]/5 font-semibold text-[#15803D]"
                : "border-[#E2E8F0] text-[#64748B]"
            }`}
          >
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                o.ok ? "bg-[#16A34A] text-white" : "bg-[#F1F5F9] text-[#94A3B8]"
              }`}
            >
              {o.ok ? <Check size={11} strokeWidth={3} /> : o.k}
            </span>
            {o.t}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-[#F8FAFF] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Explanation</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#475569]">
          AS 2 requires inventories to be carried at the lower of cost and net realisable value.
          NRV (&#8377;3,85,000) is below cost (&#8377;4,20,000), so the write-down of
          &#8377;35,000 is charged to the statement of profit and loss.
        </p>
      </div>
    </div>
  );
}

function TutorSample() {
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#DBEAFE] text-[#1E3A8A]">
          <MessageCircle size={15} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#0F172A]">AI Teacher</p>
          <p className="truncate text-[10px] text-[#94A3B8]">
            Reading: Accounting &mdash; AS 2 Inventories.pdf
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#1E3A8A] px-3.5 py-2.5 text-xs leading-relaxed text-white">
          Why does AS 2 use net realisable value instead of market price?
        </p>
      </div>

      <div className="mt-3 flex justify-start">
        <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[#F8FAFF] px-3.5 py-2.5 text-xs leading-relaxed text-[#475569]">
          Because NRV is what <em>this</em> enterprise will actually realise in the ordinary
          course of business &mdash; the estimated selling price less the costs still needed to
          complete and sell the item. Market price ignores both. Your notes make the same point
          under &ldquo;Measurement&rdquo;: inventory should never be carried above the amount
          expected to be recovered from it.
        </p>
      </div>

      <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#DBEAFE] px-2.5 py-1.5 text-[10px] font-semibold text-[#1E3A8A]">
        <FileText size={11} /> Answered from your upload
      </div>
    </div>
  );
}

function CheatsheetSample() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
        <p className="text-sm font-semibold text-[#0F172A]">AS 2 &mdash; Valuation of Inventories</p>
        <span className="shrink-0 rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[10px] font-semibold text-[#64748B]">
          Export PDF
        </span>
      </div>
      <div className="mt-3.5 space-y-3">
        {CHEATSHEET_ROWS.map((r) => (
          <div key={r.h}>
            <p className="text-[11px] font-bold text-[#1E3A8A]">{r.h}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#475569]">{r.b}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] italic text-[#94A3B8]">
        Editable &mdash; change any line and it saves to your own copy.
      </p>
    </div>
  );
}

function RealPaperSample() {
  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl bg-[#F8FAFF] px-4 py-3">
        <ClipboardCheck size={18} className="shrink-0 text-[#1E3A8A]" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#0F172A]">CA Inter &mdash; Advanced Accounting</p>
          <p className="text-[11px] text-[#94A3B8]">Uploaded paper &middot; 38 questions transcribed</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-[#E2E8F0] p-4">
        <span className="inline-block rounded-md bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold text-[#1E3A8A]">
          Case study
        </span>
        <p className="mt-2 text-[11px] leading-relaxed text-[#475569]">
          Sunrise Ltd. holds 12,000 units of inventory purchased at &#8377;35 each. At year end
          the market has fallen and each unit can be sold for &#8377;32, after selling costs of
          &#8377;1.50 per unit&hellip;
        </p>
        <div className="mt-3 space-y-2 border-t border-[#E2E8F0] pt-3">
          {PAPER_SUBQUESTIONS.map((q) => (
            <p key={q} className="text-[11px] font-medium leading-relaxed text-[#0F172A]">{q}</p>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[10px] italic text-[#94A3B8]">
        Transcribed word-for-word, with the passage kept attached to every sub-question that reads off it.
      </p>
    </div>
  );
}

function RecallSample() {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Due today</p>
      <div className="mt-3 space-y-2.5">
        {RECALL_CARDS.map((c) => (
          <div key={c.t} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] px-3.5 py-3">
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                c.bad ? "bg-[#DC2626]/10 text-[#B91C1C]" : "bg-[#16A34A]/10 text-[#15803D]"
              }`}
            >
              <Layers size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[#0F172A]">{c.t}</p>
              <p className="text-[10px] text-[#94A3B8]">{c.s}</p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold text-[#1E3A8A]">{c.due}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] italic text-[#94A3B8]">
        Wrong answers return sooner. Cards you keep getting right move further away.
      </p>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────────── */

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

const SAMPLES: Record<string, React.ReactNode> = {
  descriptive: <DescriptiveSample compact />,
  realpaper: <RealPaperSample />,
  tutor: <TutorSample />,
  recall: <RecallSample />,
};

const FEATURE_ROWS: {
  eyebrow: string;
  badge?: string;
  badgeColor?: string;
  title: string;
  body: string;
  sampleKey: string;
  highlight?: { label: string; text: string };
  reverse?: boolean;
}[] = [
  {
    eyebrow: "Descriptive Evaluation",
    badge: "ICAI Marking Rubric",
    badgeColor: "bg-[#DBEAFE] text-[#1E3A8A]",
    title: "CA is not an MCQ exam. Your practice should not be either.",
    body: "Write out a full answer the way you would in the examination hall. Prepzo marks your attempt against ICAI mark allocations—identifying key provisions you nailed and points you missed. It works even on papers without published suggested answers.",
    sampleKey: "descriptive",
    highlight: {
      label: "Mark Allocation Check",
      text: "Evaluates exact conditions and sub-points so you know where you gained or dropped marks.",
    },
  },
  {
    eyebrow: "Past & Mock Papers",
    badge: "100% Verbatim Extraction",
    badgeColor: "bg-[#DCFCE7] text-[#15803D]",
    title: "Practice the actual paper, not an approximation.",
    body: "Upload past or mock ICAI question papers and Prepzo transcribes every question verbatim—no hallucination, no unnecessary paraphrasing. Complex case-study passages stay directly attached to every dependent sub-question.",
    sampleKey: "realpaper",
    reverse: true,
    highlight: {
      label: "Case-Study Integrity",
      text: "Multi-part questions remain grouped with their parent passage for authentic exam practice.",
    },
  },
  {
    eyebrow: "Contextual AI Tutor",
    badge: "Grounded in Your Syllabus",
    badgeColor: "bg-[#EDE9FE] text-[#6D28D9]",
    title: "A dedicated tutor that has read your specific notes.",
    body: "Ask doubts directly against your uploaded study notes. You get focused, syllabus-compliant explanations instead of generic internet answers. Focus questions on a single standard or your entire subject bank.",
    sampleKey: "tutor",
    highlight: {
      label: "Zero External Noise",
      text: "Answers draw citations and definitions straight from your provided study documents.",
    },
  },
  {
    eyebrow: "Adaptive Review",
    badge: "Automated Spaced Repetition",
    badgeColor: "bg-[#FEF3C7] text-[#B45309]",
    title: "Meet every concept again, right before you forget it.",
    body: "Every question and flashcard you attempt feeds into an intelligent spaced review queue. Challenging questions return tomorrow; mastered concepts return in weeks, freeing you from manual revision timetabling.",
    sampleKey: "recall",
    reverse: true,
    highlight: {
      label: "Scientifically Proven Retention",
      text: "Spaced intervals ensure definitions, formulas, and section numbers stick until exam day.",
    },
  },
];

const HERO_OPTIONS = [
  { k: "A", t: "Cost", ok: false },
  { k: "B", t: "Net realisable value", ok: false },
  { k: "C", t: "Lower of cost and net realisable value", ok: true },
  { k: "D", t: "Higher of cost and net realisable value", ok: false },
];

const PRACTICE_OPTIONS = [
  { k: "A", t: "₹4,20,000", ok: false },
  { k: "B", t: "₹3,85,000", ok: true },
  { k: "C", t: "₹4,02,500", ok: false },
  { k: "D", t: "₹8,05,000", ok: false },
];

const GOT_RIGHT = [
  "Circular to members showing the company’s financial position",
  "Certificate of no default on earlier deposit repayments",
];

const MISSED = [
  "Circular must be filed with the Registrar at least 30 days before issue",
  "20% of deposits maturing next financial year held in a deposit repayment reserve account",
];

const CHEATSHEET_ROWS = [
  { h: "Measurement", b: "Lower of cost and net realisable value." },
  {
    h: "Cost includes",
    b: "Purchase price, non-recoverable duties and taxes, freight inwards and conversion costs. Excludes abnormal waste, storage (unless necessary) and selling costs.",
  },
  { h: "Cost formulas", b: "FIFO or weighted average. LIFO is not permitted." },
  {
    h: "Net realisable value",
    b: "Estimated selling price less the estimated costs of completion and the costs necessary to make the sale.",
  },
];

const PAPER_SUBQUESTIONS = [
  "(a) Compute the value of closing inventory as per AS 2.",
  "(b) State the accounting treatment of the resulting write-down.",
];

const RECALL_CARDS = [
  { t: "Cost formulas permitted under AS 2", s: "Got it wrong", due: "Again tomorrow", bad: true },
  { t: "Definition of net realisable value", s: "Correct ×2", due: "In 6 days", bad: false },
  { t: "Items excluded from cost of inventory", s: "Correct ×4", due: "In 3 weeks", bad: false },
];

const HOW_IT_WORKS = [
  {
    title: "Upload your notes",
    description: "Add a PDF, doc or photo of your CA study notes — or a real past paper — for any subject.",
    icon: Upload,
  },
  {
    title: "Get questions & cards",
    description: "Prepzo reads the file and generates exam-style MCQs, descriptive questions, flashcards and a cheatsheet from it.",
    icon: Sparkles,
  },
  {
    title: "Revise on autopilot",
    description: "Practice with automatic spaced repetition. Cards and weak areas resurface right before you forget them, cementing long-term recall.",
    icon: Repeat2,
  },
];

interface PaperInfo {
  name: string;
  tag: string;
}

interface LevelGroup {
  name: string;
  papers: PaperInfo[];
}

interface LevelConfig {
  level: string;
  meta: string;
  badge: string;
  groups?: LevelGroup[];
  papers?: PaperInfo[];
}

const LEVELS: LevelConfig[] = [
  {
    level: "Foundation",
    meta: "4 papers · 400 marks · ICAI Entry Level",
    badge: "4 Papers",
    papers: [
      { name: "Paper 1: Accounting", tag: "Descriptive · 100 Marks" },
      { name: "Paper 2: Business Laws", tag: "Descriptive · 100 Marks" },
      { name: "Paper 3: Quantitative Aptitude", tag: "Objective (MCQ) · Negative Marking" },
      { name: "Paper 4: Business Economics", tag: "Objective (MCQ) · Negative Marking" },
    ],
  },
  {
    level: "Intermediate",
    meta: "6 papers · 2 groups · 600 marks",
    badge: "6 Papers · 2 Groups",
    groups: [
      {
        name: "Group 1",
        papers: [
          { name: "Paper 1: Advanced Accounting", tag: "30% MCQ + 70% Descriptive" },
          { name: "Paper 2: Corporate and Other Laws", tag: "30% MCQ + 70% Descriptive" },
          { name: "Paper 3: Taxation (DT & GST)", tag: "30% MCQ + 70% Descriptive" },
        ],
      },
      {
        name: "Group 2",
        papers: [
          { name: "Paper 4: Cost & Management Accounting", tag: "100% Practical & Descriptive" },
          { name: "Paper 5: Auditing and Ethics", tag: "30% MCQ + 70% Descriptive" },
          { name: "Paper 6: FM & Strategic Management", tag: "30% MCQ + 70% Descriptive" },
        ],
      },
    ],
  },
  {
    level: "Final",
    meta: "6 papers · 2 groups · Advanced Tier",
    badge: "6 Papers · 2 Groups",
    groups: [
      {
        name: "Group 1",
        papers: [
          { name: "Paper 1: Financial Reporting", tag: "Case Study & Ind AS Practical" },
          { name: "Paper 2: Advanced Financial Management", tag: "Valuation & Strategy" },
          { name: "Paper 3: Advanced Auditing & Ethics", tag: "Integrated ICAI Standards" },
        ],
      },
      {
        name: "Group 2",
        papers: [
          { name: "Paper 4: Direct Tax & Int'l Tax", tag: "Case Laws & Assessment" },
          { name: "Paper 5: Indirect Tax Laws", tag: "GST & Customs Analysis" },
          { name: "Paper 6: Integrated Business Solutions", tag: "Multi-Disciplinary Case Studies" },
        ],
      },
    ],
  },
];
