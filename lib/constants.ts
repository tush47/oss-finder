// Options shown in the filter panels. Edit these lists to change what the app offers.

export const LANGUAGES = [
  { label: "TypeScript", query: "typescript", gsocTags: ["typescript"] },
  { label: "JavaScript", query: "javascript", gsocTags: ["javascript", "node.js", "nodejs", "react"] },
  { label: "Python", query: "python", gsocTags: ["python"] },
  { label: "Java", query: "java", gsocTags: ["java"] },
  { label: "C++", query: "cpp", gsocTags: ["c++", "cpp"] },
  { label: "Go", query: "go", gsocTags: ["go", "golang"] },
] as const;

// GitHub topics are lowercase slugs. The label is what the UI shows.
export const TOPICS = [
  { label: "AI", slug: "ai" },
  { label: "LLM", slug: "llm" },
  { label: "RAG", slug: "rag" },
  { label: "Agents", slug: "ai-agents" },
  { label: "Backend", slug: "backend" },
  { label: "APIs", slug: "api" },
  { label: "Databases", slug: "database" },
  { label: "React", slug: "react" },
  { label: "Developer tools", slug: "developer-tools" },
] as const;

export const LABELS = ["good first issue", "help wanted", "bug", "documentation", "testing", "enhancement"] as const;

export const BEGINNER_LABELS = ["good first issue", "help wanted", "documentation", "first-timers-only", "beginner"];

// author_association values GitHub uses for people with write access or org membership.
export const MAINTAINER_ROLES = ["OWNER", "MEMBER", "COLLABORATOR"];

export const ISSUES_PER_PAGE = 20;
export const REPOS_PER_PAGE = 20;
// GitHub search never returns more than 1,000 results for one query.
export const SEARCH_RESULT_CAP = 1000;
// How many repositories to search inside when stars, topics, or last-pushed filters are used.
export const SCOPE_REPO_LIMIT = 40;
// How many GSoC organizations to put in one repository search.
export const GSOC_ORG_LIMIT = 20;

export const ROLE_SEARCHES = ["backend", "typescript", "node.js", "react", "machine learning"] as const;

export const CONTRIBUTION_STATUSES = ["planned", "in-progress", "open", "merged", "closed"] as const;
export const JOB_STATUSES = ["saved", "applied", "interviewing", "offer", "rejected", "closed"] as const;
export const FOLLOW_UP_KINDS = ["company", "organization", "maintainer"] as const;
