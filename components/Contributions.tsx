"use client";

import Link from "next/link";
import { useState } from "react";
import { CONTRIBUTION_STATUSES } from "@/lib/constants";
import { relativeTime, shortDate } from "@/lib/format";
import type { PrStatus, PullRequestResult } from "@/lib/github/types";
import { PR_STATUS_LABELS } from "@/lib/prStatus";
import { KEYS, emptyLists, newId, useSettings, useStored } from "@/lib/storage";
import type { Contribution, ContributionStatus } from "@/lib/types";
import { usePullRequests } from "@/lib/usePullRequests";
import { Badge, CardSkeleton, EmptyState, ErrorMessage, ExternalLink, PageHeader } from "./ui";

const STATUS_LABELS: Record<ContributionStatus, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  open: "PR open",
  merged: "Merged",
  closed: "Closed",
};

const STATUS_TONES: Record<ContributionStatus, "neutral" | "blue" | "amber" | "green" | "red"> = {
  planned: "neutral",
  "in-progress": "amber",
  open: "blue",
  merged: "green",
  closed: "red",
};

const PR_TONES: Record<PrStatus, "neutral" | "blue" | "green" | "red"> = { draft: "neutral", open: "blue", merged: "green", closed: "red" };

const blank = (): Contribution => ({
  id: "",
  repo: "",
  issueUrl: "",
  prUrl: "",
  status: "planned",
  notes: "",
  startedAt: new Date().toISOString().slice(0, 10),
  nextAction: "",
  updatedAt: "",
});

