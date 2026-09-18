import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function FlashcardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.flashcard) notFound();

  return children;
}
