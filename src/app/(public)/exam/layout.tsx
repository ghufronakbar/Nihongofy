import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import type { Metadata } from "next";

// Sesi ujian tidak boleh diindeks: isinya soal, dan URL-nya terikat attempt.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ExamLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.testPackage) notFound();

  return children;
}
