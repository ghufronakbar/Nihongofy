import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFlashcardSettings } from "@/features/flashcard/lib/collection";
import { FlashcardSettingsForm } from "@/features/flashcard/components/flashcard-settings-form";
import { privateMetadata } from "@/lib/seo";

export const metadata: Metadata = privateMetadata(
  "Pengaturan flashcard",
  "Ukuran teks kartu, furigana, dan penjadwalan review seperti Anki.",
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
        Berlaku untuk semua deck. Tombol ↺ mengembalikan satu pengaturan ke nilai bawaannya.
      </p>

      <div className="mt-7">
        <FlashcardSettingsForm config={settings.config} display={settings.display} />
      </div>
    </main>
  );
}
