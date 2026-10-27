"use client";

// A useState that is saved to localStorage, so data survives page reloads and browser restarts.
// Every component using the same key stays in sync, including across browser tabs.
import { useCallback, useEffect, useState } from "react";
import type {
  BookmarkedIssue,
  Contribution,
  FollowUp,
  IssuePreset,
  JobListing,
  RecentRepo,
  RepoPreset,
  SavedRepo,
  SearchStats,
  Settings,
} from "./types";

export const KEYS = {
  settings: "oss.settings",
  bookmarks: "oss.bookmarks",
  savedRepos: "oss.savedRepos",
  recentRepos: "oss.recentRepos",
  issuePresets: "oss.issuePresets",
  repoPresets: "oss.repoPresets",
  contributions: "oss.contributions",
  jobs: "oss.jobs",
  followUps: "oss.followUps",
  searchStats: "oss.searchStats",
  gsoc: "oss.gsoc",
} as const;

export const defaultSettings: Settings = { githubUsername: "", languages: ["TypeScript", "Python"], topics: [] };

const EVENT = "oss-storage";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns [value, setValue, loaded]. `loaded` is false during the first render on the client. */
export function useStored<T>(key: string, fallback: T): [T, (next: T | ((current: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setValue(read(key, fallback));
    setLoaded(true);
    const sync = (event: Event) => {
      const changedKey = event instanceof StorageEvent ? event.key : (event as CustomEvent<string>).detail;
      if (changedKey === key) setValue(read(key, fallback));
    };
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
    // The fallback is a constant default, so it is left out on purpose.
  }, [key]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = read(key, fallback);
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage full or blocked. Keep the value in memory for this visit.
      }
      setValue(resolved);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key],
  );

  return [value, update, loaded];
}

export function useSettings() {
  return useStored<Settings>(KEYS.settings, defaultSettings);
}

export const emptyLists = {
  bookmarks: [] as BookmarkedIssue[],
  savedRepos: [] as SavedRepo[],
  recentRepos: [] as RecentRepo[],
  issuePresets: [] as IssuePreset[],
  repoPresets: [] as RepoPreset[],
  contributions: [] as Contribution[],
  jobs: [] as JobListing[],
  followUps: [] as FollowUp[],
};

export const emptySearchStats: SearchStats = { issueTotal: null, searchedAt: null };

/** Everything the app stores, for export and import in Settings. */
export function exportAll(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of Object.values(KEYS)) data[key] = read(key, null);
  return data;
}

export function importAll(data: Record<string, unknown>) {
  for (const key of Object.values(KEYS)) {
    if (key in data && data[key] !== null) window.localStorage.setItem(key, JSON.stringify(data[key]));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
  }
}

export function clearAll() {
  for (const key of Object.values(KEYS)) {
    window.localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
  }
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
}

/** Remember repos seen in search results so the dashboard can list them. Keeps the newest 30. */
export function rememberRepos(current: RecentRepo[], repos: Omit<RecentRepo, "seenAt">[]): RecentRepo[] {
  const now = new Date().toISOString();
  const names = new Set<string>();
  const fresh: RecentRepo[] = [];
  for (const repo of repos) {
    if (names.has(repo.fullName)) continue;
    names.add(repo.fullName);
    fresh.push({ ...repo, seenAt: now });
  }
  return [...fresh, ...current.filter((repo) => !names.has(repo.fullName))].slice(0, 30);
}
