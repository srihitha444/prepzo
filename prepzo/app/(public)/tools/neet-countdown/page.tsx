import type { Metadata } from "next";
import { CountdownTimer } from "./CountdownTimer";

export const metadata: Metadata = {
  title: "NEET 2026 Countdown: Days Left, Date and Time",
  description:
    "Live NEET 2026 countdown showing the days, hours, minutes and seconds left until June 21, 2026 at 2:00 PM IST. Study for NEET with Prepzo.",
  keywords: [
    "NEET 2026 countdown",
    "days left for NEET 2026",
    "NEET 2026 exam date",
    "NEET countdown timer",
    "NEET preparation",
    "NEET MCQ practice",
    "NEET study timer",
  ],
  alternates: {
    canonical: "/tools/neet-countdown",
  },
  openGraph: {
    title: "NEET 2026 Countdown: Days Left, Date & Time",
    description:
      "Track the exact time remaining until NEET 2026 and keep your preparation focused with Prepzo.",
    type: "website",
    url: "/tools/neet-countdown",
  },
};

export default function NeetCountdownPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "NEET 2026 Countdown",
    url: "https://www.prepzo.study/tools/neet-countdown",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    description:
      "A live countdown showing the time remaining until the announced NEET UG 2026 examination date.",
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
      <CountdownTimer />
    </>
  );
}
