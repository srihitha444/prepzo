import type { Metadata } from "next";
import { Fraunces, DM_Mono, DM_Sans } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prepzo - NEET Prep",
  description:
    "The smartest way to prep for NEET with smart flashcards, timed MCQs, and spaced repetition.",
  keywords: ["NEET preparation", "NEET exam", "NEET MCQs", "exam prep India"],
  openGraph: {
    title: "Prepzo - NEET Prep",
    description: "Smart flashcards and timed MCQs for NEET aspirants.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} ${dmMono.variable} h-full`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        <ThemeProvider />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#0F172A",
              color: "#fff",
              borderRadius: "12px",
              fontSize: "14px",
              padding: "12px 16px",
            },
            success: {
              iconTheme: { primary: "#16A34A", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "#DC2626", secondary: "#fff" },
            },
          }}
        />
      </body>
    </html>
  );
}
