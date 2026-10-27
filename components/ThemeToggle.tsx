"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("oss.theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // Storage blocked. Follow the system setting.
    }
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("oss.theme");
      else localStorage.setItem("oss.theme", next);
    } catch {
      // Storage blocked. The choice lasts for this visit.
    }
    apply(next);
  }

  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span className="sr-only md:not-sr-only">Theme</span>
      <select
        value={theme}
        onChange={(event) => choose(event.target.value as Theme)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
