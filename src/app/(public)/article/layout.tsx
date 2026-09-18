import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function ArticleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.article) notFound();

  return children;
}
