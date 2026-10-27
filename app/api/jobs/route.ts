import { NextResponse, type NextRequest } from "next/server";
import { badRequest } from "@/lib/apiResponse";
import { JOB_PROVIDERS, findProvider } from "@/lib/jobs";

// GET /api/jobs                          -> list of job sources
// GET /api/jobs?source=remotive&q=react  -> postings from one source
export async function GET(request: NextRequest) {
  const providers = JOB_PROVIDERS.map(({ id, name, homepage, notes }) => ({ id, name, homepage, notes }));
  const sourceId = request.nextUrl.searchParams.get("source");
  if (!sourceId) return NextResponse.json({ providers });

  const provider = findProvider(sourceId);
  if (!provider) return badRequest(`Unknown job source "${sourceId}".`);

  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  try {
    const items = await provider.search(query);
    return NextResponse.json({ providers, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The job source did not respond.";
    return NextResponse.json({ error: { message: `${provider.name}: ${message}`, kind: "upstream" } }, { status: 502 });
  }
}
