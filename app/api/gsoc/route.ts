import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { badRequest } from "@/lib/apiResponse";
import { gsocSourceUrl, parseGsocOrgs, type GsocSnapshot } from "@/lib/gsoc";

// POST /api/gsoc { year } — the same job as `npm run update:gsoc`, from a button.
// Fetches one year's organization list from the GSoC website (cached for a day, so repeated
// presses do not hit GSoC again) and returns it. The page keeps it in your browser.
// When the app runs on your own computer it also rewrites data/gsoc-orgs.json, so you can
// commit the new list. Vercel's file system is read-only, so there it only returns the list.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { year?: unknown } | null;
  const year = Number(body?.year);
  const thisYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2016 || year > thisYear + 1) return badRequest(`Pick a year between 2016 and ${thisYear + 1}.`);

  let response: Response;
  try {
    response = await fetch(gsocSourceUrl(year), { headers: { "User-Agent": "oss-finder (manual refresh)" }, next: { revalidate: 86400 } });
  } catch {
    return NextResponse.json({ error: { message: "Could not reach the GSoC website.", kind: "network" } }, { status: 502 });
  }
  if (response.status === 404) {
    return NextResponse.json(
      { error: { message: `GSoC ${year} organizations are not published yet. They usually appear early in the year.`, kind: "not_found" } },
      { status: 404 },
    );
  }
  if (!response.ok) {
    return NextResponse.json({ error: { message: `The GSoC website returned ${response.status}.`, kind: "upstream" } }, { status: 502 });
  }

  const orgs = parseGsocOrgs(await response.json().catch(() => null), year);
  if (!orgs.length) {
    return NextResponse.json(
      { error: { message: `No GSoC ${year} organizations with a GitHub account were found. The list may not be published yet, or GSoC changed its format.`, kind: "not_found" } },
      { status: 404 },
    );
  }

  const snapshot: GsocSnapshot = { year, fetchedAt: new Date().toISOString().slice(0, 10), source: gsocSourceUrl(year), orgs };
  let savedToFile = false;
  if (!process.env.VERCEL) {
    try {
      await writeFile(path.join(process.cwd(), "data", "gsoc-orgs.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
      savedToFile = true;
    } catch {
      // Read-only file system. The browser copy is enough.
    }
  }

  return NextResponse.json({ snapshot, savedToFile });
}
