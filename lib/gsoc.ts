// Google Summer of Code organization list: parsing and choosing between saved copies.
// GSoC has no public API. The list comes from the JSON its own website loads, fetched only when
// you press "Refresh" (or run npm run update:gsoc). scripts/update-gsoc.mjs uses the same mapping.
import type { GsocOrg } from "./github/queries";

export type GsocSnapshot = { year: number; fetchedAt: string; source: string; orgs: GsocOrg[] };

export function gsocSourceUrl(year: number): string {
  return `https://summerofcode.withgoogle.com/api/program/${year}/organizations/`;
}

type RawOrg = {
  name?: string;
  slug?: string;
  source_code?: string;
  website_url?: string;
  tech_tags?: string[];
  topic_tags?: string[];
  ideas_link?: string;
  contributor_guidance_url?: string;
};

/** Keeps organizations that link to a GitHub account, sorted by name. */
export function parseGsocOrgs(raw: unknown, year: number): GsocOrg[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawOrg[])
    .flatMap((org) => {
      const match = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)/.exec(org.source_code || "");
      if (!match || !org.name || !org.slug) return [];
      return [
        {
          name: org.name,
          slug: org.slug,
          github: match[1],
          website: org.website_url || "",
          techTags: Array.isArray(org.tech_tags) ? org.tech_tags : [],
          topicTags: Array.isArray(org.topic_tags) ? org.topic_tags : [],
          ideasUrl: org.ideas_link || "",
          guidanceUrl: org.contributor_guidance_url || "",
          gsocUrl: `https://summerofcode.withgoogle.com/programs/${year}/organizations/${org.slug}`,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The newer of two snapshots: a later program year wins, then a later fetch date. */
export function newerSnapshot(a: GsocSnapshot, b: GsocSnapshot | null | undefined): GsocSnapshot {
  if (!b || !Array.isArray(b.orgs) || !b.orgs.length) return a;
  if (b.year !== a.year) return b.year > a.year ? b : a;
  return b.fetchedAt > a.fetchedAt ? b : a;
}

/** Years worth offering in the refresh menu: from the saved year up to next year. */
export function refreshableYears(savedYear: number, now = new Date()): number[] {
  const last = now.getFullYear() + 1;
  const years: number[] = [];
  for (let year = last; year >= Math.min(savedYear, now.getFullYear()); year -= 1) years.push(year);
  return years;
}
