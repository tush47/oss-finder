// The only place that talks to GitHub. Runs on the server, so the token never reaches the browser.
import "server-only";
import type { RateLimit } from "./types";

const API = "https://api.github.com";

export function githubToken(): string | undefined {
  return process.env.GITHUB_TOKEN?.trim() || undefined;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: "rate_limit" | "not_found" | "invalid" | "network" | "upstream",
    public resetAt: string | null = null,
  ) {
    super(message);
  }
}

function headers(): HeadersInit {
  const token = githubToken();
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "oss-finder",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function readRateLimit(response: Response): RateLimit {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const limit = response.headers.get("x-ratelimit-limit");
  const reset = response.headers.get("x-ratelimit-reset");
  return {
    remaining: remaining === null ? null : Number(remaining),
    limit: limit === null ? null : Number(limit),
    resetAt: reset ? new Date(Number(reset) * 1000).toISOString() : null,
  };
}

async function toError(response: Response): Promise<GitHubError> {
  const rate = readRateLimit(response);
  let message = `GitHub returned ${response.status}.`;
  try {
    const body = (await response.json()) as { message?: string; errors?: { message?: string }[] };
    message = body.errors?.[0]?.message || body.message || message;
  } catch {
    // Body was not JSON. Keep the generic message.
  }

  const retryAfter = response.headers.get("retry-after");
  if (response.status === 429 || (response.status === 403 && (rate.remaining === 0 || retryAfter))) {
    const resetAt = retryAfter ? new Date(Date.now() + Number(retryAfter) * 1000).toISOString() : rate.resetAt;
    const hint = githubToken() ? "" : " Add a GITHUB_TOKEN to raise the limit.";
    return new GitHubError(`GitHub rate limit reached.${hint}`, response.status, "rate_limit", resetAt);
  }
  if (response.status === 404) return new GitHubError("Not found on GitHub.", 404, "not_found");
  if (response.status === 422) return new GitHubError(`GitHub could not run this search: ${message}`, 422, "invalid");
  return new GitHubError(message, response.status, "upstream");
}

/**
 * GET a GitHub REST endpoint. Responses are cached by Next.js for `revalidate` seconds,
 * so repeating the same search does not spend rate limit.
 */
export async function githubGet<T>(
  path: string,
  params: Record<string, string | number> = {},
  revalidate = 300,
): Promise<{ data: T; rateLimit: RateLimit }> {
  const url = new URL(path, API);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  let response: Response;
  try {
    response = await fetch(url, { headers: headers(), next: { revalidate } });
  } catch {
    throw new GitHubError("Could not reach GitHub. Check your connection.", 0, "network");
  }
  if (!response.ok) throw await toError(response);
  return { data: (await response.json()) as T, rateLimit: readRateLimit(response) };
}

/** POST a GraphQL query. Needs a token: GitHub does not allow anonymous GraphQL. */
export async function githubGraphql<T>(query: string, variables: Record<string, unknown>, revalidate = 3600): Promise<T> {
  const token = githubToken();
  if (!token) throw new GitHubError("GraphQL needs GITHUB_TOKEN.", 401, "invalid");

  let response: Response;
  try {
    response = await fetch(`${API}/graphql`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      next: { revalidate },
    });
  } catch {
    throw new GitHubError("Could not reach GitHub. Check your connection.", 0, "network");
  }
  if (!response.ok) throw await toError(response);
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!body.data) throw new GitHubError(body.errors?.[0]?.message || "GraphQL request failed.", 502, "upstream");
  return body.data;
}
