"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

export function CaHeader({ profile }: { profile: Profile }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E2E8F0] bg-white px-5 py-4">
      <Link href="/dashboard" className="inline-block">
        <span className="font-[family-name:var(--font-fraunces)] text-xl font-bold text-[#1E3A8A]">
          Prepzo CA
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-[#64748B] sm:inline">{profile.name || "Welcome"}</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-[#DC2626] transition-all hover:bg-[#FEE2E2]"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </header>
  );
}
