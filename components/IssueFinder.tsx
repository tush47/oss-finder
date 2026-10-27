"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LABELS, LANGUAGES, TOPICS } from "@/lib/constants";
import { fetchJson } from "@/lib/fetchJson";
import { defaultIssueFilters, encodeIssueFilters, type IssueFilters } from "@/lib/github/queries";
import type { ApiError, IssueResult } from "@/lib/github/types";
import { SCORE_EXPLANATION, scoreIssue } from "@/lib/scoring";
import { KEYS, emptyLists, emptySearchStats, newId, rememberRepos, useSettings, useStored } from "@/lib/storage";
import type { SearchStats } from "@/lib/types";
import { useActivity } from "@/lib/useActivity";
import { IssueCard } from "./IssueCard";
import { PresetBar } from "./PresetBar";
import { CardSkeleton, ChipGroup, EmptyState, ErrorMessage, Notice, PageHeader, Pagination } from "./ui";

type IssuesResponse = {
  items: IssueResult[];
  total: number;
  totalReported?: number;
  incomplete?: boolean;
  page: number;
  perPage: number;
  scope: { repoCount: number; matchingRepos: number } | null;
  query: string;
};

type Result = { status: "idle" | "loading" } | { status: "error"; error: ApiError } | { status: "done"; data: IssuesResponse };

