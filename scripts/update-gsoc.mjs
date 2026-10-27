// Refreshes data/gsoc-orgs.json from the organization list on the Google Summer of Code website.
// This is the JSON the public site loads; it is not a documented API and may change.
// Run it by hand about once a year (npm run update:gsoc -- 2027), or use Settings → Data sources →
// Refresh in the app, which does the same thing. The mapping matches lib/gsoc.ts.
import fs from "node:fs";

const year = Number(process.argv[2]) || new Date().getFullYear();
const url = `https://summerofcode.withgoogle.com/api/program/${year}/organizations/`;

const response = await fetch(url, { headers: { "User-Agent": "oss-finder (manual refresh)" } });
if (!response.ok) {
  console.error(`GSoC returned ${response.status} for ${year}. The program list may not be published yet.`);
  process.exit(1);
}

const orgs = (await response.json())
  .map((org) => {
    const match = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)/.exec(org.source_code || "");
    if (!match) return null;
    return {
      name: org.name,
      slug: org.slug,
      github: match[1],
      website: org.website_url || "",
      techTags: org.tech_tags || [],
      topicTags: org.topic_tags || [],
      ideasUrl: org.ideas_link || "",
      guidanceUrl: org.contributor_guidance_url || "",
      gsocUrl: `https://summerofcode.withgoogle.com/programs/${year}/organizations/${org.slug}`,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(
  new URL("../data/gsoc-orgs.json", import.meta.url),
  JSON.stringify({ year, fetchedAt: new Date().toISOString().slice(0, 10), source: url, orgs }, null, 2) + "\n",
);
console.log(`Saved ${orgs.length} GSoC ${year} organizations with a GitHub account.`);
