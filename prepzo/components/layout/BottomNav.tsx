"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Brain, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, id: "mobile-nav-dashboard" },
  { href: "/flashcards", label: "Flashcards", icon: BookOpen, id: "mobile-nav-flashcards" },
  { href: "/quiz", label: "Quiz", icon: Brain, id: "mobile-nav-quiz" },
  { href: "/progress", label: "Progress", icon: BarChart2, id: "mobile-nav-progress" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E2E8F0] pb-safe">
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              id={item.id}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-3 px-2 min-h-[60px] transition-all",
                active ? "text-[#1E3A8A]" : "text-[#94A3B8]"
              )}
            >
              <item.icon
                size={20}
                className={cn(active && "stroke-[2.5px]")}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
