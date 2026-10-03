import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function PostLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.community) notFound();

  return children;
}