export function IssueFinder() {
  const params = useSearchParams();
  const [settings, , settingsLoaded] = useSettings();
  const [bookmarks, setBookmarks] = useStored(KEYS.bookmarks, emptyLists.bookmarks);
  const [contributions, setContributions] = useStored(KEYS.contributions, emptyLists.contributions);
  const [presets, setPresets] = useStored(KEYS.issuePresets, emptyLists.issuePresets);
  const [, setRecentRepos] = useStored(KEYS.recentRepos, emptyLists.recentRepos);
  const [, setStats] = useStored<SearchStats>(KEYS.searchStats, emptySearchStats);

  const [draft, setDraft] = useState<IssueFilters>(defaultIssueFilters);
  const [applied, setApplied] = useState<IssueFilters | null>(null);
  const [result, setResult] = useState<Result>({ status: "idle" });
  const [order, setOrder] = useState<"github" | "score">("github");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activity = useActivity();
  const abortRef = useRef<AbortController | null>(null);

  // Start with the language from the URL (dashboard quick filters) or your preferred languages.
  useEffect(() => {
    if (!settingsLoaded || applied) return;
    const fromUrl = params.get("language");
    const initial = { ...defaultIssueFilters, languages: fromUrl ? [fromUrl] : settings.languages };
    setDraft(initial);
    setApplied(initial);
  }, [settingsLoaded, applied, params, settings.languages]);

  const runSearch = useCallback(
    async (filters: IssueFilters) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setResult({ status: "loading" });
      try {
        const response = await fetchJson<IssuesResponse>(`/api/issues?${encodeIssueFilters(filters)}`, controller.signal);
        if (response.error) {
          setResult({ status: "error", error: response.error });
          return;
        }
        setResult({ status: "done", data: response.data });
        setStats({ issueTotal: response.data.totalReported ?? response.data.total, searchedAt: new Date().toISOString() });
        const repos = response.data.items.flatMap((issue) =>
          issue.repo ? [{ fullName: issue.repo.fullName, url: issue.repo.url, language: issue.repo.language, stars: issue.repo.stars }] : [],
        );
        if (repos.length) setRecentRepos((current) => rememberRepos(current, repos));
      } catch {
        // Aborted because a newer search started.
      }
    },
    [setRecentRepos, setStats],
  );

  useEffect(() => {
    if (applied) runSearch(applied);
  }, [applied, runSearch]);

  function search(next: IssueFilters) {
    setDraft(next);
    setApplied({ ...next });
    setFiltersOpen(false);
  }

  const prefs = { languages: settings.languages, topics: settings.topics };
  const rows = useMemo(() => {
    if (result.status !== "done") return [];
    const scored = result.data.items.map((issue) => ({
      issue,
      score: scoreIssue(issue, prefs, activity.get(issue.repoFullName, issue.number)?.data),
    }));
    if (order === "score") scored.sort((a, b) => b.score.total - a.score.total);
    return scored;
    // prefs is rebuilt each render from settings; its fields are the real dependencies.
  }, [result, order, settings.languages, settings.topics, activity]);

  const bookmarkedUrls = new Set(bookmarks.map((bookmark) => bookmark.url));
  const trackedUrls = new Set(contributions.map((item) => item.issueUrl));

  function toggleBookmark(issue: IssueResult) {
    setBookmarks((current) =>
      current.some((item) => item.url === issue.url)
        ? current.filter((item) => item.url !== issue.url)
        : [
            {
              url: issue.url,
              title: issue.title,
              repoFullName: issue.repoFullName,
              labels: issue.labels.map((label) => label.name),
              isPullRequest: issue.isPullRequest,
              savedAt: new Date().toISOString(),
            },
            ...current,
          ],
    );
  }

  function track(issue: IssueResult) {
    const now = new Date().toISOString();
    setContributions((current) => [
      {
        id: newId(),
        repo: issue.repoFullName,
        issueUrl: issue.isPullRequest ? "" : issue.url,
        prUrl: issue.isPullRequest ? issue.url : "",
        status: "planned",
        notes: issue.title,
        startedAt: now.slice(0, 10),
        nextAction: "Read the issue and comment before starting",
        updatedAt: now,
      },
      ...current,
    ]);
  }

  const set = (patch: Partial<IssueFilters>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <>
      <PageHeader
        title="Find Issues"
        description="Search open GitHub issues and pull requests. Open the original issue and read it before you start work."
        actions={
          <button type="button" className="btn lg:hidden" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            {filtersOpen ? "Hide filters" : "Filters"}
          </button>
        }
      />

      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search({ ...draft, page: 1 });
        }}
      >
        <input
          className="input"
          type="search"
          value={draft.keywords}
          placeholder="Keywords, e.g. timeout, docs, parser"
          aria-label="Search keywords"
          onChange={(event) => set({ keywords: event.target.value })}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className={`${filtersOpen ? "block" : "hidden"} lg:block`}>
          <form
            className="card space-y-4 lg:sticky lg:top-6"
            onSubmit={(event) => {
              event.preventDefault();
              search({ ...draft, page: 1 });
            }}
          >
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800" role="group" aria-label="Result type">
              {(["issue", "pr"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={draft.kind === kind}
                  onClick={() => set({ kind })}
                  className={`flex-1 rounded-md px-2 py-1 text-sm font-medium ${draft.kind === kind ? "bg-white shadow-sm dark:bg-zinc-950" : "muted"}`}
                >
                  {kind === "issue" ? "Issues" : "Pull requests"}
                </button>
              ))}
            </div>

            <ChipGroup
              label="Language"
              options={LANGUAGES.map((lang) => ({ value: lang.label, label: lang.label }))}
              selected={draft.languages}
              onChange={(languages) => set({ languages })}
              hint="Matches any selected language."
            />
            <ChipGroup
              label="Labels"
              options={LABELS.map((label) => ({ value: label, label }))}
              selected={draft.labels}
              onChange={(labels) => set({ labels })}
              hint="Matches any selected label."
            />
            <ChipGroup
              label="Repo topics"
              options={TOPICS.map((topic) => ({ value: topic.slug, label: topic.label }))}
              selected={draft.topics}
              onChange={(topics) => set({ topics })}
              hint="Repos must have every selected topic. GitHub cannot match any-of for topics."
            />

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">Min stars</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={50}
                  value={draft.minStars || ""}
                  placeholder="0"
                  onChange={(event) => set({ minStars: Math.max(0, Number(event.target.value) || 0) })}
                />
              </label>
              <label>
                <span className="label">Owner or org</span>
                <input className="input" value={draft.owner} placeholder="e.g. vercel" onChange={(event) => set({ owner: event.target.value })} />
              </label>
              <label>
                <span className="label">Issue created after</span>
                <input className="input" type="date" value={draft.createdAfter} onChange={(event) => set({ createdAfter: event.target.value })} />
              </label>
              <label>
                <span className="label">Repo pushed after</span>
                <input className="input" type="date" value={draft.pushedAfter} onChange={(event) => set({ pushedAfter: event.target.value })} />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.unassigned} onChange={(event) => set({ unassigned: event.target.checked })} />
              Unassigned only
            </label>

            <label className="block">
              <span className="label">Sort</span>
              <select className="input" value={draft.sort} onChange={(event) => set({ sort: event.target.value as IssueFilters["sort"] })}>
                <option value="updated">Recently updated</option>
                <option value="created">Recently created</option>
              </select>
            </label>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary flex-1">
                Apply filters
              </button>
              <button type="button" className="btn" onClick={() => search({ ...defaultIssueFilters, languages: settings.languages })}>
                Reset
              </button>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />
            <PresetBar presets={presets} current={{ ...draft, page: 1 }} onChange={setPresets} onApply={(filters) => search({ ...filters, page: 1 })} />
          </form>
        </aside>

        <section aria-live="polite" className="min-w-0">
          <ResultSummary result={result} order={order} onOrder={setOrder} />

          {result.status === "loading" || result.status === "idle" ? <CardSkeleton /> : null}
          {result.status === "error" ? <ErrorMessage error={result.error} onRetry={() => applied && runSearch(applied)} /> : null}
          {result.status === "done" && rows.length === 0 ? (
            <EmptyState title="No matching issues">
              {result.data.scope?.repoCount === 0
                ? "No repositories match the stars, topics, and last-pushed filters. Lower the minimum stars or remove a topic."
                : "Try fewer labels, another language, or turn off Unassigned only."}
            </EmptyState>
          ) : null}

          {result.status === "done" ? (
            <div className="space-y-3">
              {rows.map(({ issue, score }) => {
                const entry = activity.get(issue.repoFullName, issue.number);
                return (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    score={score}
                    bookmarked={bookmarkedUrls.has(issue.url)}
                    tracked={trackedUrls.has(issue.url) || contributions.some((item) => item.prUrl === issue.url)}
                    activity={entry?.data}
                    activityError={entry?.error}
                    activityLoading={Boolean(entry?.loading)}
                    onBookmark={() => toggleBookmark(issue)}
                    onTrack={() => track(issue)}
                    onCheckActivity={() => activity.check(issue.repoFullName, issue.number)}
                  />
                );
              })}
              <Pagination
                page={result.data.page}
                perPage={result.data.perPage}
                total={result.data.total}
                onPage={(page) => {
                  if (!applied) return;
                  search({ ...applied, page });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function ResultSummary({ result, order, onOrder }: { result: Result; order: "github" | "score"; onOrder: (order: "github" | "score") => void }) {
  if (result.status !== "done") return null;
  const { data } = result;
  const reported = data.totalReported ?? data.total;
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">{reported.toLocaleString("en-IN")}</span> results
          {reported > data.total ? <span className="muted"> · GitHub shows the first 1,000</span> : null}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="muted">Order this page by</span>
          <select className="input w-auto" value={order} onChange={(event) => onOrder(event.target.value as "github" | "score")}>
            <option value="github">GitHub sort</option>
            <option value="score">Score</option>
          </select>
        </label>
      </div>
      {data.scope ? (
        <Notice>
          Searched inside the {data.scope.repoCount} most-starred repos that match your stars, topics, and last-pushed filters (out of{" "}
          {data.scope.matchingRepos.toLocaleString("en-IN")}). GitHub issue search cannot filter by those directly.
        </Notice>
      ) : null}
      {data.incomplete ? <Notice tone="warn">GitHub timed out and returned partial results. Try a narrower search.</Notice> : null}
      <details className="muted text-xs">
        <summary className="cursor-pointer">How the score works</summary>
        <p className="mt-1">{SCORE_EXPLANATION}</p>
      </details>
    </div>
  );
}
