import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function PublicProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.publicProfile) notFound();

  return children;
}
