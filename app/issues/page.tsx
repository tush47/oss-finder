import type { Metadata } from "next";
import { Suspense } from "react";
import { IssueFinder } from "@/components/IssueFinder";
import { CardSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Find Issues" };

export default function IssuesPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <IssueFinder />
    </Suspense>
  );
}
