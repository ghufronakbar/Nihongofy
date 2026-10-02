import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

// Konten buatan pengguna, diindeks seperti /discussion. Segmen /flashcard
// sendiri sudah 404 saat modul flashcard mati; flag ini menutup permukaan
// diskusinya saja.

export default function FlashcardDiscussionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.flashcardDiscussion) notFound();

  return children;
}
