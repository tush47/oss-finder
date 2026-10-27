"use client";

import { useEffect, useState } from "react";
import { FOLLOW_UP_KINDS, JOB_STATUSES, ROLE_SEARCHES } from "@/lib/constants";
import { fetchJson } from "@/lib/fetchJson";
import { relativeTime, shortDate } from "@/lib/format";
import type { ApiError } from "@/lib/github/types";
import { locationSignals, mentionsIndiaFriendlyLocation } from "@/lib/jobs/location";
import type { JobPosting } from "@/lib/jobs/types";
import { KEYS, emptyLists, newId, useStored } from "@/lib/storage";
import type { FollowUp, FollowUpKind, JobListing, JobStatus } from "@/lib/types";
import { Badge, CardSkeleton, EmptyState, ErrorMessage, ExternalLink, Notice, PageHeader } from "./ui";

type ProviderInfo = { id: string; name: string; homepage: string; notes: string };
type Tab = "search" | "applications" | "people";

const STATUS_LABELS: Record<JobStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  closed: "Closed",
};

const ELIGIBILITY_LABELS: Record<JobListing["indiaEligibility"], string> = {
  unknown: "India: not checked",
  confirmed: "India: confirmed on posting",
  "not-eligible": "India: not eligible",
};

export function Jobs() {
  const [tab, setTab] = useState<Tab>("search");
  const [jobs, setJobs] = useStored(KEYS.jobs, emptyLists.jobs);
  const [followUps, setFollowUps] = useStored(KEYS.followUps, emptyLists.followUps);

  function saveJob(job: Omit<JobListing, "id" | "savedAt">) {
    setJobs((current) => [{ ...job, id: newId(), savedAt: new Date().toISOString() }, ...current]);
  }

  function saveCompany(name: string, url: string, notes: string) {
    setFollowUps((current) => [
      { id: newId(), name, kind: "company", url, notes, nextStep: "", savedAt: new Date().toISOString() },
      ...current,
    ]);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "search", label: "Search listings" },
    { id: "applications", label: `My job list · ${jobs.length}` },
    { id: "people", label: `Companies & people · ${followUps.length}` },
  ];

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Search official job feeds, keep your own list of postings, and follow up with companies and maintainers you meet through open source."
      />
      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === item.id ? "border-emerald-600 text-emerald-800 dark:text-emerald-300" : "muted border-transparent hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <JobSearch savedUrls={new Set(jobs.map((job) => job.url))} followed={new Set(followUps.map((item) => item.name.toLowerCase()))} onSave={saveJob} onFollow={saveCompany} />
      ) : null}
      {tab === "applications" ? <JobList jobs={jobs} setJobs={setJobs} /> : null}
      {tab === "people" ? <FollowUpList items={followUps} setItems={setFollowUps} /> : null}
    </>
  );
}

