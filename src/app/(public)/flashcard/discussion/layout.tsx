import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FEATURES } from "@/constants";

// Konten buatan pengguna. Seperti /discussion, tidak diindeks mesin pencari
// (lihat juga `robots.ts`). Segmen /flashcard sendiri sudah 404 saat modul
// flashcard mati; flag ini menutup permukaan diskusinya saja.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FlashcardDiscussionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.flashcardDiscussion) notFound();

  return children;
}
