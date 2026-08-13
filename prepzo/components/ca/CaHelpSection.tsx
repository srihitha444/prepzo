import Link from "next/link";
import { AlertTriangle, Bell, FileText, HelpCircle, Shield } from "lucide-react";
import { Card } from "@/components/ui/Card";

function HelpRow({
  icon: Icon,
  label,
  sublabel,
  href,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-[#0F172A] transition-all hover:bg-[#F8FAFF]"
    >
      <Icon size={16} className="text-[#64748B]" />
      <span className="flex-1">
        <span className="block">{label}</span>
        <span className="block text-xs font-normal text-[#64748B]">{sublabel}</span>
      </span>
    </Link>
  );
}

export function CaHelpSection() {
  return (
    <Card>
      <h2 className="mb-4 text-base font-bold text-[#0F172A]">Help &amp; Support</h2>
      <div className="space-y-1">
        <HelpRow icon={Shield} label="Privacy Policy" sublabel="How we handle your data" href="/privacy-policy" />
        <HelpRow icon={FileText} label="Terms &amp; Conditions" sublabel="Terms of using Prepzo" href="/terms" />
        <HelpRow icon={Bell} label="Contact Support" sublabel="Reach us at support@prepzo.study" href="mailto:support@prepzo.study" />
        <HelpRow
          icon={AlertTriangle}
          label="Report a Bug"
          sublabel="Help us fix issues"
          href="mailto:support@prepzo.study?subject=Bug Report"
        />
        <HelpRow icon={HelpCircle} label="Help Center / FAQs" sublabel="Browse common questions and guides" href="mailto:support@prepzo.study?subject=Help" />
      </div>
    </Card>
  );
}
