import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function HistoryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.history) notFound();

  return children;
}
