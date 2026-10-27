// A job posting as shown in the app. Every field comes straight from the source.
// Fields the source does not provide stay null. We never fill them in.
export type JobPosting = {
  id: string;
  source: string;
  title: string;
  company: string | null;
  url: string;
  location: string | null;
  salary: string | null;
  publishedAt: string | null;
  excerpt: string;
  tags: string[];
};

export type JobProvider = {
  id: string;
  name: string;
  homepage: string;
  // Shown in the UI so it is clear where results come from and what the terms are.
  notes: string;
  search(query: string): Promise<JobPosting[]>;
};
