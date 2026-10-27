import "server-only";
import { clip, htmlToText } from "./html";
import type { JobPosting, JobProvider } from "./types";

// Hacker News data through the official Algolia HN Search API: https://hn.algolia.com/api
// Limit: 10,000 requests per hour per IP. Results are cached for an hour.
// Each top-level comment in the monthly "Ask HN: Who is hiring?" thread is one company's post.
const API = "https://hn.algolia.com/api/v1";

type Hit = { objectID: string; title?: string; created_at?: string; comment_text?: string; parent_id?: number; story_id?: number };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`HN Search returned ${response.status}.`);
  return (await response.json()) as T;
}

async function latestThread(): Promise<Hit | null> {
  const body = await getJson<{ hits: Hit[] }>(`${API}/search_by_date?tags=story,author_whoishiring&hitsPerPage=10`);
  return body.hits.find((hit) => /who is hiring/i.test(hit.title || "")) || null;
}

export const hackerNews: JobProvider = {
  id: "hn",
  name: "HN Who is hiring",
  homepage: "https://news.ycombinator.com/submitted?id=whoishiring",
  notes: "Top-level posts from this month's Hacker News \"Who is hiring?\" thread. Each post is written by the company. Read the full post for location and how to apply.",
  async search(query) {
    const thread = await latestThread();
    if (!thread) return [];
    const params = new URLSearchParams({ tags: `comment,story_${thread.objectID}`, hitsPerPage: "200", query });
    const body = await getJson<{ hits: Hit[] }>(`${API}/search?${params}`);

    return body.hits
      .filter((hit) => String(hit.parent_id) === thread.objectID && hit.comment_text)
      .map((hit) => {
        const text = htmlToText(hit.comment_text || "");
        const firstLine = text.split("\n")[0] || "";
        const company = firstLine.includes("|") ? firstLine.split("|")[0].trim() : null;
        return {
          id: `hn-${hit.objectID}`,
          source: thread.title?.replace(/^Ask HN:\s*/i, "HN: ") || "HN Who is hiring",
          title: clip(firstLine, 160),
          company,
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          location: null,
          salary: null,
          publishedAt: hit.created_at || null,
          excerpt: clip(text.slice(firstLine.length), 420),
          tags: [],
        };
      });
  },
};
