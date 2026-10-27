import type { PrStatus } from "./github/types";

/**
 * GitHub reports a pull request as "open" or "closed". A closed PR was merged only if it has a
 * merge date, so closed PRs without one are reported as "closed" (not merged).
 */
export function classifyPr(pr: { state?: string; draft?: boolean; mergedAt?: string | null }): PrStatus {
  if (pr.mergedAt) return "merged";
  if (pr.state === "open") return pr.draft ? "draft" : "open";
  return "closed";
}

export const PR_STATUS_LABELS: Record<PrStatus, string> = {
  draft: "Draft",
  open: "Open",
  merged: "Merged",
  closed: "Closed, not merged",
};
