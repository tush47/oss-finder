import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/apiResponse";
import { ISSUES_PER_PAGE, SCOPE_REPO_LIMIT, SEARCH_RESULT_CAP } from "@/lib/constants";
import { githubGet } from "@/lib/github/client";
import { mapIssue, repoNameFromApiUrl, type RawIssue, type SearchResponse } from "@/lib/github/mappers";
import { buildIssueQuery, buildScopeRepoQuery, decodeIssueFilters, needsRepoScope } from "@/lib/github/queries";
import { lookupRepos, searchRepos } from "@/lib/github/repoLookup";
import type { RepoSummary } from "@/lib/github/types";

// GET /api/issues?languages=Python&labels=good first issue&unassigned=1&page=1
// Costs 2 GitHub search requests per page: one for issues, one for the details of their repos.
export async function GET(request: NextRequest) {
  const filters = decodeIssueFilters(request.nextUrl.searchParams);

  try {
    let repos = new Map<string, RepoSummary>();
    let scope: { repoCount: number; matchingRepos: number } | null = null;
    let query: string;

    if (needsRepoScope(filters)) {
      // Issue search cannot filter by stars, topics, or last push, so pick matching repos first.
      const found = await searchRepos(buildScopeRepoQuery(filters), { sort: "stars", perPage: SCOPE_REPO_LIMIT });
      scope = { repoCount: found.repos.length, matchingRepos: found.total };
      if (!found.repos.length) {
        return NextResponse.json({ items: [], total: 0, page: filters.page, perPage: ISSUES_PER_PAGE, scope, query: "", rateLimit: found.rateLimit });
      }
      for (const repo of found.repos) repos.set(repo.fullName.toLowerCase(), repo);
      query = buildIssueQuery(filters, found.repos.map((repo) => repo.fullName));
    } else {
      query = buildIssueQuery(filters);
    }

    const { data, rateLimit } = await githubGet<SearchResponse<RawIssue>>(
      "/search/issues",
      { q: query, sort: filters.sort, order: "desc", per_page: ISSUES_PER_PAGE, page: filters.page },
      300,
    );

    if (!scope) {
      try {
        repos = await lookupRepos(data.items.map((item) => repoNameFromApiUrl(item.repository_url)));
      } catch {
        // Cards still work without repo details. They just show fewer facts.
      }
    }

    return NextResponse.json({
      items: data.items.map((item) => mapIssue(item, repos)),
      total: Math.min(data.total_count, SEARCH_RESULT_CAP),
      totalReported: data.total_count,
      incomplete: data.incomplete_results,
      page: filters.page,
      perPage: ISSUES_PER_PAGE,
      scope,
      query,
      rateLimit,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
