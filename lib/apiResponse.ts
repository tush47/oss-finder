import "server-only";
import { NextResponse } from "next/server";
import { GitHubError } from "./github/client";
import type { ApiError } from "./github/types";

export function errorResponse(error: unknown): NextResponse<{ error: ApiError }> {
  if (error instanceof GitHubError) {
    const status = error.kind === "rate_limit" ? 429 : error.kind === "not_found" ? 404 : error.kind === "invalid" ? 400 : 502;
    return NextResponse.json({ error: { message: error.message, kind: error.kind, resetAt: error.resetAt } }, { status });
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ error: { message, kind: "upstream" } }, { status: 502 });
}

export function badRequest(message: string): NextResponse<{ error: ApiError }> {
  return NextResponse.json({ error: { message, kind: "bad_request" } }, { status: 400 });
}
