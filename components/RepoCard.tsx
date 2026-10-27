"use client";

import { useState } from "react";
import { compact, relativeTime } from "@/lib/format";
import type { ActivitySignals, ApiError, RepoSummary } from "@/lib/github/types";
import { ActivityPanel } from "./ActivityPanel";
import { Badge, ExternalLink } from "./ui";

export function RepoCard({
  repo,
  saved,
  following,
  activity,
  activityError,
  activityLoading,
  onSave,
  onFollow,
  onCheckActivity,
}: {
  repo: RepoSummary;
  saved: boolean;
  following: boolean;
  activity?: ActivitySignals;
  activityError?: ApiError;
  activityLoading: boolean;
  onSave: () => void;
  onFollow: () => void;
  onCheckActivity: () => void;
}) {
  const [showActivity, setShowActivity] = useState(false);
  const beginnerIssues = `${repo.url}/issues?q=${encodeURIComponent('is:issue is:open no:assignee label:"good first issue"')}`;
  const contributing = repo.contributingUrl ?? activity?.contributingUrl;

  return (
    <article className="card">
      <div className="flex items-start gap-3">
        {repo.avatarUrl ? (
          <img src={`${repo.avatarUrl}&s=64`} alt="" width={32} height={32} className="mt-0.5 h-8 w-8 rounded-md" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-base font-semibold">
            <a href={repo.url} target="_blank" rel="noreferrer" className="hover:underline">
              <span className="muted font-normal">{repo.owner}/</span>
              {repo.fullName.split("/")[1]}
            </a>
          </h2>
          <p className="mt-1 text-sm">{repo.description || <span className="muted italic">No description.</span>}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {repo.language ? <Badge tone="blue">{repo.language}</Badge> : null}
            <span>★ {compact(repo.stars)}</span>
            <span className="muted">pushed {relativeTime(repo.pushedAt)}</span>
            <span className="muted" title="GitHub counts open issues and open pull requests together">
              {compact(repo.openIssues)} open issues + PRs
            </span>
            {repo.license ? <span className="muted">{repo.license}</span> : null}
            {repo.ownerType === "Organization" ? <Badge>Organization</Badge> : null}
            {repo.archived ? <Badge tone="red">Archived</Badge> : null}
          </div>
          {repo.topics.length ? <p className="muted mt-2 text-xs">Topics: {repo.topics.slice(0, 8).join(", ")}</p> : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <ExternalLink href={beginnerIssues}>Good first issues</ExternalLink>
        <ExternalLink href={`${repo.url}/issues`}>All issues</ExternalLink>
        {contributing ? <ExternalLink href={contributing}>Contributing guide</ExternalLink> : null}
        {contributing === null ? <span className="muted text-xs">No contributing guide found</span> : null}
        <ExternalLink href={repo.url}>GitHub</ExternalLink>
        {repo.homepage ? <ExternalLink href={repo.homepage}>Website</ExternalLink> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn" aria-pressed={saved} onClick={onSave}>
          {saved ? "★ Saved" : "☆ Save repo"}
        </button>
        <button type="button" className="btn" disabled={following} onClick={onFollow}>
          {following ? `Following ${repo.owner}` : `Follow up with ${repo.owner}`}
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
          <ActivityPanel signals={activity} error={activityError} loading={activityLoading} hasIssue={false} />
        </div>
      ) : null}
    </article>
  );
}
