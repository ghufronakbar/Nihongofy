import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function BunpouLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.bunpou) notFound();

  return children;
}
