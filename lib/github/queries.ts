// Builds GitHub search query strings from filter objects.
// These are plain functions with no network calls, so they are easy to test (see tests/queries.test.ts).
//
// GitHub search rules this file relies on (checked against the live API):
// - Several language: qualifiers match ANY of the languages.
// - Several topic: qualifiers match repos with ALL of the topics. GitHub has no OR for qualifiers.
// - Several repo: or user: qualifiers match ANY of them.
// - label:"a","b" matches issues with either label.
// - Issue search cannot filter by stars, topics, or last push. For those we first search
//   repositories, then search issues inside the top results (see needsRepoScope).

import { GSOC_ORG_LIMIT, LANGUAGES } from "../constants";

export type IssueFilters = {
  kind: "issue" | "pr";
  languages: string[];
  topics: string[];
  labels: string[];
  createdAfter: string;
  pushedAfter: string;
  minStars: number;
  unassigned: boolean;
  owner: string;
  keywords: string;
  sort: "updated" | "created";
  page: number;
};

export const defaultIssueFilters: IssueFilters = {
  kind: "issue",
  languages: [],
  topics: [],
  labels: ["good first issue"],
  createdAfter: "",
  pushedAfter: "",
  minStars: 0,
  unassigned: true,
  owner: "",
  keywords: "",
  sort: "updated",
  page: 1,
};

export type RepoFilters = {
  languages: string[];
  topics: string[];
  minStars: number;
  pushedAfter: string;
  owner: string;
  keywords: string;
  beginner: "any" | "good-first" | "help-wanted";
  contributingOnly: boolean;
  gsoc: boolean;
  gsocOrg: string;
  sort: "stars" | "updated" | "help-wanted-issues";
  page: number;
};

export const defaultRepoFilters: RepoFilters = {
  languages: [],
  topics: [],
  minStars: 100,
  pushedAfter: "",
  owner: "",
  keywords: "",
  beginner: "good-first",
  contributingOnly: false,
  gsoc: false,
  gsocOrg: "",
  sort: "stars",
  page: 1,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,49}$/;

