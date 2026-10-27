import { NextResponse, type NextRequest } from "next/server";
import { badRequest, errorResponse } from "@/lib/apiResponse";
import { MAINTAINER_ROLES } from "@/lib/constants";
import { githubGet } from "@/lib/github/client";
import type { RawIssue, RawRepo, SearchResponse } from "@/lib/github/mappers";
import { daysAgoDate } from "@/lib/github/queries";
import type { ActivitySignals } from "@/lib/github/types";

type RawComment = { created_at: string; author_association?: string };

const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

function lastMaintainerComment(comments: RawComment[]): string | null {
  const dates = comments
    .filter((comment) => MAINTAINER_ROLES.includes(comment.author_association || ""))
    .map((comment) => comment.created_at)
    .sort();
  return dates.at(-1) || null;
}

// GET /api/activity?repo=owner/name&issue=123
// Runs only when you press "Check activity", never for every card.
// Without a token: 4 REST requests (5 with an issue) out of 60 per hour, plus 1 search request.
export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get("repo") || "";
  const issue = Number(request.nextUrl.searchParams.get("issue"));
  if (!REPO.test(repo)) return badRequest("Pass repo as owner/name.");

  const [repoInfo, merged, community, repoComments, issueComments] = await Promise.allSettled([
    githubGet<RawRepo>(`/repos/${repo}`, {}, 1800),
    githubGet<SearchResponse<RawIssue>>(
      "/search/issues",
      { q: `repo:${repo} is:pr is:merged merged:>=${daysAgoDate(30)}`, sort: "updated", order: "desc", per_page: 20 },
      1800,
    ),
    githubGet<{ files?: { contributing?: { html_url?: string } | null } }>(`/repos/${repo}/community/profile`, {}, 86400),
    githubGet<RawComment[]>(`/repos/${repo}/issues/comments`, { sort: "created", direction: "desc", per_page: 30 }, 1800),
    Number.isInteger(issue) && issue > 0
      ? githubGet<RawComment[]>(`/repos/${repo}/issues/${issue}/comments`, { per_page: 100 }, 900)
      : Promise.resolve(null),
  ]);

  const results = [repoInfo, merged, community, repoComments];
  if (results.every((result) => result.status === "rejected")) {
    return errorResponse((repoInfo as PromiseRejectedResult).reason);
  }

  const unavailable: string[] = [];
  const signals: ActivitySignals = {
    checkedAt: new Date().toISOString(),
    repo: null,
    mergedPrs: null,
    contributingUrl: undefined,
    repoComments: null,
    issue: null,
    unavailable,
  };

  if (repoInfo.status === "fulfilled") {
    const data = repoInfo.value.data;
    signals.repo = { pushedAt: data.pushed_at || null, openIssues: data.open_issues_count ?? 0, archived: Boolean(data.archived) };
  } else unavailable.push("repository details");

  if (merged.status === "fulfilled") {
    const dates = merged.value.data.items.map((item) => item.pull_request?.merged_at).filter((date): date is string => Boolean(date));
    signals.mergedPrs = { last30Days: merged.value.data.total_count, lastMergedAt: dates.sort().at(-1) || null };
  } else unavailable.push("merged pull requests");

  if (community.status === "fulfilled") {
    signals.contributingUrl = community.value.data.files?.contributing?.html_url || null;
  } else unavailable.push("contributing guide");

  if (repoComments.status === "fulfilled") {
    const comments = repoComments.value.data;
    const cutoff = daysAgoDate(14);
    signals.repoComments = {
      sampled: comments.length,
      last14Days: comments.filter((comment) => comment.created_at.slice(0, 10) >= cutoff).length,
      lastMaintainerCommentAt: lastMaintainerComment(comments),
    };
  } else unavailable.push("recent comments");

  if (issueComments.status === "fulfilled" && issueComments.value) {
    const comments = issueComments.value.data;
    signals.issue = {
      comments: comments.length,
      maintainerComments: comments.filter((comment) => MAINTAINER_ROLES.includes(comment.author_association || "")).length,
      lastCommentAt: comments.map((comment) => comment.created_at).sort().at(-1) || null,
      lastMaintainerCommentAt: lastMaintainerComment(comments),
      truncated: comments.length === 100,
    };
  } else if (issueComments.status === "rejected") unavailable.push("issue comments");

  return NextResponse.json(signals);
}
