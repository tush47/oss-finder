// Shapes returned by our own API routes. The raw GitHub shapes are typed loosely in mappers.ts.

export type RepoSummary = {
  fullName: string;
  owner: string;
  ownerType: "User" | "Organization";
  avatarUrl: string;
  url: string;
  description: string;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string | null;
  archived: boolean;
  license: string | null;
  homepage: string | null;
  // undefined means we did not check. null means we checked and found none.
  contributingUrl?: string | null;
};

export type IssueLabel = { name: string; color: string };

export type IssueResult = {
  id: number;
  number: number;
  title: string;
  url: string;
  bodyExcerpt: string;
  bodyLength: number;
  repoFullName: string;
  repoUrl: string;
  labels: IssueLabel[];
  createdAt: string;
  updatedAt: string;
  comments: number;
  assignees: string[];
  author: string;
  isPullRequest: boolean;
  repo: RepoSummary | null;
};

export type PrStatus = "draft" | "open" | "merged" | "closed";

export type PullRequestResult = {
  id: number;
  title: string;
  url: string;
  repoFullName: string;
  status: PrStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
};

export type RateLimit = {
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
};

export type ApiError = {
  message: string;
  kind: "rate_limit" | "not_found" | "invalid" | "network" | "upstream" | "bad_request";
  resetAt?: string | null;
};

export type ActivitySignals = {
  checkedAt: string;
  repo: { pushedAt: string | null; openIssues: number; archived: boolean } | null;
  mergedPrs: { last30Days: number; lastMergedAt: string | null } | null;
  contributingUrl: string | null | undefined;
  repoComments: { sampled: number; last14Days: number; lastMaintainerCommentAt: string | null } | null;
  issue: {
    comments: number;
    maintainerComments: number;
    lastCommentAt: string | null;
    lastMaintainerCommentAt: string | null;
    truncated: boolean;
  } | null;
  unavailable: string[];
};
