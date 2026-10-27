# OSS Finder

A personal web app for finding open-source issues to work on, tracking your pull requests, and following up on jobs that come out of open-source work.

It runs locally with `npm run dev` and deploys to Vercel as-is. Everything you save (bookmarks, contributions, jobs, presets) stays in your browser's local storage. There is no database or login.

## What it does

| Page | What you can do |
| --- | --- |
| **Dashboard** | Issues found in your last search, bookmarks, tracked contributions, your merged/open/closed PR counts, recently seen repos, quick language filters, API status. |
| **Find Issues** | Search open issues or PRs by language, labels, repo topics, minimum stars, owner, creation date, repo last push, unassigned, and keywords. Bookmark, track, check maintainer activity, see a priority score with its breakdown, and save filter presets. |
| **Repositories** | Find repos by language, topics, stars, last push, owner, beginner-friendly issues, and contributing guide. Optionally limit to Google Summer of Code organizations. Save repos and add their owners to your follow-up list. |
| **My Contributions** | Track repo, issue URL, PR URL, status (planned, in progress, open, merged, closed), notes, start date, and next action. Loads your public PRs from GitHub and shows merged, open, draft, and closed-without-merge separately. |
| **Jobs** | Search Remotive and Hacker News "Who is hiring?". Save postings, add any job link by hand, track application status and whether you confirmed the role accepts applicants from India, and keep notes on companies and maintainers. |
| **Settings** | GitHub username, preferred languages and topics, API status, a **Data sources** panel listing every platform the app combines, a **Refresh GSoC list** button, and export/import/clear your data. Light, dark, or system theme is in the sidebar. |

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # optional: add GITHUB_TOKEN
npm run dev                  # http://localhost:3000
```

Other commands:

```bash
npm test             # unit tests for queries, scoring, PR status, location matching
npm run typecheck    # TypeScript check
npm run build        # production build
npm run update:gsoc  # refresh the GSoC organization list (or use the button in Settings)
```

## GitHub token (optional, recommended)

The app works without a token, but GitHub's anonymous limits are small and shared by everyone using the same server IP.

1. Open https://github.com/settings/personal-access-tokens/new.
2. Name it `oss-finder`, pick an expiry, and set **Repository access** to **Public repositories (read-only)**. Add no other permissions.
3. Generate the token and put it in `.env.local`:
   ```
   GITHUB_TOKEN=github_pat_...
   ```
4. Restart `npm run dev`. Settings → GitHub API should say "GitHub token configured".

The token is read only by server code (`lib/github/client.ts`) and is never sent to the browser. Never name it `NEXT_PUBLIC_GITHUB_TOKEN`: Next.js puts every `NEXT_PUBLIC_` variable into the browser bundle.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. On https://vercel.com/new, import the repository. The defaults are correct (framework Next.js, build `npm run build`).
3. Under **Settings → Environment Variables**, add `GITHUB_TOKEN` for Production (and Preview if you use it).
4. Deploy. Changing the variable later needs a redeploy.

Without a token on Vercel, anonymous GitHub limits apply to Vercel's shared outgoing IPs and run out quickly, so add one.

The deployed app has no login. Anyone with the URL can use it and spend your token's rate limit, but they cannot see the token or your saved data, which stays in your own browser.

## Data sources and limits

| Source | Used for | API | Limits | Caching here |
| --- | --- | --- | --- | --- |
| GitHub Search API | Issues, PRs, repositories, your PRs | Official REST, [docs](https://docs.github.com/en/rest/search/search) | 10 searches/min anonymous, 30/min with token. At most 1,000 results per search. | 5–10 min |
| GitHub REST API | Repo details, community profile, comments for Check activity | Official REST | 60/hour anonymous, 5,000/hour with token | 15 min – 1 day |
| GitHub GraphQL API | Contributing guide links for a page of repos | Official, token required | 5,000 points/hour | 1 day |
| Remotive | Remote job listings | [Public API](https://remotive.com/api-documentation) | Returns at most 10 jobs per request. Remotive asks for no more than ~4 requests a day, a link back to each job, and Remotive named as the source. Jobs appear 24 h after Remotive posts them. | 6 hours per search |
| Hacker News via Algolia | "Ask HN: Who is hiring?" posts | [HN Search API](https://hn.algolia.com/api) | 10,000 requests/hour per IP | 1 hour |
| Google Summer of Code | Organization list for the GSoC filter | No public API. Settings → Data sources → **Refresh GSoC list** (or `npm run update:gsoc`) reads the JSON the GSoC website itself loads, only when you ask. | One request per refresh | Bundled in `data/gsoc-orgs.json`; a refreshed copy is kept in your browser |

Caching uses Next.js `fetch` caching in the API routes, so repeating a search within the cache window costs no rate limit.

### Refreshing GSoC for a new year

GSoC usually publishes its organizations early in the year. When it does, open **Settings → Data sources**, pick the year, and press **Refresh GSoC list**. If that year is not out yet, you are told and the current list stays.

- The new list is saved in your browser and used on Repositories straight away, both locally and on Vercel.
- When the app runs on your computer, the button also rewrites `data/gsoc-orgs.json`. Commit that file so your deployed app ships with the new list for everyone. On Vercel the file system is read-only, so only the browser copy is updated.
- **Use bundled list** switches back to the file that shipped with the app.

### GitHub search rules the app works around

These were checked against the live API:

- **Issue search cannot filter by stars, repo topics, or last push.** When you use one of those filters, the app first finds the 40 most-starred repos that match them, then searches issues inside those repos. The results page says when it does this.
- **Several topics mean ALL of them.** GitHub has no "any of these topics" search. The UI says so.
- Several languages, labels (`label:"a","b"`), `repo:` or `user:` filters mean ANY of them.
- The GSoC filter searches at most 20 organizations at a time, because GitHub stops applying extra `user:` filters in long queries. Pick one organization to see all of its repos.
- "Open issues" on a repository card is GitHub's `open_issues_count`, which counts open pull requests too.

### Requests per action

- An issue search page costs 2 searches: one for issues, one for the details of their repos (3 when stars, topics, or last push are set).
- A repository search page costs 1 search (plus 1 GraphQL request with a token).
- **Check activity** runs only when you click it: 1 search plus 3–4 REST requests, cached for up to an hour.
- Your PR list costs 1 search, cached for 5 minutes.

When a limit is reached, the page shows when it resets.

## Maintainer activity signals and the score

**Check activity** shows only what GitHub reports:

- last push to the repo and its open issue + PR count
- number of PRs merged in the last 30 days, and the latest merge
- issue comments in the repo in the last 14 days (from the latest 30)
- the latest comment by a maintainer, meaning the repo owner, an org member, or a collaborator according to GitHub's `author_association`
- maintainer replies and the last comment on that issue
- the contributing guide, if there is one

The app does not compute an average response time. A few dozen comments are not enough to estimate one honestly.

The **score** (0–100) helps decide what to read first. Click it on any card for the breakdown:

| Part | Max | Based on |
| --- | --- | --- |
| Repo activity | 20 | Days since the last push (≤7 days: 20, ≤30: 12, ≤90: 5) |
| Issue clarity | 20 | Description length (12) and a beginner label such as good first issue, help wanted, or documentation (8) |
| Relevance | 25 | Repo language is one of your languages (15), and repo topics match your topics (5 each, max 10) |
| Issue freshness | 15 | Days since the issue was updated (≤14: 15, ≤60: 8) |
| Availability | 15 | Unassigned (10), 8 or fewer comments (5) |
| Maintainer engagement | 5 | After Check activity: PRs merged in 30 days (2), maintainer comment in 30 days (3) |

Missing data scores 0 and is labeled "not checked". The code is in `lib/scoring.ts`.

## Jobs: what the app will and will not do

- Results come straight from Remotive or Hacker News. Location and salary are shown only when the source provides them, and are labeled "from source".
- "Mentions India / Worldwide / APAC" chips only report words found in the posting text. They are not an eligibility check.
- Whether a role accepts applicants from India is a field **you** set after reading the posting. The app never guesses it.
- For sites without an API, such as LinkedIn or company careers pages, save the link by hand under **My job list**.

### Adding a job source

1. Confirm the source has an official API or a feed you are allowed to use, and read its terms.
2. Create `lib/jobs/mysource.ts`:
   ```ts
   import "server-only";
   import type { JobProvider } from "./types";

   export const mySource: JobProvider = {
     id: "mysource",
     name: "My Source",
     homepage: "https://example.com",
     notes: "What it covers, its limits, and its terms.",
     async search(query) {
       const response = await fetch(`https://example.com/api/jobs?q=${encodeURIComponent(query)}`, {
         next: { revalidate: 3600 }, // cache for an hour
       });
       if (!response.ok) throw new Error(`My Source returned ${response.status}.`);
       const data = await response.json();
       return data.jobs.map((job: any) => ({
         id: `mysource-${job.id}`,
         source: "My Source",
         title: job.title,
         company: job.company ?? null,
         url: job.url,
         location: job.location ?? null, // null when the source does not say
         salary: job.salary ?? null,     // never fill this in yourself
         publishedAt: job.date ?? null,
         excerpt: "",
         tags: [],
       }));
     },
   };
   ```
3. Add it to the list in `lib/jobs/index.ts`. It then appears in the Jobs page's source menu.

## Project layout

```
app/
  page.tsx, issues/, repos/, contributions/, jobs/, settings/   pages (thin wrappers)
  api/issues      issue and PR search
  api/repos       repository search, GSoC filter, contributing guides
  api/activity    maintainer activity signals for one repo or issue
  api/prs         a user's public pull requests
  api/jobs        job sources
  api/status      token configured? rate limit left?
  api/gsoc        refresh the GSoC organization list
