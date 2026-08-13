import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prepzo CA - Chartered Accountancy Preparation",
  description:
    "Upload your CA study notes and Prepzo turns them into MCQs and flashcards, tailored to your level and group.",
};

export default function CaRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
