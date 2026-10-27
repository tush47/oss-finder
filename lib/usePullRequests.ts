"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "./fetchJson";
import type { ApiError, PullRequestResult } from "./github/types";

type State =
  | { status: "idle" | "loading" }
  | { status: "error"; error: ApiError }
  | { status: "done"; items: PullRequestResult[]; total: number };

/** The user's public pull requests from GitHub. Does nothing until a username is set. */
export function usePullRequests(username: string) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!username) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetchJson<{ items: PullRequestResult[]; total: number }>(`/api/prs?user=${encodeURIComponent(username)}`).then((result) => {
      if (cancelled) return;
      setState(result.error ? { status: "error", error: result.error } : { status: "done", ...result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [username, reloadKey]);

  return { state, reload: () => setReloadKey((key) => key + 1) };
}
