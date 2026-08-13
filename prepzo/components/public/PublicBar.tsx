"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function PublicBar() {
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link href="/" className="public-brand" aria-label="Prepzo home">
          Prepzo
        </Link>
        <nav className="public-desktop-nav" aria-label="Public navigation">
          <Link href="/tools" className="public-nav-link">Tools</Link>
          <Link href="/blog" className="public-nav-link">Blog</Link>
          <Link href="/referral" className="public-nav-link">Refer</Link>
        </nav>
        <div className="public-header-actions">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
