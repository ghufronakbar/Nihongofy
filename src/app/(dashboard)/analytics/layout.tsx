import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function AnalyticsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.analytics) notFound();

  return children;
}
