import "server-only";
import { clip, htmlToText } from "./html";
import type { JobPosting, JobProvider } from "./types";

// Public API: https://remotive.com/api-documentation
// Terms: link back to the Remotive job URL, name Remotive as the source, and request at most
// about 4 times a day. The free API returns at most 10 jobs per request, so we pass the keyword
// to Remotive's own search and cache each search for 6 hours.
const API = "https://remotive.com/api/remote-jobs";

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name?: string;
  tags?: string[];
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

export const remotive: JobProvider = {
  id: "remotive",
  name: "Remotive",
  homepage: "https://remotive.com",
  notes:
    "Remote jobs from Remotive's free public API, which returns at most 10 listings per search and shows them 24 hours after Remotive does. Each search is cached for 6 hours.",
  async search(query) {
    const url = query ? `${API}?search=${encodeURIComponent(query)}` : `${API}?category=software-dev`;
    const response = await fetch(url, { headers: { "User-Agent": "oss-finder" }, next: { revalidate: 21600 } });
    if (!response.ok) throw new Error(`Remotive returned ${response.status}.`);
    const body = (await response.json()) as { jobs?: RemotiveJob[] };

    return (body.jobs || []).map((job): JobPosting => {
      const text = htmlToText(job.description || "");
      return {
        id: `remotive-${job.id}`,
        source: "Remotive",
        title: job.title,
        company: job.company_name || null,
        url: job.url,
        location: job.candidate_required_location || null,
        salary: job.salary?.trim() || null,
        publishedAt: job.publication_date || null,
        excerpt: clip(text, 280),
        tags: job.tags || [],
      };
    });
  },
};
