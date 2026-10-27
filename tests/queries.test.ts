import { describe, expect, it } from "vitest";
import {
  buildIssueQuery,
  buildRepoQuery,
  buildScopeRepoQuery,
  decodeIssueFilters,
  decodeRepoFilters,
  defaultIssueFilters,
  defaultRepoFilters,
  encodeIssueFilters,
  encodeRepoFilters,
  needsRepoScope,
  pickGsocOrgs,
  type GsocOrg,
} from "@/lib/github/queries";

describe("buildIssueQuery", () => {
  it("builds a beginner issue search", () => {
    const query = buildIssueQuery({ ...defaultIssueFilters, languages: ["TypeScript", "C++"], labels: ["good first issue", "bug"] });
    expect(query).toBe('is:issue is:open archived:false label:"good first issue",bug no:assignee language:typescript language:cpp');
  });

  it("searches pull requests and keeps keywords last", () => {
    const query = buildIssueQuery({ ...defaultIssueFilters, kind: "pr", labels: [], unassigned: false, keywords: "timeout" });
    expect(query).toBe("is:pr is:open archived:false timeout");
  });

  it("adds created date and owner only when valid", () => {
    expect(buildIssueQuery({ ...defaultIssueFilters, createdAfter: "2026-01-02", owner: "@vercel" })).toContain("created:>=2026-01-02 user:vercel");
    const bad = buildIssueQuery({ ...defaultIssueFilters, createdAfter: "yesterday", owner: "bad owner!" });
    expect(bad).not.toContain("created:");
    expect(bad).not.toContain("user:");
  });

  it("uses repo qualifiers instead of language and owner when scoped", () => {
    const query = buildIssueQuery({ ...defaultIssueFilters, languages: ["Go"], owner: "golang" }, ["a/b", "c/d"]);
    expect(query).toContain("repo:a/b repo:c/d");
    expect(query).not.toContain("language:");
    expect(query).not.toContain("user:");
  });

  it("strips quotes from labels so the query stays valid", () => {
    expect(buildIssueQuery({ ...defaultIssueFilters, labels: ['say "hi"'] })).toContain('label:"say hi"');
  });
});

describe("repo scope for issue search", () => {
  it("is needed only for stars, topics, or last push", () => {
    expect(needsRepoScope(defaultIssueFilters)).toBe(false);
    expect(needsRepoScope({ ...defaultIssueFilters, minStars: 100 })).toBe(true);
    expect(needsRepoScope({ ...defaultIssueFilters, topics: ["llm"] })).toBe(true);
    expect(needsRepoScope({ ...defaultIssueFilters, pushedAfter: "2026-09-01" })).toBe(true);
  });

  it("asks for repos that have the chosen beginner label", () => {
    const query = buildScopeRepoQuery({ ...defaultIssueFilters, topics: ["llm", "rag"], minStars: 500 });
    expect(query).toBe("topic:llm topic:rag archived:false is:public stars:>=500 good-first-issues:>0");
  });

  it("skips the label hint when several labels are chosen", () => {
    const query = buildScopeRepoQuery({ ...defaultIssueFilters, labels: ["good first issue", "help wanted"], minStars: 10 });
    expect(query).not.toContain("issues:>0");
  });

  it("ignores topics that are not valid GitHub topic slugs", () => {
    expect(buildScopeRepoQuery({ ...defaultIssueFilters, topics: ["Not A Topic", "api"] })).toContain("topic:api");
    expect(buildScopeRepoQuery({ ...defaultIssueFilters, topics: ["Not A Topic"] })).not.toContain("Not A Topic");
  });
});

describe("buildRepoQuery", () => {
  it("combines repo filters", () => {
    const query = buildRepoQuery({ ...defaultRepoFilters, languages: ["Python"], pushedAfter: "2026-09-01", beginner: "help-wanted" });
    expect(query).toBe("language:python archived:false is:public stars:>=100 pushed:>=2026-09-01 help-wanted-issues:>0");
  });

  it("uses GSoC orgs instead of the owner filter, capped at 20", () => {
    const logins = Array.from({ length: 30 }, (_, index) => `org${index}`);
    const query = buildRepoQuery({ ...defaultRepoFilters, gsoc: true, owner: "ignored" }, logins);
    expect(query.match(/user:/g)).toHaveLength(20);
    expect(query).not.toContain("user:ignored");
  });
});

describe("pickGsocOrgs", () => {
  const org = (github: string, techTags: string[]): GsocOrg => ({
    name: github,
    slug: github,
    github,
    website: "",
    techTags,
    topicTags: [],
    ideasUrl: "",
    guidanceUrl: "",
    gsocUrl: "",
  });
  const orgs = [org("py", ["python", "django"]), org("go", ["golang"]), org("web", ["javascript", "react"])];

  it("matches orgs by language tags", () => {
    expect(pickGsocOrgs(orgs, ["Go"])).toEqual(["go"]);
    expect(pickGsocOrgs(orgs, ["Python", "JavaScript"])).toEqual(["py", "web"]);
  });

  it("returns all orgs with no languages, and only a known chosen org", () => {
    expect(pickGsocOrgs(orgs, [])).toEqual(["py", "go", "web"]);
    expect(pickGsocOrgs(orgs, [], "web")).toEqual(["web"]);
    expect(pickGsocOrgs(orgs, [], "unknown")).toEqual([]);
  });
});

describe("URL encoding", () => {
  it("round-trips issue filters", () => {
    const filters = { ...defaultIssueFilters, languages: ["Go"], topics: ["api"], minStars: 50, keywords: "cache", page: 3 };
    expect(decodeIssueFilters(encodeIssueFilters(filters))).toEqual(filters);
  });

  it("round-trips repo filters", () => {
    const filters = { ...defaultRepoFilters, gsoc: true, gsocOrg: "sympy", sort: "updated" as const, contributingOnly: true };
    expect(decodeRepoFilters(encodeRepoFilters(filters))).toEqual(filters);
  });

  it("clamps bad input from the URL", () => {
    const filters = decodeIssueFilters(new URLSearchParams("page=999&minStars=-5&sort=nonsense&createdAfter=2026-13"));
    expect(filters.page).toBe(50);
    expect(filters.minStars).toBe(0);
    expect(filters.sort).toBe("updated");
    expect(filters.createdAfter).toBe("");
  });
});