function JobSearch({
  savedUrls,
  followed,
  onSave,
  onFollow,
}: {
  savedUrls: Set<string>;
  followed: Set<string>;
  onSave: (job: Omit<JobListing, "id" | "savedAt">) => void;
  onFollow: (name: string, url: string, notes: string) => void;
}) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [source, setSource] = useState("hn");
  const [query, setQuery] = useState("typescript");
  const [indiaOnly, setIndiaOnly] = useState(false);
  const [state, setState] = useState<{ status: "idle" | "loading" } | { status: "error"; error: ApiError } | { status: "done"; items: JobPosting[] }>({
    status: "idle",
  });

  useEffect(() => {
    fetchJson<{ providers: ProviderInfo[] }>("/api/jobs").then((result) => {
      if (result.data) setProviders(result.data.providers);
    });
    // Show results for the default role right away. HN results are cached for an hour.
    run();
    // Runs once on first load only.
  }, []);

  async function run(nextQuery = query, nextSource = source) {
    setState({ status: "loading" });
    const result = await fetchJson<{ items: JobPosting[] }>(`/api/jobs?source=${nextSource}&q=${encodeURIComponent(nextQuery)}`);
    setState(result.error ? { status: "error", error: result.error } : { status: "done", items: result.data.items });
  }

  const provider = providers.find((item) => item.id === source);
  const items =
    state.status === "done"
      ? state.items.filter((job) => !indiaOnly || mentionsIndiaFriendlyLocation(`${job.location || ""} ${job.title} ${job.excerpt}`))
      : [];

  return (
    <div className="space-y-4">
      <form
        className="card grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <label>
          <span className="label">Source</span>
          <select className="input" value={source} onChange={(event) => setSource(event.target.value)}>
            {(providers.length ? providers : [{ id: "hn", name: "HN Who is hiring" }, { id: "remotive", name: "Remotive" }]).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Keywords</span>
          <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. backend" />
        </label>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-3">
          <span className="muted text-xs">Roles:</span>
          {ROLE_SEARCHES.map((role) => (
            <button
              key={role}
              type="button"
              className={`chip ${query === role ? "chip-on" : ""}`}
              onClick={() => {
                setQuery(role);
                run(role);
              }}
            >
              {role}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" checked={indiaOnly} onChange={(event) => setIndiaOnly(event.target.checked)} />
          Only postings whose text mentions India, Worldwide, Anywhere, APAC, or Asia
        </label>
      </form>

      {provider ? (
        <Notice>
          {provider.notes} Source: <ExternalLink href={provider.homepage}>{provider.name}</ExternalLink>. Location words are read from the
          posting text. Confirm eligibility on the posting before you apply.
        </Notice>
      ) : null}

      {state.status === "idle" ? <EmptyState title="Pick a role or type keywords">Results come straight from the source. Nothing is invented or filled in.</EmptyState> : null}
      {state.status === "loading" ? <CardSkeleton count={3} /> : null}
      {state.status === "error" ? <ErrorMessage error={state.error} onRetry={() => run()} /> : null}
      {state.status === "done" && items.length === 0 ? (
        <EmptyState title="No postings found">Try another keyword or source{indiaOnly ? ", or turn off the location filter" : ""}.</EmptyState>
      ) : null}

      {items.map((job) => {
        const signals = locationSignals(`${job.location || ""} ${job.title} ${job.excerpt}`);
        return (
          <article key={job.id} className="card">
            <p className="muted text-xs">
              via {job.source}
              {job.publishedAt ? ` · posted ${relativeTime(job.publishedAt)}` : ""}
            </p>
            <h2 className="mt-1 font-semibold">
              <a href={job.url} target="_blank" rel="noreferrer" className="hover:underline">
                {job.title}
              </a>
            </h2>
            {job.company ? <p className="text-sm">{job.company}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {job.location ? <Badge tone="blue">Location (from source): {job.location}</Badge> : <Badge>Location: read the post</Badge>}
              {job.salary ? <Badge tone="green">Salary (from source): {job.salary}</Badge> : null}
              {signals.map((signal) => (
                <Badge key={signal} tone="violet">
                  mentions {signal}
                </Badge>
              ))}
            </div>
            {job.excerpt ? <p className="muted mt-2 text-sm">{job.excerpt}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <ExternalLink href={job.url} className="btn btn-primary">
                Open posting
              </ExternalLink>
              <button
                type="button"
                className="btn"
                disabled={savedUrls.has(job.url)}
                onClick={() =>
                  onSave({
                    title: job.title,
                    company: job.company || "",
                    url: job.url,
                    source: job.source,
                    locationNote: job.location || "",
                    indiaEligibility: "unknown",
                    status: "saved",
                    notes: "",
                  })
                }
              >
                {savedUrls.has(job.url) ? "Saved" : "Save to my list"}
              </button>
              {job.company ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={followed.has(job.company.toLowerCase())}
                  onClick={() => onFollow(job.company!, "", `Saw a ${job.title} posting via ${job.source}.`)}
                >
                  {followed.has(job.company.toLowerCase()) ? "Company saved" : "Save company"}
                </button>
              ) : null}
            </div>
          </article>
        );
      })}

      <details className="muted text-sm">
        <summary className="cursor-pointer">Want another job source?</summary>
        <p className="mt-2">
          Only sources with an official API or a permitted feed are built in. To add one, create a file in <code>lib/jobs/</code> that exports a{" "}
          <code>JobProvider</code> and add it to <code>lib/jobs/index.ts</code>. The README has a step-by-step example. For sites without an API,
          save postings by hand in My job list.
        </p>
      </details>
    </div>
  );
}

const blankJob = (): JobListing => ({
  id: "",
  title: "",
  company: "",
  url: "",
  source: "",
  locationNote: "",
  indiaEligibility: "unknown",
  status: "saved",
  notes: "",
  savedAt: "",
});

function JobList({ jobs, setJobs }: { jobs: JobListing[]; setJobs: (next: JobListing[] | ((current: JobListing[]) => JobListing[])) => void }) {
  const [editing, setEditing] = useState<JobListing | null>(null);
  const [indiaFilter, setIndiaFilter] = useState(false);

  function save(job: JobListing) {
    const next = { ...job, indiaEligibility: job.indiaEligibility || "unknown", id: job.id || newId(), savedAt: job.savedAt || new Date().toISOString() };
    setJobs((current) => (job.id ? current.map((item) => (item.id === job.id ? next : item)) : [next, ...current]));
    setEditing(null);
  }

  const shown = jobs.filter((job) => !indiaFilter || job.indiaEligibility === "confirmed");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={indiaFilter} onChange={(event) => setIndiaFilter(event.target.checked)} />
          Only roles I confirmed accept applicants from India
        </label>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(blankJob())}>
          Add job link
        </button>
      </div>

      {editing ? <JobForm initial={editing} onSave={save} onCancel={() => setEditing(null)} /> : null}

      {shown.length === 0 ? (
        <EmptyState title={jobs.length ? "No confirmed roles yet" : "No saved jobs yet"}>
          Save postings from Search listings, or add any job link by hand, from LinkedIn, a careers page, or a maintainer&apos;s tip.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((job) => (
            <li key={job.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <a href={job.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
                    {job.title || job.url}
                  </a>
                  <p className="muted text-sm">
                    {[job.company, job.source, job.savedAt ? `saved ${shortDate(job.savedAt)}` : ""].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <select
                  className="input w-auto"
                  aria-label="Application status"
                  value={job.status}
                  onChange={(event) => save({ ...job, status: event.target.value as JobStatus })}
                >
                  {JOB_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={job.indiaEligibility === "confirmed" ? "green" : job.indiaEligibility === "not-eligible" ? "red" : "neutral"}>
                  {ELIGIBILITY_LABELS[job.indiaEligibility || "unknown"]}
                </Badge>
                {job.locationNote ? <Badge tone="blue">{job.locationNote}</Badge> : null}
              </div>
              {job.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{job.notes}</p> : null}
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn" onClick={() => setEditing(job)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    if (window.confirm("Delete this job?")) setJobs((current) => current.filter((item) => item.id !== job.id));
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobForm({ initial, onSave, onCancel }: { initial: JobListing; onSave: (job: JobListing) => void; onCancel: () => void }) {
  const [job, setJob] = useState(initial);
  const set = (patch: Partial<JobListing>) => setJob((current) => ({ ...current, ...patch }));
  return (
    <form
      className="card grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(job);
      }}
    >
      <label className="sm:col-span-2">
        <span className="label">Job URL</span>
        <input className="input" type="url" required value={job.url} onChange={(event) => set({ url: event.target.value })} placeholder="https://…" />
      </label>
      <label>
        <span className="label">Title</span>
        <input className="input" value={job.title} onChange={(event) => set({ title: event.target.value })} />
      </label>
      <label>
        <span className="label">Company</span>
        <input className="input" value={job.company} onChange={(event) => set({ company: event.target.value })} />
      </label>
      <label>
        <span className="label">Source</span>
        <input className="input" value={job.source} placeholder="e.g. careers page, LinkedIn" onChange={(event) => set({ source: event.target.value })} />
      </label>
      <label>
        <span className="label">Status</span>
        <select className="input" value={job.status} onChange={(event) => set({ status: event.target.value as JobStatus })}>
          {JOB_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Location, as the posting says it</span>
        <input className="input" value={job.locationNote} placeholder="e.g. Remote, APAC" onChange={(event) => set({ locationNote: event.target.value })} />
      </label>
      <label>
        <span className="label">Accepts applicants from India?</span>
        <select
          className="input"
          value={job.indiaEligibility}
          onChange={(event) => set({ indiaEligibility: event.target.value as JobListing["indiaEligibility"] })}
        >
          <option value="unknown">Not checked yet</option>
          <option value="confirmed">Yes, confirmed on the posting</option>
          <option value="not-eligible">No</option>
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="label">Notes</span>
        <textarea className="input min-h-20" value={job.notes} onChange={(event) => set({ notes: event.target.value })} />
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

const blankFollowUp = (): FollowUp => ({ id: "", name: "", kind: "company", url: "", notes: "", nextStep: "", savedAt: "" });

function FollowUpList({ items, setItems }: { items: FollowUp[]; setItems: (next: FollowUp[] | ((current: FollowUp[]) => FollowUp[])) => void }) {
  const [editing, setEditing] = useState<FollowUp | null>(null);

  function save(item: FollowUp) {
    const next = { ...item, id: item.id || newId(), savedAt: item.savedAt || new Date().toISOString() };
    setItems((current) => (item.id ? current.map((row) => (row.id === item.id ? next : row)) : [next, ...current]));
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2">
        <p className="muted text-sm">Companies behind repos you like, and maintainers you have worked with. Use Follow up on a repository card to add one.</p>
        <button type="button" className="btn btn-primary shrink-0" onClick={() => setEditing(blankFollowUp())}>
          Add
        </button>
      </div>

      {editing ? (
        <form
          className="card grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save(editing);
          }}
        >
          <label>
            <span className="label">Name</span>
            <input className="input" required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
          </label>
          <label>
            <span className="label">Type</span>
            <select className="input" value={editing.kind} onChange={(event) => setEditing({ ...editing, kind: event.target.value as FollowUpKind })}>
              {FOLLOW_UP_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind[0].toUpperCase() + kind.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="label">Link (GitHub, website, or careers page)</span>
            <input className="input" type="url" value={editing.url} onChange={(event) => setEditing({ ...editing, url: event.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Relationship notes</span>
            <textarea
              className="input min-h-20"
              value={editing.notes}
              placeholder="PRs they reviewed, conversations, who introduced you…"
              onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Next step</span>
            <input className="input" value={editing.nextStep} onChange={(event) => setEditing({ ...editing, nextStep: event.target.value })} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="Nobody saved yet">When a maintainer reviews your PR or a company&apos;s repo stands out, save them here with a note.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{item.name}</p>
                <Badge>{item.kind}</Badge>
              </div>
              {item.url ? (
                <p className="mt-1 truncate text-sm">
                  <ExternalLink href={item.url}>{item.url.replace(/^https?:\/\//, "")}</ExternalLink>
                </p>
              ) : null}
              {item.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{item.notes}</p> : null}
              {item.nextStep ? (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Next:</span> {item.nextStep}
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
                    if (window.confirm(`Delete ${item.name}?`)) setItems((current) => current.filter((row) => row.id !== item.id));
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
