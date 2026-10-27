"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/issues", label: "Find Issues" },
  { href: "/repos", label: "Repositories" },
  { href: "/contributions", label: "My Contributions" },
  { href: "/jobs", label: "Jobs" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r dark:border-zinc-800 dark:bg-zinc-900/90">
      <div className="flex items-center justify-between px-4 pt-3 md:block md:px-5 md:pt-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          OSS <span className="text-emerald-700 dark:text-emerald-400">Finder</span>
        </Link>
        <div className="md:hidden">
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 py-2 md:mt-6 md:flex-col md:overflow-visible md:px-3">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden px-5 pt-4 md:block">
        <ThemeToggle />
      </div>
    </aside>
  );
}
