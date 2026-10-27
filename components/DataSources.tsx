"use client";

import Link from "next/link";
import { useState } from "react";
import { refreshableYears, type GsocSnapshot } from "@/lib/gsoc";
import { shortDate } from "@/lib/format";
import { bundledGsoc, useGsoc } from "@/lib/useGsoc";
import { useApiStatus } from "@/lib/useApiStatus";
import { Badge, ExternalLink, Notice } from "./ui";

type Source = { name: string; provides: string; how: string; freshness: string; limits: string; link?: string };

/** Every platform the app combines, shown in Settings. */
export function DataSources() {
  const gsoc = useGsoc();
  const api = useApiStatus();

  const sources: Source[] = [
    {
      name: "GitHub",
      provides: "Issues, pull requests, repositories, your public PRs, and maintainer activity",
      how: "Official Search, REST, and GraphQL APIs",
      freshness: "Live. Cached 5 minutes for searches, up to a day for contributing guides.",
      limits: api?.authenticated
        ? "Token set: 30 searches a minute, 5,000 other requests an hour."
        : "No token: 10 searches a minute, 60 other requests an hour, shared by everyone on this server.",
      link: "https://docs.github.com/en/rest",
    },
    {
      name: "Remotive",
      provides: "Remote job listings on the Jobs page",
      how: "Official public API",
      freshness: "Cached 6 hours. Remotive shows listings here 24 hours after its own site.",
      limits: "At most 10 jobs per search. Remotive asks for no more than about 4 requests a day and a link back to each job.",
      link: "https://remotive.com/api-documentation",
    },
    {
      name: "Hacker News",
      provides: "Company posts from this month's “Ask HN: Who is hiring?” thread",
      how: "Official HN Search API by Algolia",
      freshness: "Cached 1 hour. Switches to the new thread when it is posted each month.",
      limits: "10,000 requests an hour.",
      link: "https://hn.algolia.com/api",
    },
    {
      name: "Google Summer of Code",
      provides: "Organization list behind the “Only GSoC organizations” filter on Repositories",
      how: "No public API. The list the GSoC website itself loads, fetched only when you press Refresh below.",
      freshness: `${gsoc.active.year} list, saved ${shortDate(gsoc.active.fetchedAt)}${gsoc.fromBrowser ? " in this browser" : " with the app"}. ${gsoc.active.orgs.length} organizations with a GitHub account.`,
      limits: "One request per refresh, cached for a day.",
      link: "https://summerofcode.withgoogle.com",
    },
    {
      name: "This browser",
      provides: "Your bookmarks, contributions, jobs, follow-ups, presets, and settings",
      how: "Local storage. Nothing is sent to a server.",
      freshness: "Saved as you go.",
      limits: "Only on this browser. Use Export below to back it up.",
    },
  ];

  return (
    <section id="data-sources" className="card space-y-4 scroll-mt-6">
      <div>
        <h2 className="font-semibold">Data sources</h2>
        <p className="muted text-sm">Everything in this app comes from these places. Results always link back to the original page.</p>
      </div>
      <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {sources.map((source) => (
          <li key={source.name} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
            <p className="font-medium">{source.link ? <ExternalLink href={source.link}>{source.name}</ExternalLink> : source.name}</p>
            <div className="space-y-0.5">
              <p>{source.provides}</p>
              <p className="muted text-xs">
                {source.how} · {source.freshness}
              </p>
              <p className="muted text-xs">{source.limits}</p>
            </div>
          </li>
        ))}
      </ul>
      <GsocRefresh active={gsoc.active} fromBrowser={gsoc.fromBrowser} onSaved={gsoc.save} />
    </section>
  );
}

function GsocRefresh({
  active,
  fromBrowser,
  onSaved,
}: {
  active: GsocSnapshot;
  fromBrowser: boolean;
  onSaved: (snapshot: GsocSnapshot | null) => void;
}) {
  const years = refreshableYears(active.year);
  const [year, setYear] = useState(new Date().getFullYear());
  const [state, setState] = useState<{ loading: boolean; message: string; tone: "info" | "warn" } | null>(null);

  async function refresh() {
    setState({ loading: true, message: "", tone: "info" });
    try {
      const response = await fetch("/api/gsoc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year }) });
      const body = await response.json();
      if (!response.ok) {
        setState({ loading: false, message: body?.error?.message || `Refresh failed (${response.status}).`, tone: "warn" });
        return;
      }
      const snapshot = body.snapshot as GsocSnapshot;
      onSaved(snapshot);
      setState({
        loading: false,
        tone: "info",
        message: `Loaded ${snapshot.orgs.length} GSoC ${snapshot.year} organizations and saved them in this browser.${
          body.savedToFile ? " Also wrote data/gsoc-orgs.json. Commit it so your deployed app ships the new list." : ""
        }`,
      });
    } catch {
      setState({ loading: false, message: "Could not reach the app server.", tone: "warn" });
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
      <p className="font-medium">Refresh the GSoC organization list</p>
      <p className="muted text-xs">
        Same as running <code>npm run update:gsoc</code>. Use it when a new GSoC year is announced, usually early in the year. If that year&apos;s list
        is not out yet, you keep the current one.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="GSoC year">
          {years.map((option) => (
            <option key={option} value={option}>
              GSoC {option}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" disabled={state?.loading} onClick={refresh}>
          {state?.loading ? "Refreshing…" : "Refresh GSoC list"}
        </button>
        {fromBrowser ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              onSaved(null);
              setState({ loading: false, tone: "info", message: `Back to the list bundled with the app (GSoC ${bundledGsoc.year}).` });
            }}
          >
            Use bundled list
          </button>
        ) : null}
        <Badge>{fromBrowser ? "Using the copy in this browser" : "Using the copy bundled with the app"}</Badge>
      </div>
      {state?.message ? <Notice tone={state.tone}>{state.message}</Notice> : null}
    </div>
  );
}

/** One-line version for the dashboard. */
export function DataSourcesSummary() {
  const gsoc = useGsoc().active;
  return (
    <p className="text-sm">
      <span className="muted">Data combined from </span>
      GitHub · Remotive · Hacker News · Google Summer of Code {gsoc.year} · <span className="muted">and your notes in this browser.</span>{" "}
      <Link href="/settings#data-sources" className="link">
        Details
      </Link>
    </p>
  );
}
