"use client";

import { timeUntil } from "@/lib/format";
import { useApiStatus } from "@/lib/useApiStatus";
import { Badge } from "./ui";

export function ApiStatusNote({ detailed = false }: { detailed?: boolean }) {
  const status = useApiStatus();
  if (!status) return <p className="muted text-sm">Checking GitHub API status…</p>;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {status.authenticated ? <Badge tone="green">GitHub token configured</Badge> : <Badge tone="amber">No GitHub token</Badge>}
        {status.search ? (
          <span className="muted">
            Searches left: {status.search.remaining}/{status.search.limit} per minute
          </span>
        ) : null}
        {status.core ? (
          <span className="muted">
            · Other requests: {status.core.remaining}/{status.core.limit} per hour
            {status.core.remaining === 0 ? `, resets ${timeUntil(status.core.resetAt)}` : ""}
          </span>
        ) : null}
      </div>
      {status.error ? <p className="text-red-700 dark:text-red-300">{status.error}</p> : null}
      {detailed && !status.authenticated ? (
        <p className="muted">
          Browsing works without a token, but GitHub allows only 10 searches a minute and 60 other requests an hour, shared by everyone
          using this server. Add <code>GITHUB_TOKEN</code> to <code>.env.local</code> (or to the Vercel project settings) to get 30 searches a
          minute, 5,000 requests an hour, and the contributing guide filter. The README explains how.
        </p>
      ) : null}
    </div>
  );
}
