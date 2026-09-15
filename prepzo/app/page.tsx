"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  ChevronRight,
  ClipboardCheck,
  FileText,
  MessageCircle,
  NotebookPen,
  PenLine,
  Repeat2,
  Sparkles,
} from "lucide-react";

export default function CaLandingPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("error")) {
      const callbackPath = "/auth/callback";
      const callbackUrl = `${callbackPath}${window.location.search}`;
      window.location.replace(callbackUrl);
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
            <a href="#features" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
              Features
            </a>
            <Link href="/auth/login" className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
              Login
            </Link>
            <Link href="/auth/signup" className="px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-sm font-semibold transition-all">
              Try for Free
            </Link>
          </nav>
          <Link href="/auth/signup" className="md:hidden px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold">
            Try for Free
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden pt-14 pb-16 md:pt-20 md:pb-24">
        <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/80 to-white pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">

            {/* LEFT: Text */}
            <div className="landing-hero-copy flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#DBEAFE] border border-[#BFDBFE] text-[#1E3A8A] text-xs font-medium mb-7">
                <span>✨</span>
                Built for CA aspirants
              </div>
              <h1 className="font-[family-name:var(--font-fraunces)] text-5xl sm:text-6xl font-bold text-[#0F172A] leading-[1.1] mb-5">
                <span className="text-[#1E3A8A]">Prepzo</span> CA
              </h1>
              <p className="text-lg text-[#64748B] max-w-lg mb-9 leading-relaxed">
                Upload your CA study notes and Prepzo turns them into MCQs and flashcards
                automatically — so you spend your time practicing, not making cards.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                <Link href="/auth/signup" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-base font-semibold transition-all shadow-lg shadow-[#1E3A8A]/30">
                  Explore CA Vertical
                </Link>
                <a href="#features" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white hover:bg-[#F8FAFF] border border-[#E2E8F0] text-[#0F172A] text-base font-semibold transition-all flex items-center justify-center gap-2">
                  See How It Works <ChevronRight size={16} />
                </a>
              </div>
            </div>

            {/* RIGHT: Product card */}
            <div className="flex-shrink-0 w-full md:w-[420px]">
              <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[0_8px_40px_rgba(30,58,138,0.12)] p-8 flex flex-col items-center text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#DBEAFE] text-[#1E3A8A]">
                  <FileText size={26} />
                </div>
                <h3 className="font-semibold text-[#0F172A]">Notes-to-MCQ generation</h3>
                <p className="text-sm text-[#64748B]">
                  Upload a PDF or photo of your notes and get exam-style MCQs and flashcards
                  back in minutes.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 md:py-24 bg-[#F8FAFF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">How Prepzo CA Works</h2>
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

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">Everything You Need to Clear CA</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Built for CA aspirants who want to stop forgetting and start scoring higher.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="p-6 rounded-[14px] hover:bg-[#F8FAFF] transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#DBEAFE] flex items-center justify-center mb-4">
                  <feature.icon size={22} className="text-[#1E3A8A]" />
                </div>
                <h3 className="font-semibold text-[#0F172A] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
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
            <p className="text-xs text-[#64748B]">Made for India students</p>
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

const HOW_IT_WORKS = [
  {
    title: "Upload your notes",
    description: "Add a PDF, doc, or photo of your CA study notes for any subject.",
    icon: FileText,
  },
  {
    title: "Get MCQs & flashcards",
    description: "Prepzo turns your notes into exam-style MCQs and flashcards automatically.",
    icon: Sparkles,
  },
  {
    title: "Practice with recall",
    description: "Review with spaced repetition so concepts stick before exam day.",
    icon: Repeat2,
  },
];

const FEATURES = [
  { title: "Notes to MCQs", description: "Turn your own study notes into exam-style multiple choice questions automatically", icon: Sparkles },
  { title: "Descriptive answers, graded", description: "Write a full answer and get it marked against the question's mark allocation, point by point", icon: PenLine },
  { title: "Real papers, transcribed", description: "Upload a past or mock ICAI paper and practice its actual questions, not a generated approximation", icon: ClipboardCheck },
  { title: "AI Teacher on your notes", description: "Ask questions and get answers grounded in the material you uploaded, not generic explanations", icon: MessageCircle },
  { title: "Spaced Repetition System", description: "Every card you practice — right or wrong — comes back at the perfect time so you never forget before the exam", icon: Repeat2 },
  { title: "Cheatsheets you can edit", description: "Condense any upload into a revision sheet you can edit and export as a PDF", icon: NotebookPen },
];
