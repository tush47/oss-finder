"use client";

import { useState } from "react";
import { compact, relativeTime, shortDate } from "@/lib/format";
import type { ActivitySignals, ApiError, IssueResult } from "@/lib/github/types";
import type { IssueScore } from "@/lib/scoring";
import { ActivityPanel } from "./ActivityPanel";
import { Badge, ExternalLink } from "./ui";

function labelStyle(color: string) {
  const hex = /^[0-9a-f]{6}$/i.test(color) ? color : "888888";
  return { borderColor: `#${hex}`, backgroundColor: `#${hex}1f` };
}

export function IssueCard({
  issue,
  score,
  bookmarked,
  tracked,
  activity,
  activityError,
  activityLoading,
  onBookmark,
  onTrack,
  onCheckActivity,
}: {
  issue: IssueResult;
  score: IssueScore;
  bookmarked: boolean;
  tracked: boolean;
  activity?: ActivitySignals;
  activityError?: ApiError;
  activityLoading: boolean;
  onBookmark: () => void;
  onTrack: () => void;
  onCheckActivity: () => void;
}) {
  const [showScore, setShowScore] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const repo = issue.repo;

  return (
    <article className="card">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setShowScore((open) => !open)}
          aria-expanded={showScore}
          title="Priority score. Click for the breakdown."
          className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <span className="text-lg font-semibold leading-none tabular-nums">{score.total}</span>
          <span className="text-[10px] uppercase tracking-wide">score</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <a href={issue.repoUrl} target="_blank" rel="noreferrer" className="font-mono font-medium text-zinc-600 hover:underline dark:text-zinc-300">
              {issue.repoFullName}
            </a>
            {repo?.language ? <Badge tone="blue">{repo.language}</Badge> : null}
            {repo ? <span className="muted">★ {compact(repo.stars)}</span> : null}
            {repo?.pushedAt ? <span className="muted">pushed {relativeTime(repo.pushedAt)}</span> : null}
            {issue.isPullRequest ? <Badge tone="violet">Pull request</Badge> : null}
          </div>

          <h2 className="mt-1 text-base font-semibold leading-snug">
            <a href={issue.url} target="_blank" rel="noreferrer" className="hover:underline">
              {issue.title}
            </a>
          </h2>

          {issue.bodyExcerpt ? <p className="muted mt-1 text-sm">{issue.bodyExcerpt}</p> : <p className="muted mt-1 text-sm italic">No description.</p>}

          {issue.labels.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Labels">
              {issue.labels.map((label) => (
                <li key={label.name} className="rounded-full border px-2 py-0.5 text-xs" style={labelStyle(label.color)}>
                  {label.name}
                </li>
              ))}
            </ul>
          ) : null}

          {repo?.topics.length ? (
            <p className="muted mt-2 text-xs">Topics: {repo.topics.slice(0, 6).join(", ")}</p>
          ) : null}

          <p className="muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span>Opened {shortDate(issue.createdAt)}</span>
            <span>Updated {relativeTime(issue.updatedAt)}</span>
            <span>{issue.comments} comments</span>
            <span>{issue.assignees.length ? `Assigned to ${issue.assignees.join(", ")}` : "Unassigned"}</span>
          </p>
        </div>
      </div>

      {showScore ? (
        <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
          <ul className="space-y-1">
            {score.parts.map((part) => (
              <li key={part.label} className="flex justify-between gap-3">
                <span>
                  <span className="font-medium">{part.label}</span> <span className="muted">· {part.note}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {part.points}/{part.max}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <ExternalLink href={issue.url} className="btn btn-primary">
          Open on GitHub
        </ExternalLink>
        <button type="button" className="btn" aria-pressed={bookmarked} onClick={onBookmark}>
          {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
        </button>
        <button type="button" className="btn" disabled={tracked} onClick={onTrack}>
          {tracked ? "Tracked" : "Track"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          aria-expanded={showActivity}
          onClick={() => {
            if (!showActivity && !activity) onCheckActivity();
            setShowActivity((open) => !open);
          }}
        >
          {showActivity ? "Hide activity" : "Check activity"}
        </button>
      </div>

      {showActivity ? (
        <div className="mt-3">
          <ActivityPanel signals={activity} error={activityError} loading={activityLoading} hasIssue />
        </div>
      ) : null}
    </article>
  );
}
