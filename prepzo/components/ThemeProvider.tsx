"use client";

import { useEffect } from "react";

export function ThemeProvider() {
  useEffect(() => {
    function applyTheme() {
      try {
        const saved = localStorage.getItem("prepzo_prefs");
        const prefs = saved ? JSON.parse(saved) : {};
        const theme = prefs.theme || "system";

        const root = document.documentElement;
        if (theme === "dark") {
          root.setAttribute("data-theme", "dark");
        } else if (theme === "light") {
          root.setAttribute("data-theme", "light");
        } else {
          // system
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          root.setAttribute("data-theme", prefersDark ? "dark" : "light");
        }
      } catch {}
    }

    applyTheme();

    // Re-apply when system preference changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", applyTheme);

    // Re-apply when localStorage changes (settings saved in another tab)
    window.addEventListener("storage", applyTheme);

    // Also listen for a custom event fired when settings are saved in the same tab
    window.addEventListener("prepzo-theme-change", applyTheme);

    return () => {
      mq.removeEventListener("change", applyTheme);
      window.removeEventListener("storage", applyTheme);
      window.removeEventListener("prepzo-theme-change", applyTheme);
    };
  }, []);

  return null;
}
