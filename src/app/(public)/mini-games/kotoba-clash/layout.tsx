import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function KotobaClashLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.kotobaClash) notFound();
  return children;
}
