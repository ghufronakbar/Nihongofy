import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function ResultLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.testPackage) notFound();

  return children;
}
