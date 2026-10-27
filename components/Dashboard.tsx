"use client";

import Link from "next/link";
import { LANGUAGES } from "@/lib/constants";
import { compact, relativeTime } from "@/lib/format";
import { KEYS, emptyLists, emptySearchStats, useSettings, useStored } from "@/lib/storage";
import type { SearchStats } from "@/lib/types";
import { usePullRequests } from "@/lib/usePullRequests";
import { ApiStatusNote } from "./ApiStatusNote";
import { DataSourcesSummary } from "./DataSources";
import { Badge, EmptyState, ExternalLink, PageHeader, StatCard } from "./ui";

export function Dashboard() {
  const [settings, , loaded] = useSettings();
  const [bookmarks, setBookmarks] = useStored(KEYS.bookmarks, emptyLists.bookmarks);
  const [recentRepos] = useStored(KEYS.recentRepos, emptyLists.recentRepos);
  const [savedRepos] = useStored(KEYS.savedRepos, emptyLists.savedRepos);
  const [contributions] = useStored(KEYS.contributions, emptyLists.contributions);
  const [stats] = useStored<SearchStats>(KEYS.searchStats, emptySearchStats);
  const prs = usePullRequests(loaded ? settings.githubUsername : "");

  const active = contributions.filter((item) => item.status === "planned" || item.status === "in-progress" || item.status === "open").length;
  const prCounts =
    prs.state.status === "done"
      ? {
          merged: prs.state.items.filter((pr) => pr.status === "merged").length,
          open: prs.state.items.filter((pr) => pr.status === "open" || pr.status === "draft").length,
          closed: prs.state.items.filter((pr) => pr.status === "closed").length,
        }
      : null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your open-source search, bookmarks, and pull requests in one place."
        actions={
          settings.githubUsername ? (
            <ExternalLink href={`https://github.com/${settings.githubUsername}`} className="btn">
              @{settings.githubUsername} on GitHub
            </ExternalLink>
          ) : (
            <Link href="/settings" className="btn">
              Add your GitHub username
            </Link>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Issues found"
          value={stats.issueTotal === null ? "—" : stats.issueTotal.toLocaleString("en-IN")}
          hint={stats.searchedAt ? `Last search ${relativeTime(stats.searchedAt)}` : "Run a search in Find Issues"}
        />
        <StatCard label="Bookmarked issues" value={bookmarks.length} hint={`${savedRepos.length} saved repositories`} />
        <StatCard label="Tracked contributions" value={contributions.length} hint={`${active} planned or in progress`} />
        <StatCard
          label="My pull requests"
          value={prCounts ? prCounts.merged : "—"}
          hint={
            prCounts
              ? `merged · ${prCounts.open} open · ${prCounts.closed} closed without merge`
              : prs.state.status === "loading"
                ? "Loading from GitHub…"
                : prs.state.status === "error"
                  ? prs.state.error.message
                  : "Set your username in Settings"
          }
        />
      </div>

      <section className="mt-6">
        <h2 className="label">Quick filters</h2>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <Link
              key={lang.label}
              href={`/issues?language=${encodeURIComponent(lang.label)}`}
              className={`chip ${settings.languages.includes(lang.label) ? "chip-on" : ""}`}
            >
              {lang.label} issues
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Bookmarked issues</h2>
            <Link href="/issues" className="link text-sm">
              Find more
            </Link>
          </div>
          {bookmarks.length === 0 ? (
            <EmptyState title="No bookmarks yet">Bookmark issues from Find Issues to keep them here.</EmptyState>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {bookmarks.slice(0, 8).map((bookmark) => (
                <li key={bookmark.url} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <a href={bookmark.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                      {bookmark.title}
                    </a>
                    <p className="muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                      <span className="font-mono">{bookmark.repoFullName}</span>
                      {bookmark.isPullRequest ? <Badge tone="violet">PR</Badge> : null}
                      <span>saved {relativeTime(bookmark.savedAt)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost shrink-0"
                    aria-label={`Remove bookmark ${bookmark.title}`}
                    onClick={() => setBookmarks((current) => current.filter((item) => item.url !== bookmark.url))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Recently discovered repositories</h2>
            <Link href="/repos" className="link text-sm">
              Explore
            </Link>
          </div>
          {recentRepos.length === 0 ? (
            <EmptyState title="Nothing discovered yet">Repositories from your searches will show up here.</EmptyState>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {recentRepos.slice(0, 8).map((repo) => (
                <li key={repo.fullName} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <a href={repo.url} target="_blank" rel="noreferrer" className="min-w-0 truncate font-mono hover:underline">
                    {repo.fullName}
                  </a>
                  <span className="muted shrink-0 text-xs">
                    {repo.language ? `${repo.language} · ` : ""}★ {compact(repo.stars)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-6 space-y-3">
        <DataSourcesSummary />
        <ApiStatusNote />
      </section>
    </>
  );
}
