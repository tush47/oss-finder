import { describe, expect, it } from "vitest";
import { mapPullRequest } from "@/lib/github/mappers";
import { classifyPr } from "@/lib/prStatus";

describe("classifyPr", () => {
  it("treats a closed PR as merged only when it has a merge date", () => {
    expect(classifyPr({ state: "closed", mergedAt: "2026-10-01T00:00:00Z" })).toBe("merged");
    expect(classifyPr({ state: "closed", mergedAt: null })).toBe("closed");
  });

  it("separates drafts from open PRs", () => {
    expect(classifyPr({ state: "open", draft: true })).toBe("draft");
    expect(classifyPr({ state: "open", draft: false })).toBe("open");
  });
});

describe("mapPullRequest", () => {
  it("reads the merge date from GitHub search results", () => {
    const pr = mapPullRequest({
      id: 1,
      number: 2,
      title: "Add docs",
      html_url: "https://github.com/a/b/pull/2",
      repository_url: "https://api.github.com/repos/a/b",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-02T00:00:00Z",
      closed_at: "2026-09-02T00:00:00Z",
      state: "closed",
      pull_request: { merged_at: null },
    });
    expect(pr.status).toBe("closed");
    expect(pr.repoFullName).toBe("a/b");
  });
});
