import { describe, expect, it } from "vitest";
import type { ActivitySignals, IssueResult, RepoSummary } from "@/lib/github/types";
import { scoreIssue } from "@/lib/scoring";

const NOW = new Date("2026-10-26T12:00:00Z").getTime();
const daysAgo = (days: number) => new Date(NOW - days * 86400000).toISOString();

const repo: RepoSummary = {
  fullName: "acme/tool",
  owner: "acme",
  ownerType: "Organization",
  avatarUrl: "",
  url: "https://github.com/acme/tool",
  description: "",
  language: "TypeScript",
  topics: ["llm", "api"],
  stars: 1200,
  forks: 10,
  openIssues: 40,
  pushedAt: daysAgo(2),
  archived: false,
  license: "MIT",
  homepage: null,
};

const issue = (patch: Partial<IssueResult> = {}): IssueResult => ({
  id: 1,
  number: 7,
  title: "Fix the parser",
  url: "https://github.com/acme/tool/issues/7",
  bodyExcerpt: "",
  bodyLength: 400,
  repoFullName: "acme/tool",
  repoUrl: "https://github.com/acme/tool",
  labels: [{ name: "good first issue", color: "7057ff" }],
  createdAt: daysAgo(20),
  updatedAt: daysAgo(3),
  comments: 2,
  assignees: [],
  author: "someone",
  isPullRequest: false,
  repo,
  ...patch,
});

const prefs = { languages: ["TypeScript"], topics: ["llm"] };

describe("scoreIssue", () => {
  it("gives full marks for every part except engagement before activity is checked", () => {
    const score = scoreIssue(issue(), prefs, undefined, NOW);
    expect(score.parts.map((part) => [part.label, part.points])).toEqual([
      ["Repo activity", 20],
      ["Issue clarity", 20],
      ["Relevance", 20],
      ["Issue freshness", 15],
      ["Availability", 15],
      ["Maintainer engagement", 0],
    ]);
    expect(score.total).toBe(90);
  });

  it("never goes above 100 and adds engagement after activity is checked", () => {
    const activity: ActivitySignals = {
      checkedAt: daysAgo(0),
      repo: null,
      mergedPrs: { last30Days: 5, lastMergedAt: daysAgo(1) },
      contributingUrl: null,
      repoComments: null,
      issue: { comments: 2, maintainerComments: 1, lastCommentAt: daysAgo(2), lastMaintainerCommentAt: daysAgo(2), truncated: false },
      unavailable: [],
    };
    const score = scoreIssue(issue({ repo: { ...repo, topics: ["llm", "api", "rag"] } }), { languages: ["TypeScript"], topics: ["llm", "rag"] }, activity, NOW);
    expect(score.total).toBe(100);
    expect(score.parts.reduce((sum, part) => sum + part.max, 0)).toBe(100);
  });

  it("scores missing repo details as zero and says so", () => {
    const score = scoreIssue(issue({ repo: null }), prefs, undefined, NOW);
    const activity = score.parts.find((part) => part.label === "Repo activity")!;
    const relevance = score.parts.find((part) => part.label === "Relevance")!;
    expect(activity.points).toBe(0);
    expect(activity.note).toMatch(/not checked/i);
    expect(relevance.points).toBe(0);
  });

  it("lowers stale, assigned, crowded, vague issues", () => {
    const score = scoreIssue(
      issue({
        updatedAt: daysAgo(200),
        assignees: ["busy"],
        comments: 30,
        bodyLength: 10,
        labels: [],
        repo: { ...repo, pushedAt: daysAgo(400), language: "Rust", topics: [] },
      }),
      prefs,
      undefined,
      NOW,
    );
    expect(score.total).toBe(0);
  });
});
