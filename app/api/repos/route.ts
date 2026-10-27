import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/apiResponse";
import { GSOC_ORG_LIMIT, REPOS_PER_PAGE, SEARCH_RESULT_CAP } from "@/lib/constants";
import { buildRepoQuery, decodeRepoFilters, pickGsocOrgs, type GsocOrg } from "@/lib/github/queries";
import { contributingGuides, searchRepos } from "@/lib/github/repoLookup";
import gsoc from "@/data/gsoc-orgs.json";

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

// GET /api/repos?languages=Go&minStars=500&beginner=good-first&page=1
// With gsoc=1 the page sends gsocOrgs=a,b,c from its GSoC list, which may be newer than the
// bundled file. Without it, orgs are picked from the bundled file.
export async function GET(request: NextRequest) {
  const filters = decodeRepoFilters(request.nextUrl.searchParams);
  const sent = (request.nextUrl.searchParams.get("gsocOrgs") || "").split(",").filter((login) => LOGIN.test(login)).slice(0, GSOC_ORG_LIMIT);
  const gsocLogins = !filters.gsoc ? [] : sent.length ? sent : pickGsocOrgs(gsoc.orgs as GsocOrg[], filters.languages, filters.gsocOrg);

  if (filters.gsoc && !gsocLogins.length) {
    return NextResponse.json({ items: [], total: 0, page: 1, perPage: REPOS_PER_PAGE, query: "", gsocOrgs: [], contributingCheck: "skipped" });
  }

  try {
    const query = buildRepoQuery(filters, gsocLogins);
    const { repos, total, rateLimit } = await searchRepos(query, { sort: filters.sort, perPage: REPOS_PER_PAGE, page: filters.page });

    let contributingCheck: "checked" | "needs_token" | "failed" = "needs_token";
    let items = repos;
    try {
      const guides = await contributingGuides(repos.map((repo) => repo.fullName));
      if (guides) {
        contributingCheck = "checked";
        items = repos.map((repo) => ({ ...repo, contributingUrl: guides.get(repo.fullName.toLowerCase()) ?? null }));
        if (filters.contributingOnly) items = items.filter((repo) => repo.contributingUrl);
      }
    } catch {
      contributingCheck = "failed";
    }

    return NextResponse.json({
      items,
      total: Math.min(total, SEARCH_RESULT_CAP),
      totalReported: total,
      page: filters.page,
      perPage: REPOS_PER_PAGE,
      query,
      gsocOrgs: gsocLogins,
      contributingCheck,
      rateLimit,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
