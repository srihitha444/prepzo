import type { Metadata } from "next";
import { ArrowRight, Clock3, Timer } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Free NEET Study Tools",
  description:
    "Use Prepzo's free NEET 2026 countdown and Pomodoro study timer to plan focused sessions, breaks, and daily study goals.",
  alternates: {
    canonical: "/tools",
  },
  openGraph: {
    title: "Free NEET Study Tools",
    description: "Free NEET countdown and Pomodoro focus timer from Prepzo.",
    url: "/tools",
    type: "website",
  },
};

const tools = [
  {
    href: "/tools/neet-countdown",
    title: "NEET 2026 Countdown",
    description: "See the exact time remaining until the announced NEET UG 2026 examination date.",
    icon: Clock3,
    accent: "blue",
  },
  {
    href: "/tools/pomodoro",
    title: "Pomodoro Timer",
    description: "Run focused study sessions, breaks, and a daily study-hours goal.",
    icon: Timer,
    accent: "blue",
  },
];

export default function ToolsPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free NEET Study Tools by Prepzo",
    itemListElement: tools.map((tool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tool.title,
      url: `https://www.prepzo.study${tool.href}`,
    })),
  };

  return (
    <main className="public-main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="public-intro">
        <p className="public-eyebrow">Free study tools</p>
        <h1 className="tools-page-title">
          <span>Free NEET study tools</span>
          <span>for focused preparation</span>
        </h1>
        <p>
          Track the time left for NEET 2026 and organize focused study sessions. These tools work
          in your browser without an account.
        </p>
      </section>

      <section className="tool-grid" aria-label="NEET study tools">
        {tools.map(({ href, title, description, icon: Icon, accent }) => (
          <Link href={href} key={href} className="tool-card">
            <span className={`tool-card-icon ${accent}`}>
              <Icon size={24} strokeWidth={2.2} />
            </span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <ArrowRight size={20} className="tool-card-arrow" />
          </Link>
        ))}
      </section>

      <section className="countdown-seo-copy" aria-labelledby="neet-tools-guide">
        <h2 id="neet-tools-guide">Plan daily NEET preparation with simple tools</h2>
        <p>
          Use the NEET countdown to keep the exam date visible, then use the Pomodoro timer to
          divide Physics, Chemistry, Biology, NCERT revision, and MCQ practice into manageable
          focus sessions. Your Pomodoro settings and daily progress are saved on your device.
        </p>
        <div>
          <Link href="/tools/neet-countdown">Open the NEET 2026 countdown</Link>
          <Link href="/tools/pomodoro">Start the NEET Pomodoro timer</Link>
        </div>
      </section>
    </main>
  );
}
