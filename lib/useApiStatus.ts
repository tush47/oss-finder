"use client";

import { useEffect, useState } from "react";

export type ApiStatus = {
  authenticated: boolean;
  core: { limit: number; remaining: number; resetAt: string } | null;
  search: { limit: number; remaining: number; resetAt: string } | null;
  error?: string;
};

/** Whether the server has a GitHub token, and how much rate limit is left. */
export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  useEffect(() => {
    fetch("/api/status")
      .then((response) => response.json())
      .then(setStatus)
      .catch(() => setStatus({ authenticated: false, core: null, search: null, error: "Could not reach the app server." }));
  }, []);
  return status;
}
