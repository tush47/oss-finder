import type { Metadata } from "next";
import { RepoExplorer } from "@/components/RepoExplorer";

export const metadata: Metadata = { title: "Repositories" };

export default function ReposPage() {
  return <RepoExplorer />;
}
