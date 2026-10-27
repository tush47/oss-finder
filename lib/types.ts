// Records saved in the browser (localStorage). Nothing here is sent to a server.
import type { CONTRIBUTION_STATUSES, FOLLOW_UP_KINDS, JOB_STATUSES } from "./constants";
import type { IssueFilters, RepoFilters } from "./github/queries";

export type Settings = {
  githubUsername: string;
  languages: string[];
  topics: string[];
};

export type BookmarkedIssue = {
  url: string;
  title: string;
  repoFullName: string;
  labels: string[];
  isPullRequest: boolean;
  savedAt: string;
};

export type SavedRepo = {
  fullName: string;
  url: string;
  description: string;
  language: string | null;
  stars: number;
  savedAt: string;
};

export type RecentRepo = {
  fullName: string;
  url: string;
  language: string | null;
  stars: number;
  seenAt: string;
};

export type Preset<T> = { id: string; name: string; filters: T };
export type IssuePreset = Preset<IssueFilters>;
export type RepoPreset = Preset<RepoFilters>;

export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export type Contribution = {
  id: string;
  repo: string;
  issueUrl: string;
  prUrl: string;
  status: ContributionStatus;
  notes: string;
  startedAt: string;
  nextAction: string;
  updatedAt: string;
};

export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobListing = {
  id: string;
  title: string;
  company: string;
  url: string;
  source: string;
  locationNote: string;
  // Set by you after reading the posting. The app never guesses this.
  indiaEligibility: "unknown" | "confirmed" | "not-eligible";
  status: JobStatus;
  notes: string;
  savedAt: string;
};

export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

export type FollowUp = {
  id: string;
  name: string;
  kind: FollowUpKind;
  url: string;
  notes: string;
  nextStep: string;
  savedAt: string;
};

export type SearchStats = { issueTotal: number | null; searchedAt: string | null };
