import "server-only";
import { githubGet, githubGraphql, githubToken } from "./client";
import { mapRepo, type RawRepo, type SearchResponse } from "./mappers";
import type { RateLimit, RepoSummary } from "./types";

/** Search repositories. One search request. */
export async function searchRepos(
  query: string,
  options: { sort?: string; perPage?: number; page?: number } = {},
): Promise<{ repos: RepoSummary[]; total: number; rateLimit: RateLimit }> {
  const params: Record<string, string | number> = { q: query, per_page: options.perPage ?? 20, page: options.page ?? 1 };
  if (options.sort) {
    params.sort = options.sort;
    params.order = "desc";
  }
  const { data, rateLimit } = await githubGet<SearchResponse<RawRepo>>("/search/repositories", params, 600);
  return { repos: data.items.map(mapRepo), total: data.total_count, rateLimit };
}

/** Details for several repos in one search request, keyed by lowercase full name. */
export async function lookupRepos(fullNames: string[]): Promise<Map<string, RepoSummary>> {
  const unique = [...new Set(fullNames.map((name) => name.toLowerCase()))];
  const map = new Map<string, RepoSummary>();
  if (!unique.length) return map;
  const { repos } = await searchRepos(unique.map((name) => `repo:${name}`).join(" "), { perPage: 100 });
  for (const repo of repos) map.set(repo.fullName.toLowerCase(), repo);
  return map;
}

/**
 * Contributing guide links for a page of repos, in one GraphQL request.
 * Returns null without a token, because anonymous GraphQL is not allowed and
 * checking each repo over REST would use the small anonymous limit too quickly.
 */
export async function contributingGuides(fullNames: string[]): Promise<Map<string, string | null> | null> {
  if (!githubToken() || !fullNames.length) return null;
  const fields = fullNames
    .map((fullName, index) => {
      const [owner, name] = fullName.split("/");
      return `r${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { nameWithOwner contributingGuidelines { url } }`;
    })
    .join("\n");
  type Node = { nameWithOwner: string; contributingGuidelines: { url: string | null } | null } | null;
  const data = await githubGraphql<Record<string, Node>>(`query {\n${fields}\n}`, {}, 86400);
  const map = new Map<string, string | null>();
  for (const node of Object.values(data)) {
    if (node) map.set(node.nameWithOwner.toLowerCase(), node.contributingGuidelines?.url || null);
  }
  return map;
}
