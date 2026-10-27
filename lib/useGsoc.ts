"use client";

// The GSoC organization list in use: the copy bundled with the app (data/gsoc-orgs.json),
// or a newer one you fetched with the Refresh button, kept in this browser.
import bundled from "@/data/gsoc-orgs.json";
import { newerSnapshot, type GsocSnapshot } from "./gsoc";
import { KEYS, useStored } from "./storage";

export const bundledGsoc = bundled as GsocSnapshot;

export function useGsoc() {
  const [saved, setSaved] = useStored<GsocSnapshot | null>(KEYS.gsoc, null);
  const active = newerSnapshot(bundledGsoc, saved);
  return { active, fromBrowser: active !== bundledGsoc, save: setSaved };
}
