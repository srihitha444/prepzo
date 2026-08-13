"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UploadCloud, Brain, Layers, ClipboardCheck, MessageCircle, NotebookPen, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, id: "ca-mobile-nav-dashboard" },
  { href: "/notes", label: "Upload", icon: UploadCloud, id: "ca-mobile-nav-notes" },
  { href: "/practice", label: "Practice", icon: Brain, id: "ca-mobile-nav-practice" },
  { href: "/flashcards", label: "Cards", icon: Layers, id: "ca-mobile-nav-flashcards" },
  { href: "/mock-test", label: "Mock Test", icon: ClipboardCheck, id: "ca-mobile-nav-mock-test" },
  { href: "/tutor", label: "AI Teacher", icon: MessageCircle, id: "ca-mobile-nav-tutor" },
  { href: "/cheatsheet", label: "Cheatsheet", icon: NotebookPen, id: "ca-mobile-nav-cheatsheet" },
  { href: "/history", label: "History", icon: BarChart2, id: "ca-mobile-nav-history" },
];

export function CaBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E2E8F0] pb-safe">
      <div className="flex items-stretch overflow-x-auto">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              id={item.id}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-3 px-2 min-h-[60px] min-w-[64px] transition-all",
                active ? "text-[#1E3A8A]" : "text-[#94A3B8]"
              )}
            >
              <item.icon size={20} className={cn(active && "stroke-[2.5px]")} />
              <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
