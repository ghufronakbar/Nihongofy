import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function ProgressLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.progress) notFound();

  return children;
}
