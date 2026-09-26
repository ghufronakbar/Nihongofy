import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function ReportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.report) notFound();

  return children;
}
