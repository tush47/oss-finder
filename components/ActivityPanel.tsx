"use client";

import { relativeTime } from "@/lib/format";
import type { ActivitySignals, ApiError } from "@/lib/github/types";
import { ExternalLink } from "./ui";

/** Shows the maintainer activity signals returned by /api/activity. */
export function ActivityPanel({
  signals,
  error,
  loading,
  hasIssue,
}: {
  signals?: ActivitySignals;
  error?: ApiError;
  loading: boolean;
  hasIssue: boolean;
}) {
  if (loading) return <p className="muted text-sm">Checking activity on GitHub…</p>;
  if (error) return <p className="text-sm text-red-700 dark:text-red-300">{error.message}</p>;
  if (!signals) return null;

  const rows: [string, string][] = [];
  if (signals.repo) {
    rows.push(["Last push to repo", relativeTime(signals.repo.pushedAt)]);
    rows.push(["Open issues and PRs", String(signals.repo.openIssues)]);
    if (signals.repo.archived) rows.push(["Status", "Archived, read-only"]);
  }
  if (signals.mergedPrs) {
    rows.push([
      "PRs merged in last 30 days",
      `${signals.mergedPrs.last30Days}${signals.mergedPrs.lastMergedAt ? `, latest ${relativeTime(signals.mergedPrs.lastMergedAt)}` : ""}`,
    ]);
  }
  if (signals.repoComments) {
    rows.push([
      "Issue comments in last 14 days",
      signals.repoComments.sampled === 30 && signals.repoComments.last14Days === 30
        ? "30 or more"
        : String(signals.repoComments.last14Days),
    ]);
    rows.push([
      "Latest maintainer comment in repo",
      signals.repoComments.lastMaintainerCommentAt
        ? relativeTime(signals.repoComments.lastMaintainerCommentAt)
        : `none in the latest ${signals.repoComments.sampled} comments`,
    ]);
  }
  if (hasIssue && signals.issue) {
    rows.push([
      "Maintainer replies on this issue",
      signals.issue.maintainerComments
        ? `${signals.issue.maintainerComments}, latest ${relativeTime(signals.issue.lastMaintainerCommentAt)}`
        : "none yet",
    ]);
    rows.push(["Last comment on this issue", signals.issue.lastCommentAt ? relativeTime(signals.issue.lastCommentAt) : "no comments"]);
  }

  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2">
        {signals.contributingUrl ? (
          <ExternalLink href={signals.contributingUrl}>Contributing guide</ExternalLink>
        ) : signals.contributingUrl === null ? (
          <span className="muted">No contributing guide found.</span>
        ) : null}
      </p>
      {signals.unavailable.length ? (
        <p className="muted mt-1 text-xs">Could not load: {signals.unavailable.join(", ")}.</p>
      ) : null}
      <p className="muted mt-2 text-xs">
        Maintainer means the commenter is the owner, an org member, or a collaborator. These are signs of recent attention, not a promise of a
        review or a response time.
      </p>
    </div>
  );
}
