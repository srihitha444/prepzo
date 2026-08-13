"use client";

import { ArrowRight, BookOpenCheck, CalendarDays, Clock3, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const EXAM_DATE = new Date("2026-06-21T14:00:00+05:30").getTime();

const QUOTES = [
  "The result you want starts with the work you do today.",
  "Every MCQ you solve today is one less doubt on exam day.",
  "Small daily progress beats cramming every time.",
  "NCERT is your foundation. Revise it carefully.",
  "Consistency beats intensity. Show up every day.",
  "Your future patients are counting on you. Study hard.",
];

type CountdownState = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
};

function getCountdownState(): CountdownState {
  const now = Date.now();
  const difference = Math.max(0, EXAM_DATE - now);

  return {
    days: Math.floor(difference / 86_400_000),
    hours: Math.floor((difference % 86_400_000) / 3_600_000),
    minutes: Math.floor((difference % 3_600_000) / 60_000),
    seconds: Math.floor((difference % 60_000) / 1_000),
    complete: difference === 0,
  };
}

export function CountdownTimer() {
  const [countdown, setCountdown] = useState<CountdownState | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const update = () => setCountdown(getCountdownState());
    const firstFrame = window.requestAnimationFrame(update);
    const timer = window.setInterval(update, 1_000);
    const quoteTimer = window.setInterval(
      () => setQuoteIndex((current) => (current + 1) % QUOTES.length),
      8_000,
    );

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearInterval(timer);
      window.clearInterval(quoteTimer);
    };
  }, []);

  const units = [
    { label: "Days", value: countdown?.days },
    { label: "Hours", value: countdown?.hours },
    { label: "Mins", value: countdown?.minutes },
    { label: "Secs", value: countdown?.seconds },
  ];
  return (
    <main className="neet-countdown-page">
      <section className="neet-countdown-card" aria-labelledby="countdown-title">
        <div className="countdown-badge">Re-NEET UG 2026</div>
        <h1 id="countdown-title">
          Days Left Till <span>NEET 2026</span>
        </h1>
        <p className="countdown-subtitle">
          Re-exam confirmed: <strong>June 21, 2026 · 2:00 PM IST</strong>
        </p>

        {countdown?.complete ? (
          <div className="countdown-complete" role="status">
            Best of luck for NEET 2026. You&apos;ve got this.
          </div>
        ) : (
          <div className="countdown-tiles" aria-label="Time remaining until NEET 2026">
            {units.map(({ label, value }) => (
              <div className="countdown-tile" key={label}>
                <strong>{value === undefined ? "--" : String(value).padStart(2, "0")}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}

        <blockquote className="countdown-quote" key={quoteIndex}>
          &ldquo;{QUOTES[quoteIndex]}&rdquo;
        </blockquote>

        <div className="countdown-details">
          <div>
            <CalendarDays size={18} />
            <strong>June 21</strong>
            <span>Exam date</span>
          </div>
          <div>
            <Clock3 size={18} />
            <strong>2:00 PM</strong>
            <span>Start time IST</span>
          </div>
          <div>
            <Timer size={18} />
            <strong>3h 15m</strong>
            <span>Duration</span>
          </div>
        </div>

        <Link href="/auth/signup" className="countdown-prepzo-cta">
          <BookOpenCheck size={19} />
          Study for NEET with Prepzo
          <ArrowRight size={18} />
        </Link>
        <p className="countdown-cta-note">
          Practice NEET MCQs, revise with flashcards, and track your preparation.
        </p>
      </section>

      <section className="countdown-seo-copy" aria-labelledby="neet-countdown-guide">
        <h2 id="neet-countdown-guide">NEET 2026 exam countdown and preparation</h2>
        <p>
          Use this live NEET 2026 countdown to track the days, hours, minutes, and seconds
          remaining before the exam. Keep your NEET preparation moving with daily MCQ practice,
          NCERT revision, mock tests, focused study sessions, and regular review of weak topics.
        </p>
        <div>
          <a href="https://neet.nta.nic.in/" target="_blank" rel="noreferrer">
            Check official NTA updates
          </a>
        </div>
      </section>
    </main>
  );
}
