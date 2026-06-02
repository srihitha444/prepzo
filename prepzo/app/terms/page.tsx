import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { TextDocumentPage } from "@/components/content/TextDocumentPage";

export const metadata: Metadata = {
  title: "Terms | Prepzo",
};

export default function TermsPage() {
  const content = fs.readFileSync(
    path.join(process.cwd(), "content", "terms", "terms-and-conditions.md"),
    "utf8"
  );

  return <TextDocumentPage title="Terms" content={content} />;
}

