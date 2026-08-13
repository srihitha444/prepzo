"use client";

import { useState } from "react";
import { BookOpen, HelpCircle, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CaSettingsForm } from "@/components/ca/CaSettingsForm";
import { CaAccountSection } from "@/components/ca/CaAccountSection";
import { CaHelpSection } from "@/components/ca/CaHelpSection";

type Section = "account" | "study" | "help";

const NAV = [
  { id: "account" as Section, label: "Account & Profile", icon: User },
  { id: "study" as Section, label: "Study Profile", icon: BookOpen },
  { id: "help" as Section, label: "Help & Support", icon: HelpCircle },
];

export function CaSettingsShell({
  userId,
  initialName,
  initialLevel,
  initialGroups,
  initialPapers,
  initialTargetDate,
}: {
  userId: string;
  initialName: string;
  initialLevel: string;
  initialGroups: string[];
  initialPapers: string[];
  initialTargetDate: string;
}) {
  const [activeSection, setActiveSection] = useState<Section>("account");

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="shrink-0 md:w-52">
        <Card className="space-y-0.5 p-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeSection === item.id
                  ? "bg-[#1E3A8A] text-white"
                  : "text-[#64748B] hover:bg-[#F8FAFF] hover:text-[#0F172A]"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </Card>
      </aside>

      <div className="flex-1 space-y-4">
        {activeSection === "account" && <CaAccountSection userId={userId} initialName={initialName} />}
        {activeSection === "study" && (
          <CaSettingsForm
            initialLevel={initialLevel}
            initialGroups={initialGroups}
            initialPapers={initialPapers}
            initialTargetDate={initialTargetDate}
          />
        )}
        {activeSection === "help" && <CaHelpSection />}
      </div>
    </div>
  );
}
