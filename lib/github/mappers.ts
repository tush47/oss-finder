// Converts raw GitHub API objects into the smaller shapes the app uses.
// Every field is optional in the raw types because GitHub omits fields in some responses.
import { classifyPr } from "../prStatus";
import type { IssueResult, PullRequestResult, RepoSummary } from "./types";

export type RawRepo = {
  full_name: string;
  html_url: string;
  description?: string | null;
  language?: string | null;
  topics?: string[];
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  pushed_at?: string | null;
  archived?: boolean;
  homepage?: string | null;
  license?: { spdx_id?: string | null } | null;
  owner?: { login?: string; type?: string; avatar_url?: string } | null;
  node_id?: string;
};

export type RawIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  body?: string | null;
  repository_url: string;
  labels?: ({ name?: string; color?: string } | string)[];
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  comments?: number;
  assignees?: { login: string }[] | null;
  user?: { login?: string } | null;
  state?: string;
  draft?: boolean;
  pull_request?: { merged_at?: string | null } | null;
};

export type SearchResponse<T> = { total_count: number; incomplete_results: boolean; items: T[] };

export function mapRepo(raw: RawRepo): RepoSummary {
  return {
    fullName: raw.full_name,
    owner: raw.owner?.login || raw.full_name.split("/")[0],
    ownerType: raw.owner?.type === "Organization" ? "Organization" : "User",
    avatarUrl: raw.owner?.avatar_url || "",
    url: raw.html_url,
    description: raw.description || "",
    language: raw.language || null,
    topics: raw.topics || [],
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    openIssues: raw.open_issues_count ?? 0,
    pushedAt: raw.pushed_at || null,
    archived: Boolean(raw.archived),
    license: raw.license?.spdx_id && raw.license.spdx_id !== "NOASSERTION" ? raw.license.spdx_id : null,
    homepage: raw.homepage || null,
  };
}

/** Plain-text excerpt of a markdown issue body. */
export function excerpt(body: string, max = 240): string {
  const text = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`|~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export function repoNameFromApiUrl(repositoryUrl: string): string {
  return repositoryUrl.replace(/^https:\/\/api\.github\.com\/repos\//, "");
}

export function mapIssue(raw: RawIssue, repos: Map<string, RepoSummary>): IssueResult {
  const repoFullName = repoNameFromApiUrl(raw.repository_url);
  const body = raw.body || "";
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    url: raw.html_url,
    bodyExcerpt: excerpt(body),
    bodyLength: body.trim().length,
    repoFullName,
    repoUrl: `https://github.com/${repoFullName}`,
    labels: (raw.labels || []).map((label) =>
      typeof label === "string" ? { name: label, color: "888888" } : { name: label.name || "", color: label.color || "888888" },
    ),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    comments: raw.comments ?? 0,
    assignees: (raw.assignees || []).map((user) => user.login),
    author: raw.user?.login || "",
    isPullRequest: Boolean(raw.pull_request),
    repo: repos.get(repoFullName.toLowerCase()) || null,
  };
}

export function mapPullRequest(raw: RawIssue): PullRequestResult {
  return {
    id: raw.id,
    title: raw.title,
    url: raw.html_url,
    repoFullName: repoNameFromApiUrl(raw.repository_url),
    status: classifyPr({ state: raw.state, draft: raw.draft, mergedAt: raw.pull_request?.merged_at ?? null }),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    closedAt: raw.closed_at || null,
    mergedAt: raw.pull_request?.merged_at ?? null,
  };
}
