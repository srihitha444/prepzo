import type { Metadata } from "next";
import { PomodoroTimer } from "./PomodoroTimer";

export const metadata: Metadata = {
  title: "Free NEET Pomodoro Timer",
  description:
    "Use a free Pomodoro timer for NEET preparation with adjustable focus sessions, short and long breaks, daily study-hour goals, and saved progress.",
  keywords: [
    "NEET Pomodoro timer",
    "study timer for NEET",
    "free Pomodoro timer",
    "NEET study schedule",
    "focus timer for students",
  ],
  alternates: {
    canonical: "/tools/pomodoro",
  },
  openGraph: {
    title: "Free NEET Pomodoro Timer",
    description:
      "Plan focused NEET study sessions with adjustable timers, breaks, and daily goals.",
    url: "/tools/pomodoro",
    type: "website",
  },
};

export default function PomodoroPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Prepzo NEET Pomodoro Timer",
    url: "https://www.prepzo.study/tools/pomodoro",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a modern web browser",
    description:
      "A free Pomodoro study timer for NEET students with adjustable focus sessions, breaks, and daily study goals.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    provider: {
      "@type": "Organization",
      name: "Prepzo",
      url: "https://www.prepzo.study",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <PomodoroTimer />
    </>
  );
}
