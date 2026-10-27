import { NextResponse } from "next/server";
import { githubGet, githubToken } from "@/lib/github/client";

type Bucket = { limit: number; remaining: number; reset: number };

export const dynamic = "force-dynamic";

// GET /api/status — whether a token is set and how much rate limit is left.
// Checking /rate_limit does not count against the limit. The token itself is never returned.
export async function GET() {
  const authenticated = Boolean(githubToken());
  try {
    const { data } = await githubGet<{ resources: Record<string, Bucket> }>("/rate_limit", {}, 0);
    const pick = (bucket?: Bucket) =>
      bucket ? { limit: bucket.limit, remaining: bucket.remaining, resetAt: new Date(bucket.reset * 1000).toISOString() } : null;
    return NextResponse.json({ authenticated, core: pick(data.resources.core), search: pick(data.resources.search) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub did not respond.";
    return NextResponse.json({ authenticated, core: null, search: null, error: message });
  }
}
