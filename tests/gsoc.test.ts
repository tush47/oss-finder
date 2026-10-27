import { describe, expect, it } from "vitest";
import { newerSnapshot, parseGsocOrgs, refreshableYears, type GsocSnapshot } from "@/lib/gsoc";

describe("parseGsocOrgs", () => {
  it("keeps orgs with a GitHub account and builds their GSoC link", () => {
    const orgs = parseGsocOrgs(
      [
        { name: "Zeta", slug: "zeta", source_code: "https://github.com/zeta-org/main", tech_tags: ["python"] },
        { name: "Alpha", slug: "alpha", source_code: "https://www.github.com/alpha" },
        { name: "Gitlab only", slug: "gl", source_code: "https://gitlab.com/x" },
        { slug: "no-name", source_code: "https://github.com/x" },
      ],
      2027,
    );
    expect(orgs.map((org) => [org.name, org.github])).toEqual([
      ["Alpha", "alpha"],
      ["Zeta", "zeta-org"],
    ]);
    expect(orgs[1].gsocUrl).toBe("https://summerofcode.withgoogle.com/programs/2027/organizations/zeta");
    expect(orgs[1].techTags).toEqual(["python"]);
  });

  it("returns nothing for unexpected data", () => {
    expect(parseGsocOrgs({ error: "nope" }, 2027)).toEqual([]);
  });
});

describe("newerSnapshot", () => {
  const snap = (year: number, fetchedAt: string, count = 1): GsocSnapshot => ({
    year,
    fetchedAt,
    source: "",
    orgs: Array.from({ length: count }, (_, index) => ({ name: `o${index}`, slug: `o${index}`, github: `o${index}`, website: "", techTags: [], topicTags: [], ideasUrl: "", guidanceUrl: "", gsocUrl: "" })),
  });

  it("prefers a later year, then a later fetch", () => {
    expect(newerSnapshot(snap(2026, "2026-10-26"), snap(2027, "2027-02-20")).year).toBe(2027);
    expect(newerSnapshot(snap(2027, "2027-02-20"), snap(2026, "2026-12-01")).year).toBe(2027);
    expect(newerSnapshot(snap(2026, "2026-10-26"), snap(2026, "2026-11-01")).fetchedAt).toBe("2026-11-01");
  });

  it("ignores a missing or empty saved copy", () => {
    expect(newerSnapshot(snap(2026, "2026-10-26"), null).year).toBe(2026);
    expect(newerSnapshot(snap(2026, "2026-10-26"), snap(2027, "2027-02-20", 0)).year).toBe(2026);
  });
});

describe("refreshableYears", () => {
  it("offers next year down to the saved year", () => {
    expect(refreshableYears(2026, new Date("2026-10-27"))).toEqual([2027, 2026]);
    expect(refreshableYears(2026, new Date("2028-03-01"))).toEqual([2029, 2028, 2027, 2026]);
  });
});
