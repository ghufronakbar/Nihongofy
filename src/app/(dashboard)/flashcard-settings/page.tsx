import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { FlashcardSettingsForm } from "@/features/vocabulary/components/flashcard-settings-form";
import { getFlashcardSettingsAction } from "@/features/vocabulary/settings-actions";

export const metadata: Metadata = {
  title: "Pengaturan Flashcard",
  description: "Atur antrean dan interval spaced repetition vocabulary.",
};

export default async function FlashcardSettingsPage() {
  const settings = await getFlashcardSettingsAction();

  return (
    <main className="page-reveal mx-auto grid w-full max-w-4xl gap-6 pb-10">
      <header>
        <p className="font-mono text-xs font-black tracking-widest uppercase">STUDY / FLASHCARDS</p>
        <h1 className="mt-2 text-4xl sm:text-6xl">Pengaturan SRS</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Parameter di halaman ini langsung dipakai antrean dan scheduler vocabulary, bukan sekadar tampilan mock.</p>
      </header>

      <section className="neo-surface flex items-center gap-5 bg-neo-yellow p-5 sm:p-7">
        <span className="grid size-14 shrink-0 place-items-center border-[3px] border-black bg-white shadow-neo-sm">
          <Settings2 className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-2xl">Spaced repetition</h2>
          <p className="mt-1 text-sm font-semibold text-black/65">Buka hanya kelompok yang ingin diubah. Range diperiksa di browser, Server Action, dan constraint database.</p>
        </div>
      </section>

      <FlashcardSettingsForm initialValues={settings} />
    </main>
  );
}
