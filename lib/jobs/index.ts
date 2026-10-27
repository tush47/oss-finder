import "server-only";
import { hackerNews } from "./hackerNews";
import { remotive } from "./remotive";
import type { JobProvider } from "./types";

// To add a job source: create a file like remotive.ts that exports a JobProvider,
// then add it to this list. The Jobs page picks it up automatically.
export const JOB_PROVIDERS: JobProvider[] = [remotive, hackerNews];

export function findProvider(id: string): JobProvider | undefined {
  return JOB_PROVIDERS.find((provider) => provider.id === id);
}
