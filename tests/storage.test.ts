import { describe, expect, it } from "vitest";
import { rememberRepos } from "@/lib/storage";

const repo = (fullName: string) => ({ fullName, url: `https://github.com/${fullName}`, language: "Go", stars: 1 });

describe("rememberRepos", () => {
  it("puts new repos first, removes duplicates, and keeps at most 30", () => {
    const old = Array.from({ length: 30 }, (_, index) => ({ ...repo(`old/${index}`), seenAt: "2026-01-01" }));
    const next = rememberRepos(old, [repo("a/b"), repo("a/b"), repo("old/3")]);
    expect(next.map((item) => item.fullName).slice(0, 3)).toEqual(["a/b", "old/3", "old/0"]);
    expect(new Set(next.map((item) => item.fullName)).size).toBe(next.length);
    expect(next).toHaveLength(30);
  });
});
