import { describe, expect, it } from "vitest";
import { locationSignals, mentionsIndiaFriendlyLocation } from "@/lib/jobs/location";

describe("location signals", () => {
  it("reports only words the text contains", () => {
    expect(locationSignals("Remote (Worldwide)")).toEqual(["Worldwide", "Remote"]);
    expect(locationSignals("Europe, USA, Canada, APAC")).toEqual(["APAC"]);
    expect(locationSignals("Bengaluru, India or remote")).toEqual(["India", "Remote"]);
    expect(locationSignals(null)).toEqual([]);
  });

  it("does not match words inside other words", () => {
    expect(locationSignals("Indiana, USA")).toEqual([]);
    expect(locationSignals("Asian markets team in London")).toEqual([]);
  });

  it("flags India-friendly text but not US-only text", () => {
    expect(mentionsIndiaFriendlyLocation("Anywhere")).toBe(true);
    expect(mentionsIndiaFriendlyLocation("Remote, US only")).toBe(false);
  });
});
