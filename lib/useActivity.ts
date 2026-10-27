"use client";

import { useCallback, useState } from "react";
import { fetchJson } from "./fetchJson";
import type { ActivitySignals, ApiError } from "./github/types";

type Entry = { loading: boolean; data?: ActivitySignals; error?: ApiError };

/** Loads maintainer activity for one repo (and optionally one issue) only when asked. */
export function useActivity() {
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  const check = useCallback(async (repo: string, issue?: number) => {
    const key = issue ? `${repo}#${issue}` : repo;
    setEntries((current) => ({ ...current, [key]: { loading: true } }));
    const params = new URLSearchParams({ repo });
    if (issue) params.set("issue", String(issue));
    const result = await fetchJson<ActivitySignals>(`/api/activity?${params}`);
    setEntries((current) => ({
      ...current,
      [key]: result.error ? { loading: false, error: result.error } : { loading: false, data: result.data },
    }));
  }, []);

  const get = useCallback((repo: string, issue?: number): Entry | undefined => entries[issue ? `${repo}#${issue}` : repo], [entries]);

  return { check, get };
}
