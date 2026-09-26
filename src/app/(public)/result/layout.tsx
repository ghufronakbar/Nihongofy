import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import type { Metadata } from "next";

// Halaman hasil terikat attempt tertentu dan sering ditempel ke chat. Tidak
// diindeks, tapi preview share default dari root tetap berlaku.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResultLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.testPackage) notFound();

  return children;
}
