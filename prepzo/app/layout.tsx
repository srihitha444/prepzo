import type { Metadata } from "next";
import Script from "next/script";
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
  metadataBase: new URL("https://www.prepzo.study"),
  title: {
    default: "Prepzo - NEET Preparation, MCQs and Study Tools",
    template: "%s | Prepzo",
  },
  description:
    "Prepare for NEET with timed MCQs, smart flashcards, spaced repetition, a NEET countdown, and a free Pomodoro study timer.",
  keywords: ["NEET preparation", "NEET exam", "NEET MCQs", "exam prep India"],
  applicationName: "Prepzo",
  authors: [{ name: "Prepzo", url: "https://www.prepzo.study" }],
  creator: "Prepzo",
  publisher: "Prepzo",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/prepzo-icon.png", type: "image/png" },
    ],
    shortcut: "/prepzo-icon.png",
    apple: "/prepzo-icon.png",
  },
  openGraph: {
    title: "Prepzo - NEET Preparation, MCQs and Study Tools",
    description:
      "Timed MCQs, smart flashcards, spaced repetition, and free study tools for NEET aspirants.",
    type: "website",
    url: "/",
    siteName: "Prepzo",
  },
  twitter: {
    card: "summary",
    title: "Prepzo - NEET Preparation and Study Tools",
    description: "NEET MCQs, flashcards, countdown, and Pomodoro tools for focused preparation.",
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
      <head>
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-5L3NFL4Q');
          `}
        </Script>
      </head>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5L3NFL4Q"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-YBPPDL6TQD"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-YBPPDL6TQD');
          `}
        </Script>
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
