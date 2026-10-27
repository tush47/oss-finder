import type { Metadata } from "next";
import { Jobs } from "@/components/Jobs";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage() {
  return <Jobs />;
}
