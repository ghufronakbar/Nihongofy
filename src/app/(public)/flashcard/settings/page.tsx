import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFlashcardSettings } from "@/features/flashcard/lib/collection";
import { FlashcardDisplayForm } from "@/features/flashcard/components/flashcard-display-form";
import { privateMetadata } from "@/lib/seo";

export const metadata: Metadata = privateMetadata(
  "Pengaturan flashcard",
  "Ukuran teks dan furigana kartu flashcard.",
);

export default async function FlashcardSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard/settings");

  const settings = await getFlashcardSettings(session.userId);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Deck saya
      </Link>
      <h1 className="mt-4 text-3xl font-black">Pengaturan flashcard</h1>
      <p className="mt-2 font-bold text-muted-foreground">
        Tampilan kartu berlaku untuk semua deck. Batas harian, learning steps, urutan, dan FSRS
        diatur per deck lewat tombol Pengaturan di halaman deck.
      </p>

      <div className="mt-7">
        <FlashcardDisplayForm display={settings.display} />
      </div>
    </main>
  );
}