function repoFromUrl(url: string): string {
  const match = /github\.com\/([^/]+\/[^/#?]+)/.exec(url);
  return match ? match[1] : "";
}

export function Contributions() {
  const [settings] = useSettings();
  const [items, setItems] = useStored(KEYS.contributions, emptyLists.contributions);
  const [editing, setEditing] = useState<Contribution | null>(null);
  const [statusFilter, setStatusFilter] = useState<ContributionStatus | "all">("all");
  const prs = usePullRequests(settings.githubUsername);

  const githubByUrl = new Map<string, PullRequestResult>(prs.state.status === "done" ? prs.state.items.map((pr) => [pr.url, pr]) : []);
  const shown = items.filter((item) => statusFilter === "all" || item.status === statusFilter);

  function save(record: Contribution) {
    const now = new Date().toISOString();
    const repo = record.repo.trim() || repoFromUrl(record.prUrl) || repoFromUrl(record.issueUrl);
    const next = { ...record, repo, updatedAt: now, id: record.id || newId() };
    setItems((current) => (record.id ? current.map((item) => (item.id === record.id ? next : item)) : [next, ...current]));
    setEditing(null);
  }

  function importPr(pr: PullRequestResult) {
    const status: ContributionStatus = pr.status === "merged" ? "merged" : pr.status === "closed" ? "closed" : "open";
    save({ ...blank(), repo: pr.repoFullName, prUrl: pr.url, status, notes: pr.title, startedAt: pr.createdAt.slice(0, 10) });
  }

  return (
    <>
      <PageHeader
        title="My Contributions"
        description="Track issues you plan to work on and the pull requests you open. Records are saved in this browser."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing(blank())}>
            Add contribution
          </button>
        }
      />

      {editing ? <ContributionForm initial={editing} onSave={save} onCancel={() => setEditing(null)} /> : null}

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {(["all", ...CONTRIBUTION_STATUSES] as const).map((status) => {
            const count = status === "all" ? items.length : items.filter((item) => item.status === status).length;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter === status}
                className={`chip ${statusFilter === status ? "chip-on" : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "All" : STATUS_LABELS[status]} · {count}
              </button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <EmptyState title={items.length ? "Nothing with this status" : "No contributions yet"}>
            Use Track on an issue in <Link className="link" href="/issues">Find Issues</Link>, add one by hand, or import a PR from GitHub below.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {shown.map((item) => {
              const fromGithub = item.prUrl ? githubByUrl.get(item.prUrl) : undefined;
              return (
                <li key={item.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{item.repo || "Repository not set"}</p>
                      {item.notes ? <p className="mt-1 text-sm">{item.notes}</p> : null}
                    </div>
                    <select
                      className="input w-auto"
                      aria-label="Status"
                      value={item.status}
                      onChange={(event) => save({ ...item, status: event.target.value as ContributionStatus })}
                    >
                      {CONTRIBUTION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                    {fromGithub ? (
                      <span className="text-xs">
                        GitHub: <Badge tone={PR_TONES[fromGithub.status]}>{PR_STATUS_LABELS[fromGithub.status]}</Badge>
                      </span>
                    ) : null}
                    {item.issueUrl ? <ExternalLink href={item.issueUrl}>Issue</ExternalLink> : null}
                    {item.prUrl ? <ExternalLink href={item.prUrl}>Pull request</ExternalLink> : null}
                    {item.startedAt ? <span className="muted text-xs">Started {shortDate(item.startedAt)}</span> : null}
                  </div>
                  {item.nextAction ? (
                    <p className="mt-2 text-sm">
                      <span className="font-medium">Next:</span> {item.nextAction}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="btn" onClick={() => setEditing(item)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        if (window.confirm("Delete this contribution record?")) setItems((current) => current.filter((row) => row.id !== item.id));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">My public pull requests on GitHub</h2>
            <p className="muted text-sm">
              {settings.githubUsername ? (
                <>
                  The 100 most recently updated PRs by{" "}
                  <ExternalLink href={`https://github.com/${settings.githubUsername}`}>{settings.githubUsername}</ExternalLink>. Closed PRs count as
                  merged only when GitHub reports a merge date.
                </>
              ) : (
                <>
                  Add your GitHub username in <Link className="link" href="/settings">Settings</Link> to load them.
                </>
              )}
            </p>
          </div>
          {settings.githubUsername ? (
            <button type="button" className="btn" onClick={prs.reload}>
              Refresh
            </button>
          ) : null}
        </div>

        {prs.state.status === "loading" ? <CardSkeleton count={2} /> : null}
        {prs.state.status === "error" ? <ErrorMessage error={prs.state.error} onRetry={prs.reload} /> : null}
        {prs.state.status === "done" ? <PullRequestList items={prs.state.items} trackedUrls={new Set(items.map((item) => item.prUrl))} onImport={importPr} /> : null}
      </section>
    </>
  );
}

function PullRequestList({
  items,
  trackedUrls,
  onImport,
}: {
  items: PullRequestResult[];
  trackedUrls: Set<string>;
  onImport: (pr: PullRequestResult) => void;
}) {
  if (!items.length) return <EmptyState title="No public pull requests found">GitHub search shows only PRs in public repositories.</EmptyState>;
  const counts = (["merged", "open", "draft", "closed"] as const).map((status) => [status, items.filter((pr) => pr.status === status).length] as const);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {counts.map(([status, count]) => (
          <Badge key={status} tone={PR_TONES[status]}>
            {PR_STATUS_LABELS[status]}: {count}
          </Badge>
        ))}
      </div>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {items.map((pr) => (
          <li key={pr.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <a href={pr.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                {pr.title}
              </a>
              <p className="muted text-xs">
                <span className="font-mono">{pr.repoFullName}</span> · updated {relativeTime(pr.updatedAt)}
                {pr.mergedAt ? ` · merged ${shortDate(pr.mergedAt)}` : pr.closedAt ? ` · closed ${shortDate(pr.closedAt)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={PR_TONES[pr.status]}>{PR_STATUS_LABELS[pr.status]}</Badge>
              <button type="button" className="btn" disabled={trackedUrls.has(pr.url)} onClick={() => onImport(pr)}>
                {trackedUrls.has(pr.url) ? "Tracked" : "Track"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function ContributionForm({ initial, onSave, onCancel }: { initial: Contribution; onSave: (record: Contribution) => void; onCancel: () => void }) {
  const [record, setRecord] = useState(initial);
  const set = (patch: Partial<Contribution>) => setRecord((current) => ({ ...current, ...patch }));

  return (
    <form
      className="card mb-6 grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(record);
      }}
    >
      <h2 className="text-base font-semibold sm:col-span-2">{initial.id ? "Edit contribution" : "Add contribution"}</h2>
      <label>
        <span className="label">Repository</span>
        <input className="input" value={record.repo} placeholder="owner/name (filled from URLs if empty)" onChange={(event) => set({ repo: event.target.value })} />
      </label>
      <label>
        <span className="label">Status</span>
        <select className="input" value={record.status} onChange={(event) => set({ status: event.target.value as ContributionStatus })}>
          {CONTRIBUTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Issue URL</span>
        <input className="input" type="url" value={record.issueUrl} placeholder="https://github.com/…/issues/123" onChange={(event) => set({ issueUrl: event.target.value })} />
      </label>
      <label>
        <span className="label">PR URL</span>
        <input className="input" type="url" value={record.prUrl} placeholder="https://github.com/…/pull/456" onChange={(event) => set({ prUrl: event.target.value })} />
      </label>
      <label>
        <span className="label">Date started</span>
        <input className="input" type="date" value={record.startedAt} onChange={(event) => set({ startedAt: event.target.value })} />
      </label>
      <label>
        <span className="label">Next action</span>
        <input className="input" value={record.nextAction} placeholder="e.g. Reply to review comments" onChange={(event) => set({ nextAction: event.target.value })} />
      </label>
      <label className="sm:col-span-2">
        <span className="label">Notes</span>
        <textarea className="input min-h-20" value={record.notes} onChange={(event) => set({ notes: event.target.value })} />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-primary">
          Save
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
