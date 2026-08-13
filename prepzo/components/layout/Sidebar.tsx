"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, BookOpen, Brain, BarChart2, Layers, Crown, LogOut, Settings, ChevronDown, BookOpenCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "nav-dashboard" },
  { href: "/flashcards", label: "Flashcards", icon: BookOpen, id: "nav-flashcards" },
  { href: "/quiz", label: "Quiz", icon: Brain, id: "nav-quiz" },
  { href: "/pyq", label: "PYQ Soon", icon: BookOpenCheck, id: "nav-pyq" },
  { href: "/decks", label: "Decks", icon: Layers, id: "nav-decks" },
  { href: "/progress", label: "Progress", icon: BarChart2, id: "nav-progress" },
];

interface SidebarProps {
  profile: Profile | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-white border-r border-[#E2E8F0] fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="p-5 border-b border-[#E2E8F0]">
        <Link href="/dashboard">
          <span className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#1E3A8A]">
            Prepzo
          </span>
        </Link>
        {profile?.exam && (
          <span className="block text-xs text-[#64748B] mt-0.5">
            {profile.exam} Prep
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isPyqQuiz = pathname.startsWith("/quiz") && searchParams.get("pyq") === "true";
          const active = isPyqQuiz ? item.href === "/pyq" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              id={item.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-[#1E3A8A] text-white"
                  : "text-[#64748B] hover:bg-[#F8FAFF] hover:text-[#0F172A]"
              )}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-[#E2E8F0] space-y-1">
        {profile?.plan === "free" && (
          <Link
            href="/upgrade"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#D97706] hover:bg-[#FEF3C7] transition-all"
          >
            <Crown size={18} />
            Upgrade to Pro
          </Link>
        )}

        {/* Profile dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[#F8FAFF] transition-all text-left"
          >
            {/* Avatar initials */}
            <div className="w-7 h-7 rounded-full bg-[#1E3A8A] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(profile?.name || "S").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F172A] truncate">
                {profile?.name || "Student"}
              </p>
              <p className="text-xs text-[#64748B]">
                {profile?.plan === "paid" ? "Pro Member ✨" : "Free Plan"}
              </p>
            </div>
            <ChevronDown size={14} className={`text-[#94A3B8] transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[#E2E8F0] rounded-xl shadow-lg overflow-hidden z-50">
              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F8FAFF] transition-all"
              >
                <Settings size={15} className="text-[#64748B]" />
                Settings
              </Link>
              <div className="h-px bg-[#F1F5F9]" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#DC2626] hover:bg-[#FEE2E2] transition-all"
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
