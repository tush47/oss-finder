import type { ApiError } from "./github/types";

/** Calls one of our API routes and returns either data or a readable error. */
export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<{ data: T; error: null } | { data: null; error: ApiError }> {
  try {
    const response = await fetch(url, { signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body) {
      return { data: null, error: body?.error || { message: `Request failed (${response.status}).`, kind: "upstream" } };
    }
    return { data: body as T, error: null };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { data: null, error: { message: "Could not reach the app server. Is `npm run dev` running?", kind: "network" } };
  }
}
