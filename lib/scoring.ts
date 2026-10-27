// Optional priority score for an issue, from 0 to 100.
// Each part lists the points it gave and why, so the UI can show the full breakdown.
// Missing data scores 0 for that part and is marked "not checked" rather than guessed.
import { BEGINNER_LABELS } from "./constants";
import type { ActivitySignals, IssueResult } from "./github/types";

export type ScorePart = { label: string; points: number; max: number; note: string };
export type IssueScore = { total: number; parts: ScorePart[] };

export type ScorePreferences = { languages: string[]; topics: string[] };

const DAY = 86400000;

export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : Math.max(0, Math.floor((now - time) / DAY));
}

function repoActivity(issue: IssueResult, now: number): ScorePart {
  const days = daysSince(issue.repo?.pushedAt, now);
  if (days === null) return { label: "Repo activity", points: 0, max: 20, note: "Last push not checked" };
  if (days <= 7) return { label: "Repo activity", points: 20, max: 20, note: `Pushed ${days} days ago` };
  if (days <= 30) return { label: "Repo activity", points: 12, max: 20, note: `Pushed ${days} days ago` };
  if (days <= 90) return { label: "Repo activity", points: 5, max: 20, note: `Pushed ${days} days ago` };
  return { label: "Repo activity", points: 0, max: 20, note: `No push for ${days} days` };
}

function clarity(issue: IssueResult): ScorePart {
  let points = 0;
  const notes: string[] = [];
  if (issue.bodyLength >= 300) {
    points += 12;
    notes.push("detailed description");
  } else if (issue.bodyLength >= 80) {
    points += 6;
    notes.push("short description");
  } else {
    notes.push("little or no description");
  }
  const names = issue.labels.map((label) => label.name.toLowerCase());
  if (names.some((name) => BEGINNER_LABELS.includes(name))) {
    points += 8;
    notes.push("beginner label");
  }
  return { label: "Issue clarity", points, max: 20, note: notes.join(", ") };
}

function relevance(issue: IssueResult, prefs: ScorePreferences): ScorePart {
  if (!issue.repo) return { label: "Relevance", points: 0, max: 25, note: "Repo language and topics not checked" };
  let points = 0;
  const notes: string[] = [];
  const language = issue.repo.language?.toLowerCase();
  const wanted = prefs.languages.map((label) => label.toLowerCase());
  const cpp = language === "c++" && wanted.includes("c++");
  if (language && (wanted.includes(language) || cpp)) {
    points += 15;
    notes.push(`${issue.repo.language} is one of your languages`);
  }
  const topicHits = issue.repo.topics.filter((topic) => prefs.topics.includes(topic));
  if (topicHits.length) {
    points += Math.min(10, topicHits.length * 5);
    notes.push(`topics: ${topicHits.join(", ")}`);
  }
  return { label: "Relevance", points, max: 25, note: notes.join("; ") || "No overlap with your languages or topics" };
}

function freshness(issue: IssueResult, now: number): ScorePart {
  const days = daysSince(issue.updatedAt, now) ?? 999;
  if (days <= 14) return { label: "Issue freshness", points: 15, max: 15, note: `Updated ${days} days ago` };
  if (days <= 60) return { label: "Issue freshness", points: 8, max: 15, note: `Updated ${days} days ago` };
  return { label: "Issue freshness", points: 0, max: 15, note: `No update for ${days} days` };
}

function availability(issue: IssueResult): ScorePart {
  let points = 0;
  const notes: string[] = [];
  if (issue.assignees.length === 0) {
    points += 10;
    notes.push("unassigned");
  } else {
    notes.push(`assigned to ${issue.assignees.join(", ")}`);
  }
  if (issue.comments <= 8) {
    points += 5;
    notes.push(`${issue.comments} comments`);
  } else {
    notes.push(`${issue.comments} comments, may be crowded`);
  }
  return { label: "Availability", points, max: 15, note: notes.join(", ") };
}

function engagement(activity: ActivitySignals | undefined, now: number): ScorePart {
  if (!activity) return { label: "Maintainer engagement", points: 0, max: 5, note: "Not checked. Use Check activity." };
  let points = 0;
  const notes: string[] = [];
  if (activity.mergedPrs && activity.mergedPrs.last30Days > 0) {
    points += 2;
    notes.push(`${activity.mergedPrs.last30Days} PRs merged in 30 days`);
  }
  const lastReply = daysSince(activity.issue?.lastMaintainerCommentAt ?? activity.repoComments?.lastMaintainerCommentAt, now);
  if (lastReply !== null && lastReply <= 30) {
    points += 3;
    notes.push(`maintainer commented ${lastReply} days ago`);
  }
  return { label: "Maintainer engagement", points, max: 5, note: notes.join(", ") || "No recent merges or maintainer comments found" };
}

export function scoreIssue(
  issue: IssueResult,
  prefs: ScorePreferences,
  activity?: ActivitySignals,
  now = Date.now(),
): IssueScore {
  const parts = [
    repoActivity(issue, now),
    clarity(issue),
    relevance(issue, prefs),
    freshness(issue, now),
    availability(issue),
    engagement(activity, now),
  ];
  return { total: parts.reduce((sum, part) => sum + part.points, 0), parts };
}

export const SCORE_EXPLANATION =
  "Repo activity (20) + issue clarity (20) + relevance to your languages and topics (25) + issue freshness (15) + availability (15) + maintainer engagement (5, only after Check activity). It ranks what to read first. It does not predict whether a PR will be reviewed.";
