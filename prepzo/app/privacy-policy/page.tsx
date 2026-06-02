import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { TextDocumentPage } from "@/components/content/TextDocumentPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Prepzo",
};

export default function PrivacyPolicyPage() {
  const content = fs.readFileSync(
    path.join(process.cwd(), "content", "privacy-policy", "privacy-policy.md"),
    "utf8"
  );

  return <TextDocumentPage title="Privacy Policy" content={content} />;
}

