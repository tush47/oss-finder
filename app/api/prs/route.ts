import { NextResponse, type NextRequest } from "next/server";
import { badRequest, errorResponse } from "@/lib/apiResponse";
import { githubGet } from "@/lib/github/client";
import { mapPullRequest, type RawIssue, type SearchResponse } from "@/lib/github/mappers";

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

// GET /api/prs?user=octocat — the user's 100 most recently updated public pull requests.
export async function GET(request: NextRequest) {
  const user = (request.nextUrl.searchParams.get("user") || "").trim().replace(/^@/, "");
  if (!LOGIN.test(user)) return badRequest("Enter a valid GitHub username in Settings.");

  try {
    const { data, rateLimit } = await githubGet<SearchResponse<RawIssue>>(
      "/search/issues",
      { q: `is:pr author:${user}`, sort: "updated", order: "desc", per_page: 100 },
      300,
    );
    return NextResponse.json({ items: data.items.map(mapPullRequest), total: data.total_count, rateLimit });
  } catch (error) {
    return errorResponse(error);
  }
}
