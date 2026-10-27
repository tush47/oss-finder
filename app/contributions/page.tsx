import type { Metadata } from "next";
import { Contributions } from "@/components/Contributions";

export const metadata: Metadata = { title: "My Contributions" };

export default function ContributionsPage() {
  return <Contributions />;
}
