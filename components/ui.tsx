"use client";

import type { ReactNode } from "react";
import { timeUntil } from "@/lib/format";
import type { ApiError } from "@/lib/github/types";

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="muted mt-1 max-w-2xl text-sm">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function ExternalLink({ href, children, className = "link" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card animate-pulse">
          <div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-3 h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-4 h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
          <div className="mt-2 h-3 w-5/6 rounded bg-zinc-100 dark:bg-zinc-800/60" />
        </div>
      ))}
    </div>
  );
}

export function ErrorMessage({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const title =
    error.kind === "rate_limit"
      ? "GitHub rate limit reached"
      : error.kind === "invalid"
        ? "GitHub could not run this search"
        : error.kind === "network"
          ? "Connection problem"
          : "Something went wrong";
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{error.message}</p>
      {error.kind === "rate_limit" ? (
        <p className="mt-1">
          Try again {timeUntil(error.resetAt)}. Without a token GitHub allows 10 searches per minute. With one it allows 30. See the
          README section on tokens.
        </p>
      ) : null}
      {onRetry ? (
        <button type="button" className="btn mt-3" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <p className="font-semibold">{title}</p>
      <div className="muted mx-auto mt-1 max-w-md text-sm">{children}</div>
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  const colors =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
  return <div className={`rounded-xl border p-3 text-sm ${colors}`}>{children}</div>;
}

export function ChipGroup({
  label,
  options,
  selected,
  onChange,
  hint,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              className={`chip ${on ? "chip-on" : ""}`}
              onClick={() => onChange(on ? selected.filter((value) => value !== option.value) : [...selected, option.value])}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="muted mt-1 text-xs">{hint}</p> : null}
    </fieldset>
  );
}

export function Pagination({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const last = Math.max(1, Math.min(50, Math.ceil(total / perPage)));
  if (last <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2">
      <button type="button" className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Previous
      </button>
      <span className="muted text-sm">
        Page {page} of {last}
      </span>
      <button type="button" className="btn" disabled={page >= last} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </nav>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" | "violet" }) {
  const tones = {
    neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    green: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    red: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
    blue: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    violet: "bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