function languageQuery(label: string): string {
  const known = LANGUAGES.find((item) => item.label.toLowerCase() === label.toLowerCase());
  return known ? known.query : label.toLowerCase().replace(/[^a-z0-9#+.-]/g, "");
}

function quote(value: string): string {
  const clean = value.replace(/"/g, "").trim();
  return /\s/.test(clean) ? `"${clean}"` : clean;
}

function languageParts(languages: string[]): string[] {
  return languages.map(languageQuery).filter(Boolean).map((lang) => `language:${lang}`);
}

function topicParts(topics: string[]): string[] {
  return topics.filter((topic) => SLUG.test(topic)).map((topic) => `topic:${topic}`);
}

function ownerPart(owner: string): string[] {
  const clean = owner.trim().replace(/^@/, "");
  return LOGIN.test(clean) ? [`user:${clean}`] : [];
}

/** True when the issue search needs a repository search first (GitHub issue search cannot filter these). */
export function needsRepoScope(filters: IssueFilters): boolean {
  return filters.topics.length > 0 || filters.minStars > 0 || DATE.test(filters.pushedAfter);
}

/** Repository query used to pick the repos an issue search runs inside. */
export function buildScopeRepoQuery(filters: IssueFilters): string {
  const parts = [
    ...languageParts(filters.languages),
    ...topicParts(filters.topics),
    ...ownerPart(filters.owner),
    "archived:false",
    "is:public",
  ];
  if (filters.minStars > 0) parts.push(`stars:>=${Math.floor(filters.minStars)}`);
  if (DATE.test(filters.pushedAfter)) parts.push(`pushed:>=${filters.pushedAfter}`);
  // Prefer repos that actually have issues with the chosen beginner label.
  const labels = filters.labels.map((label) => label.toLowerCase());
  if (labels.length === 1 && labels[0] === "good first issue") parts.push("good-first-issues:>0");
  if (labels.length === 1 && labels[0] === "help wanted") parts.push("help-wanted-issues:>0");
  return parts.join(" ");
}

/** Issue or pull request search query. Pass repoNames when the search is scoped to specific repos. */
export function buildIssueQuery(filters: IssueFilters, repoNames?: string[]): string {
  const parts = [filters.kind === "pr" ? "is:pr" : "is:issue", "is:open", "archived:false"];
  const labels = filters.labels.map(quote).filter(Boolean);
  if (labels.length) parts.push(`label:${labels.join(",")}`);
  if (filters.unassigned) parts.push("no:assignee");
  if (DATE.test(filters.createdAfter)) parts.push(`created:>=${filters.createdAfter}`);

  if (repoNames) {
    // Language and owner were already applied when the repos were chosen.
    parts.push(...repoNames.map((name) => `repo:${name}`));
  } else {
    parts.push(...languageParts(filters.languages), ...ownerPart(filters.owner));
  }

  const keywords = filters.keywords.trim();
  if (keywords) parts.push(keywords);
  return parts.join(" ");
}

/** Repository search query for the Repositories page. */
export function buildRepoQuery(filters: RepoFilters, gsocLogins: string[] = []): string {
  const parts = [...languageParts(filters.languages), ...topicParts(filters.topics), "archived:false", "is:public"];
  if (filters.gsoc && gsocLogins.length) {
    parts.push(...gsocLogins.slice(0, GSOC_ORG_LIMIT).map((login) => `user:${login}`));
  } else {
    parts.push(...ownerPart(filters.owner));
  }
  if (filters.minStars > 0) parts.push(`stars:>=${Math.floor(filters.minStars)}`);
  if (DATE.test(filters.pushedAfter)) parts.push(`pushed:>=${filters.pushedAfter}`);
  if (filters.beginner === "good-first") parts.push("good-first-issues:>0");
  if (filters.beginner === "help-wanted") parts.push("help-wanted-issues:>0");
  const keywords = filters.keywords.trim();
  if (keywords) parts.push(keywords);
  return parts.join(" ");
}

export type GsocOrg = {
  name: string;
  slug: string;
  github: string;
  website: string;
  techTags: string[];
  topicTags: string[];
  ideasUrl: string;
  guidanceUrl: string;
  gsocUrl: string;
};

/** GSoC organizations to search: one chosen org, or orgs whose tech tags match the chosen languages. */
export function pickGsocOrgs(orgs: GsocOrg[], languages: string[], chosen = "", limit = GSOC_ORG_LIMIT): string[] {
  if (chosen) return orgs.some((org) => org.github === chosen) ? [chosen] : [];
  const tags: string[] = LANGUAGES.filter((lang) => languages.includes(lang.label)).flatMap((lang) => [...lang.gsocTags]);
  const matching = tags.length
    ? orgs.filter((org) => org.techTags.some((tag) => tags.includes(tag.toLowerCase())))
    : orgs;
  return [...new Set(matching.map((org) => org.github))].slice(0, limit);
}

// ---- URL encoding, shared by the pages (to call the API) and the API routes (to read the call) ----

function list(value: string | null): string[] {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function pageNumber(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? Math.min(page, 50) : 1;
}

export function encodeIssueFilters(filters: IssueFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("kind", filters.kind);
  if (filters.languages.length) params.set("languages", filters.languages.join(","));
  if (filters.topics.length) params.set("topics", filters.topics.join(","));
  if (filters.labels.length) params.set("labels", filters.labels.join(","));
  if (filters.createdAfter) params.set("createdAfter", filters.createdAfter);
  if (filters.pushedAfter) params.set("pushedAfter", filters.pushedAfter);
  if (filters.minStars > 0) params.set("minStars", String(filters.minStars));
  if (filters.unassigned) params.set("unassigned", "1");
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.keywords) params.set("q", filters.keywords);
  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  return params;
}

export function decodeIssueFilters(params: URLSearchParams): IssueFilters {
  return {
    kind: params.get("kind") === "pr" ? "pr" : "issue",
    languages: list(params.get("languages")),
    topics: list(params.get("topics")),
    labels: list(params.get("labels")),
    createdAfter: DATE.test(params.get("createdAfter") || "") ? params.get("createdAfter")! : "",
    pushedAfter: DATE.test(params.get("pushedAfter") || "") ? params.get("pushedAfter")! : "",
    minStars: Math.max(0, Number(params.get("minStars")) || 0),
    unassigned: params.get("unassigned") === "1",
    owner: params.get("owner") || "",
    keywords: (params.get("q") || "").slice(0, 200),
    sort: params.get("sort") === "created" ? "created" : "updated",
    page: pageNumber(params.get("page")),
  };
}

export function encodeRepoFilters(filters: RepoFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.languages.length) params.set("languages", filters.languages.join(","));
  if (filters.topics.length) params.set("topics", filters.topics.join(","));
  if (filters.minStars > 0) params.set("minStars", String(filters.minStars));
  if (filters.pushedAfter) params.set("pushedAfter", filters.pushedAfter);
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.keywords) params.set("q", filters.keywords);
  params.set("beginner", filters.beginner);
  if (filters.contributingOnly) params.set("contributing", "1");
  if (filters.gsoc) params.set("gsoc", "1");
  if (filters.gsocOrg) params.set("gsocOrg", filters.gsocOrg);
  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  return params;
}

export function decodeRepoFilters(params: URLSearchParams): RepoFilters {
  const beginner = params.get("beginner");
  const sort = params.get("sort");
  return {
    languages: list(params.get("languages")),
    topics: list(params.get("topics")),
    minStars: Math.max(0, Number(params.get("minStars")) || 0),
    pushedAfter: DATE.test(params.get("pushedAfter") || "") ? params.get("pushedAfter")! : "",
    owner: params.get("owner") || "",
    keywords: (params.get("q") || "").slice(0, 200),
    beginner: beginner === "help-wanted" || beginner === "any" ? beginner : "good-first",
    contributingOnly: params.get("contributing") === "1",
    gsoc: params.get("gsoc") === "1",
    gsocOrg: params.get("gsocOrg") || "",
    sort: sort === "updated" || sort === "help-wanted-issues" ? sort : "stars",
    page: pageNumber(params.get("page")),
  };
}

export function daysAgoDate(days: number, from = new Date()): string {
  return new Date(from.getTime() - days * 86400000).toISOString().slice(0, 10);
}