components/       page components (IssueFinder, RepoExplorer, Contributions, Jobs, ...) and ui.tsx
lib/
  github/client.ts     the only code that calls GitHub; adds the token, reads rate limits, maps errors
  github/queries.ts    builds GitHub search queries from filters (pure, tested)
  github/mappers.ts    turns GitHub responses into the app's types
  github/repoLookup.ts repo search, batch repo details, contributing guides
  jobs/                job providers, and the location-word matcher
  gsoc.ts, useGsoc.ts  GSoC list parsing, and which copy (bundled or refreshed) is in use
  scoring.ts           the priority score
  prStatus.ts          merged vs closed vs open vs draft
  storage.ts           useStored(): useState saved to localStorage
  constants.ts         languages, topics, labels, page sizes: edit these to change the filter options
data/gsoc-orgs.json    GSoC organizations (refresh with npm run update:gsoc)
tests/                 Vitest unit tests
```

### Common changes

- **Add a language or topic to the filters:** edit `LANGUAGES` or `TOPICS` in `lib/constants.ts`. Topics must be GitHub topic slugs (lowercase, dashes).
- **Change the score:** edit `lib/scoring.ts` and update `tests/scoring.test.ts`.
- **Add a GitHub filter:** add the field to `IssueFilters` or `RepoFilters` in `lib/github/queries.ts`, add it to `build…Query` and `encode…/decode…`, add a test, then add the control in `components/IssueFinder.tsx` or `components/RepoExplorer.tsx`.
- **Move saved data to a database later:** every read and write goes through `useStored` in `lib/storage.ts`, so that is the one place to change.

## Known limitations

- GitHub search returns at most 1,000 results per query, so pagination stops at page 50.
- With stars, topics, or last-push filters, issues come only from the top 40 matching repos by stars.
- The contributing guide filter needs a token, and it filters each page after the search, so some pages have fewer than 20 repos.
- Activity signals sample recent data (latest 30 repo comments, first 100 comments on an issue). They show recent attention, not guaranteed review times.
- Saved data lives in one browser. Use Settings → Export to back it up or move it.
