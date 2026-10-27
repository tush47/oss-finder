"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LANGUAGES, TOPICS } from "@/lib/constants";
import { fetchJson } from "@/lib/fetchJson";
import { daysAgoDate, defaultRepoFilters, encodeRepoFilters, pickGsocOrgs, type RepoFilters } from "@/lib/github/queries";
import type { ApiError, RepoSummary } from "@/lib/github/types";
import { KEYS, emptyLists, newId, rememberRepos, useSettings, useStored } from "@/lib/storage";
import { useActivity } from "@/lib/useActivity";
import { useGsoc } from "@/lib/useGsoc";
import { PresetBar } from "./PresetBar";
import { RepoCard } from "./RepoCard";
import { CardSkeleton, ChipGroup, EmptyState, ErrorMessage, ExternalLink, Notice, PageHeader, Pagination } from "./ui";

type ReposResponse = {
  items: RepoSummary[];
  total: number;
  totalReported?: number;
  page: number;
  perPage: number;
  gsocOrgs: string[];
  contributingCheck: "checked" | "needs_token" | "failed" | "skipped";
};

type Result = { status: "idle" | "loading" } | { status: "error"; error: ApiError } | { status: "done"; data: ReposResponse };

export function RepoExplorer() {
  const [settings, , settingsLoaded] = useSettings();
  const [savedRepos, setSavedRepos] = useStored(KEYS.savedRepos, emptyLists.savedRepos);
  const [followUps, setFollowUps] = useStored(KEYS.followUps, emptyLists.followUps);
  const [presets, setPresets] = useStored(KEYS.repoPresets, emptyLists.repoPresets);
  const [, setRecentRepos] = useStored(KEYS.recentRepos, emptyLists.recentRepos);

  const [draft, setDraft] = useState<RepoFilters>(defaultRepoFilters);
  const [applied, setApplied] = useState<RepoFilters | null>(null);
  const [result, setResult] = useState<Result>({ status: "idle" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activity = useActivity();
  const abortRef = useRef<AbortController | null>(null);
  const gsoc = useGsoc().active;
  const gsocOrgs = gsoc.orgs;
  // Read through a ref so loading a newer GSoC list does not re-run the current search.
  const gsocOrgsRef = useRef(gsocOrgs);
  gsocOrgsRef.current = gsocOrgs;

  // Start with your languages and projects pushed in the last 90 days.
  const startFilters = useCallback(
    (): RepoFilters => ({ ...defaultRepoFilters, languages: settings.languages, pushedAfter: daysAgoDate(90) }),
    [settings.languages],
  );

  useEffect(() => {
    if (!settingsLoaded || applied) return;
    const initial = startFilters();
    setDraft(initial);
    setApplied(initial);
  }, [settingsLoaded, applied, startFilters]);

  const runSearch = useCallback(
    async (filters: RepoFilters) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setResult({ status: "loading" });
      try {
        const params = encodeRepoFilters(filters);
        if (filters.gsoc) {
          const logins = pickGsocOrgs(gsocOrgsRef.current, filters.languages, filters.gsocOrg);
          if (!logins.length) {
            setResult({ status: "done", data: { items: [], total: 0, page: 1, perPage: 20, gsocOrgs: [], contributingCheck: "skipped" } });
            return;
          }
          params.set("gsocOrgs", logins.join(","));
        }
        const response = await fetchJson<ReposResponse>(`/api/repos?${params}`, controller.signal);
        if (response.error) {
          setResult({ status: "error", error: response.error });
          return;
        }
        setResult({ status: "done", data: response.data });
        const seen = response.data.items.map((repo) => ({ fullName: repo.fullName, url: repo.url, language: repo.language, stars: repo.stars }));
        if (seen.length) setRecentRepos((current) => rememberRepos(current, seen));
      } catch {
        // Aborted because a newer search started.
      }
    },
    [setRecentRepos],
  );

  useEffect(() => {
    if (applied) runSearch(applied);
  }, [applied, runSearch]);

  function search(next: RepoFilters) {
    setDraft(next);
    setApplied({ ...next });
    setFiltersOpen(false);
  }

  const set = (patch: Partial<RepoFilters>) => setDraft((current) => ({ ...current, ...patch }));
  const savedNames = new Set(savedRepos.map((repo) => repo.fullName));
  const followed = new Set(followUps.map((item) => item.name.toLowerCase()));
  const chosenOrg = gsocOrgs.find((org) => org.github === draft.gsocOrg);

  function toggleSave(repo: RepoSummary) {
    setSavedRepos((current) =>
      current.some((item) => item.fullName === repo.fullName)
        ? current.filter((item) => item.fullName !== repo.fullName)
        : [
            {
              fullName: repo.fullName,
              url: repo.url,
              description: repo.description,
              language: repo.language,
              stars: repo.stars,
              savedAt: new Date().toISOString(),
            },
            ...current,
          ],
    );
  }

  function follow(repo: RepoSummary) {
    setFollowUps((current) => [
      {
        id: newId(),
        name: repo.owner,
        kind: repo.ownerType === "Organization" ? "organization" : "maintainer",
        url: `https://github.com/${repo.owner}`,
        notes: `Found through ${repo.fullName}.`,
        nextStep: "",
        savedAt: new Date().toISOString(),
      },
      ...current,
    ]);
  }

  return (
    <>
      <PageHeader
        title="Repositories"
        description="Find active projects with issues for new contributors. Check the contributing guide before opening a PR."
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
          placeholder="Keywords in name, description, or README"
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
            <ChipGroup
              label="Language"
              options={LANGUAGES.map((lang) => ({ value: lang.label, label: lang.label }))}
              selected={draft.languages}
              onChange={(languages) => set({ languages })}
              hint="Matches any selected language."
            />
            <ChipGroup
              label="Topics"
              options={TOPICS.map((topic) => ({ value: topic.slug, label: topic.label }))}
              selected={draft.topics}
              onChange={(topics) => set({ topics })}
              hint="Repos must have every selected topic."
            />

            <label className="block">
              <span className="label">New contributor issues</span>
              <select className="input" value={draft.beginner} onChange={(event) => set({ beginner: event.target.value as RepoFilters["beginner"] })}>
                <option value="good-first">Has good first issues</option>
                <option value="help-wanted">Has help wanted issues</option>
                <option value="any">Any</option>
              </select>
            </label>

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
                <span className="label">Pushed after</span>
                <input className="input" type="date" value={draft.pushedAfter} onChange={(event) => set({ pushedAfter: event.target.value })} />
              </label>
            </div>

            <label className="block">
              <span className="label">Organization or maintainer</span>
              <input
                className="input"
                value={draft.owner}
                placeholder="e.g. supabase"
                disabled={draft.gsoc}
                onChange={(event) => set({ owner: event.target.value })}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.contributingOnly} onChange={(event) => set({ contributingOnly: event.target.checked })} />
              Has a contributing guide
            </label>

            <fieldset className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={draft.gsoc} onChange={(event) => set({ gsoc: event.target.checked })} />
                Only GSoC {gsoc.year} organizations
              </label>
              {draft.gsoc ? (
                <select className="input" value={draft.gsocOrg} onChange={(event) => set({ gsocOrg: event.target.value })} aria-label="GSoC organization">
                  <option value="">Orgs matching my languages (up to 20)</option>
                  {gsocOrgs.map((org) => (
                    <option key={org.slug} value={org.github}>
                      {org.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <p className="muted text-xs">
                {gsocOrgs.length} organizations with a GitHub account, from the GSoC {gsoc.year} list (saved {gsoc.fetchedAt}).{" "}
                <Link href="/settings#data-sources" className="link">
                  Refresh
                </Link>
              </p>
            </fieldset>

            <label className="block">
              <span className="label">Sort</span>
              <select className="input" value={draft.sort} onChange={(event) => set({ sort: event.target.value as RepoFilters["sort"] })}>
                <option value="stars">Most stars</option>
                <option value="updated">Recently updated</option>
                <option value="help-wanted-issues">Most help wanted issues</option>
              </select>
            </label>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary flex-1">
                Apply filters
              </button>
              <button type="button" className="btn" onClick={() => search(startFilters())}>
                Reset
              </button>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />
            <PresetBar presets={presets} current={{ ...draft, page: 1 }} onChange={setPresets} onApply={(filters) => search({ ...filters, page: 1 })} />
          </form>
        </aside>

        <section aria-live="polite" className="min-w-0 space-y-3">
          {draft.gsoc && chosenOrg ? (
            <div className="card text-sm">
              <p className="font-semibold">{chosenOrg.name}</p>
              <p className="muted mt-1">Tech: {chosenOrg.techTags.join(", ") || "not listed"}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <ExternalLink href={chosenOrg.gsocUrl}>GSoC page</ExternalLink>
                {chosenOrg.ideasUrl ? <ExternalLink href={chosenOrg.ideasUrl}>Project ideas</ExternalLink> : null}
                {chosenOrg.guidanceUrl ? <ExternalLink href={chosenOrg.guidanceUrl}>Contributor guidance</ExternalLink> : null}
                <ExternalLink href={`https://github.com/${chosenOrg.github}`}>GitHub</ExternalLink>
              </div>
            </div>
          ) : null}

          {result.status === "done" ? (
            <>
              <p className="text-sm">
                <span className="font-semibold">{(result.data.totalReported ?? result.data.total).toLocaleString("en-IN")}</span> repositories
                {result.data.gsocOrgs.length > 1 ? <span className="muted"> across {result.data.gsocOrgs.length} GSoC organizations</span> : null}
              </p>
              {applied?.contributingOnly && result.data.contributingCheck === "needs_token" ? (
                <Notice tone="warn">
                  The contributing guide filter needs a GITHUB_TOKEN on the server. Without one, use Check activity on a card to look up its
                  guide.
                </Notice>
              ) : null}
              {applied?.contributingOnly && result.data.contributingCheck === "checked" ? (
                <Notice>The contributing guide filter is applied to each page of results, so pages can have fewer than 20 repos.</Notice>
              ) : null}
            </>
          ) : null}

          {result.status === "loading" || result.status === "idle" ? <CardSkeleton /> : null}
          {result.status === "error" ? <ErrorMessage error={result.error} onRetry={() => applied && runSearch(applied)} /> : null}
          {result.status === "done" && result.data.items.length === 0 ? (
            <EmptyState title="No matching repositories">
              {applied?.gsoc && !result.data.gsocOrgs.length
                ? "No GSoC organization lists the selected languages. Pick an organization or clear the languages."
                : "Lower the minimum stars, remove a topic, or set new contributor issues to Any."}
            </EmptyState>
          ) : null}

          {result.status === "done"
            ? result.data.items.map((repo) => {
                const entry = activity.get(repo.fullName);
                return (
                  <RepoCard
                    key={repo.fullName}
                    repo={repo}
                    saved={savedNames.has(repo.fullName)}
                    following={followed.has(repo.owner.toLowerCase())}
                    activity={entry?.data}
                    activityError={entry?.error}
                    activityLoading={Boolean(entry?.loading)}
                    onSave={() => toggleSave(repo)}
                    onFollow={() => follow(repo)}
                    onCheckActivity={() => activity.check(repo.fullName)}
                  />
                );
              })
            : null}

          {result.status === "done" ? (
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
          ) : null}
        </section>
      </div>
    </>
  );
}
