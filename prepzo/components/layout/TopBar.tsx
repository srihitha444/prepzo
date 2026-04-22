"use client";

import Link from "next/link";
import { Flame, Settings } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";

interface TopBarProps {
  profile: Profile | null;
  title?: string;
}

export function TopBar({ profile, title }: TopBarProps) {
  return (
    <header className="md:hidden sticky top-0 z-20 bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-base font-semibold text-[#0F172A]">
          {title || (
            <span className="font-[family-name:var(--font-fraunces)] text-[#1E3A8A] text-xl font-bold">
              Prepzo
            </span>
          )}
        </h1>
        {profile?.exam && (
          <p className="text-xs text-[#64748B]">{profile.exam} Prep</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {profile && (
          <div className="flex items-center gap-1.5 bg-[#FEF3C7] px-3 py-1.5 rounded-full">
            <Flame size={14} className="text-[#D97706]" />
            <span className="text-sm font-bold text-[#D97706] font-[family-name:var(--font-dm-mono)]">
              {profile.streak}
            </span>
          </div>
        )}
        <Link
          href="/settings"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFF] transition-all"
          aria-label="Settings"
        >
          <Settings size={18} />
        </Link>
      </div>
    </header>
  );
}
