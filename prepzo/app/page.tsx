"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Timer, Repeat2, TrendingUp, Smartphone, Zap, ChevronRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      {/* NAV */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#1E3A8A]">
            Prepzo
          </span>
          <nav className="hidden md:flex items-center gap-8">
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
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#DBEAFE] border border-[#BFDBFE] text-[#1E3A8A] text-xs font-medium mb-7">
                <span>✨</span>
                The smartest way to prep for JEE, NEET &amp; CUET
              </div>
              <h1 className="font-[family-name:var(--font-fraunces)] text-5xl sm:text-6xl font-bold text-[#0F172A] leading-[1.1] mb-5">
                <span className="text-[#1E3A8A]">Crack</span>{" "}
                JEE Main, NEET<br />&amp; CUET.
              </h1>
              <p className="text-lg text-[#64748B] max-w-lg mb-9 leading-relaxed">
                Never forget what you studied. Smart flashcards, MCQs &amp; active recall built for students who want to top their exams.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                <Link href="/auth/signup" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#1E3A8A] hover:bg-[#162D6B] text-white text-base font-semibold transition-all shadow-lg shadow-[#1E3A8A]/30">
                  Try for Free
                </Link>
                <a href="#features" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white hover:bg-[#F8FAFF] border border-[#E2E8F0] text-[#0F172A] text-base font-semibold transition-all flex items-center justify-center gap-2">
                  See How It Works <ChevronRight size={16} />
                </a>
              </div>
            </div>

            {/* RIGHT: Quiz UI Mockup with subject scroll */}
            <div className="flex-shrink-0 w-full md:w-[420px]">
              <QuizMockup />
            </div>

          </div>
        </div>
      </section>

      {/* EXAM CARDS */}
      <section className="py-16 md:py-24 bg-[#F8FAFF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">Choose Your Exam</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Complete syllabus coverage with exam-pattern questions &amp; smart practice.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {EXAM_CARDS.map((exam) => (
              <div key={exam.name} className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-6 hover:shadow-[0_4px_24px_rgba(30,58,138,0.12)] hover:-translate-y-0.5 transition-all">
                <div className="text-3xl mb-3">{exam.icon}</div>
                <h3 className="font-[family-name:var(--font-fraunces)] text-xl font-bold text-[#0F172A] mb-1">{exam.name}</h3>
                <p className="text-xs text-[#64748B] mb-4">{exam.fullName}</p>
                <ul className="space-y-2">
                  {exam.subjects.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm text-[#0F172A]">
                      <Check size={14} className="text-[#16A34A] shrink-0" />{s}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="mt-5 block w-full text-center py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-medium text-[#1E3A8A] hover:bg-[#F8FAFF] transition-all">
                  Start {exam.name} Prep →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">Everything You Need to Top</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Built for JEE, NEET &amp; CUET aspirants who want to stop forgetting and start scoring higher.</p>
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

      {/* PRICING */}
      <section id="pricing" className="py-16 md:py-24 bg-[#F8FAFF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">Simple, Transparent Pricing</h2>
            <p className="text-[#64748B]">Start completely free. Upgrade only when you&apos;re ready for advanced practice.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">

            {/* Free */}
            <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-7 flex flex-col">
              <h3 className="text-lg font-bold text-[#0F172A] mb-1">Free</h3>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-bold font-[family-name:var(--font-fraunces)] text-[#0F172A]">₹0</span>
                <span className="text-[#64748B] pb-1">/month</span>
              </div>
              <ul className="space-y-3 mb-7 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#0F172A]">
                    <Check size={14} className="text-[#64748B] shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="block w-full text-center py-3 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF] transition-all">
                Get Started Free
              </Link>
            </div>

            {/* Pro Monthly */}
            <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[var(--shadow-card)] p-7 flex flex-col">
              <h3 className="text-lg font-bold text-[#0F172A] mb-1">Pro Monthly</h3>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-bold font-[family-name:var(--font-fraunces)] text-[#0F172A]">₹99</span>
                <span className="text-[#64748B] pb-1">/month</span>
              </div>
              <ul className="space-y-3 mb-7 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#0F172A]">
                    <Check size={14} className="text-[#16A34A] shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="block w-full text-center py-3 rounded-xl border border-[#1E3A8A] text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF] transition-all">
                Get Pro Monthly
              </Link>
            </div>

            {/* Pro Yearly — Best Value */}
            <div className="relative bg-[#1E3A8A] rounded-[14px] shadow-[0_8px_40px_rgba(30,58,138,0.3)] p-7 text-white flex flex-col overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="bg-[#D97706] text-white text-xs font-bold px-3 py-1 rounded-full">BEST VALUE</span>
              </div>
              <h3 className="text-lg font-bold mb-1">Pro Yearly</h3>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold font-[family-name:var(--font-fraunces)]">₹799</span>
                <span className="text-white/70 pb-1">/year</span>
              </div>
              <p className="text-white/60 text-xs mb-6">Just ₹67/month — save 2 months free</p>
              <ul className="space-y-3 mb-7 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white">
                    <Check size={14} className="text-[#4ADE80] shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="block w-full text-center py-3 rounded-xl bg-white text-[#1E3A8A] text-sm font-semibold hover:bg-[#F8FAFF] transition-all">
                Get Pro Yearly — Best Deal
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#E2E8F0] py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-[family-name:var(--font-fraunces)] text-xl font-bold text-[#1E3A8A]">Prepzo</span>
            <p className="text-xs text-[#64748B] mt-1">Made with ❤️ for Indian students</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#64748B]">
            <Link href="/auth/login" className="hover:text-[#0F172A] transition-colors">Login</Link>
            <Link href="/auth/signup" className="hover:text-[#0F172A] transition-colors">Sign Up</Link>
            <a href="#pricing" className="hover:text-[#0F172A] transition-colors">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── QUIZ MOCKUP WITH SUBJECT SCROLL ──────────────────────────────
const SAMPLE_QUESTIONS = [
  {
    subject: "Physics",
    exam: "JEE",
    qNum: 7,
    total: 20,
    timer: "22s",
    correct: 5,
    wrong: 1,
    accuracy: 83,
    question: "A ball thrown vertically upward with velocity 20 m/s. The maximum height reached is:",
    options: ["10 m", "20 m", "30 m", "40 m"],
    correctIndex: 1,
  },
  {
    subject: "Chemistry",
    exam: "JEE",
    qNum: 4,
    total: 20,
    timer: "18s",
    correct: 3,
    wrong: 1,
    accuracy: 75,
    question: "The hybridisation of carbon in diamond is:",
    options: ["sp", "sp²", "sp³", "sp³d"],
    correctIndex: 2,
  },
  {
    subject: "Biology",
    exam: "NEET",
    qNum: 9,
    total: 20,
    timer: "25s",
    correct: 7,
    wrong: 2,
    accuracy: 78,
    question: "Which organelle is known as the powerhouse of the cell?",
    options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"],
    correctIndex: 2,
  },
];

function QuizMockup() {
  const [activeIdx, setActiveIdx] = useState(0);
  const q = SAMPLE_QUESTIONS[activeIdx];

  return (
    <div className="bg-white rounded-[14px] border border-[#E2E8F0] shadow-[0_8px_40px_rgba(30,58,138,0.12)] overflow-hidden">
      {/* Subject tabs */}
      <div className="flex border-b border-[#E2E8F0] overflow-x-auto">
        {SAMPLE_QUESTIONS.map((s, i) => (
          <button
            key={s.subject}
            onClick={() => setActiveIdx(i)}
            className={`flex-shrink-0 px-4 py-2.5 text-xs font-semibold transition-all border-b-2 ${
              activeIdx === i
                ? "border-[#1E3A8A] text-[#1E3A8A] bg-[#F8FAFF]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {s.subject}
          </button>
        ))}
      </div>

      {/* Question card */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium bg-[#DBEAFE] text-[#1E3A8A] px-2.5 py-1 rounded-full">{q.exam} {q.subject}</span>
            <span className="text-xs text-[#64748B]">Q {q.qNum} / {q.total}</span>
          </div>
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#E2E8F0" strokeWidth="4"/>
              <circle cx="20" cy="20" r="16" fill="none" stroke="#1E3A8A" strokeWidth="4" strokeDasharray="100" strokeDashoffset="35" strokeLinecap="round"/>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-[family-name:var(--font-dm-mono)] text-[#1E3A8A]">{q.timer}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs mb-4">
          <span className="text-[#16A34A] font-semibold">✓ {q.correct}</span>
          <span className="text-[#DC2626] font-semibold">✗ {q.wrong}</span>
          <span className="text-[#64748B]">{q.accuracy}% accuracy</span>
        </div>

        <p className="text-sm font-medium text-[#0F172A] mb-4 leading-snug">{q.question}</p>

        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <div
              key={i}
              className={`w-full px-4 py-3 rounded-xl text-sm border ${
                i === q.correctIndex
                  ? "bg-[#DCFCE7] border-[#16A34A] text-[#15803D] font-medium"
                  : "border-[#E2E8F0] text-[#0F172A]"
              }`}
            >
              <span className="font-medium text-[#64748B] mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const EXAM_CARDS = [
  { name: "JEE Main", fullName: "Joint Entrance Examination (Main)", icon: "⚗️", subjects: ["Physics", "Chemistry", "Mathematics"] },
  { name: "NEET", fullName: "National Eligibility cum Entrance Test", icon: "🧬", subjects: ["Physics", "Chemistry", "Botany", "Zoology"] },
  { name: "CUET", fullName: "Central Universities Entrance Test", icon: "📚", subjects: ["Language Skills", "Domain Subjects", "General Test"] },
];

const FEATURES = [
  { title: "MCQs by Section", description: "Set your goal, get fresh exam-level MCQs organised by topic — practice what you need, whenever you want.", icon: Zap },
  { title: "Spaced Repetition System", description: "Every card you practice — right or wrong — comes back at the perfect time using spaced repetition so you never forget before the exam.", icon: Repeat2 },
  { title: "30-Second Countdown Timer", description: "Train under real exam pressure. A live countdown timer helps you build speed section by section.", icon: Timer },
  { title: "Speed Mode Flashcards", description: "Auto-advancing cards. Revise 50+ concepts in under 5 minutes.", icon: Zap },
  { title: "Weak Topic Detection", description: "Automatically spots your weak topics (below 60%) and shows you exactly what to focus on next.", icon: TrendingUp },
  { title: "Mobile-First Design", description: "Study anywhere. Swipe, tap, and track your streak anytime on your phone.", icon: Smartphone },
];

const FREE_FEATURES = [
  "15 MCQs per day",
  "1 exam track (JEE or NEET or CUET)",
  "5 flashcards per session",
  "Progress tracking",
  "Limited Recall Deck",
];

const PRO_FEATURES = [
  "New MCQs every day",
  "All 3 exams (JEE, NEET, CUET)",
  "Full + Speed Mode flashcards",
  "Detailed analytics",
  "Weak topic detection",
  "Full progress history",
];
