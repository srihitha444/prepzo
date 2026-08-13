"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const current = document.documentElement.getAttribute("data-theme");
      setTheme(current === "dark" ? "dark" : "light");
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";

    try {
      const saved = localStorage.getItem("prepzo_prefs");
      const prefs = saved ? JSON.parse(saved) : {};
      localStorage.setItem(
        "prepzo_prefs",
        JSON.stringify({ ...prefs, theme: nextTheme }),
      );
    } catch {}

    document.documentElement.setAttribute("data-theme", nextTheme);
    window.dispatchEvent(new Event("prepzo-theme-change"));
    setTheme(nextTheme);
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="public-icon-button"
      aria-label={label}
      title={label}
    >
      <Icon size={18} aria-hidden="true" className={ready ? "opacity-100" : "opacity-0"} />
    </button>
  );
}
