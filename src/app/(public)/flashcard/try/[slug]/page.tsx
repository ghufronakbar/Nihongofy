import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { buildPreviewLabels, getCatalogDeck, getTrySession } from "@/features/flashcard/data";
import { FlashcardReviewer } from "@/features/flashcard/components/flashcard-reviewer";
import { createNewCardState } from "@/features/flashcard/lib/scheduler";
import { EMPTY_STUDY_COUNTS } from "@/features/flashcard/lib/session-summary";
import { FLASHCARD_DEFAULT_ROLLOVER_HOUR } from "@/features/flashcard/lib/scheduler/day";
import {
  FLASHCARD_DEFAULT_CONFIG,
  FLASHCARD_DEFAULT_DISPLAY,
  FlashcardDeckSlugSchema,
} from "@/features/flashcard/schemas";
import type { ReviewerCard } from "@/features/flashcard/types";
import { DEFAULT_TIME_ZONE } from "@/lib/time-zone";
import { pageMetadata, privateMetadata } from "@/lib/seo";

/**
 * Mode coba: siapa pun boleh mencicipi deck bawaan tanpa akun.
 *
 * Tidak ada pengaturan, revlog, atau jadwal yang disimpan — seluruh antrean
 * hidup di state React reviewer, dan statusnya dinyatakan eksplisit lewat
 * banner di reviewer.
 */

type Props = { params: Promise<{ slug: string }> };

async function deckFromParams(params: Props["params"]) {
  const parsed = FlashcardDeckSlugSchema.safeParse((await params).slug);
  return parsed.success ? getCatalogDeck(parsed.data) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const deck = await deckFromParams(params);
  if (!deck) {
    return privateMetadata("Deck tidak ditemukan", "Deck yang kamu cari sudah tidak tersedia.");
  }

  return pageMetadata({
    title: `Coba deck ${deck.name}`,
    description: deck.description,
    path: `/flashcard/try/${deck.slug}`,
    ogTitle: `Coba flashcard ${deck.name} | Nihongofy`,
  });
}

export default async function TryDeckPage({ params }: Props) {
  const deck = await deckFromParams(params);
  if (!deck) notFound();

  const trial = await getTrySession(deck.slug);
  if (!trial || trial.rows.length === 0) notFound();

  const session = await getSession();
  const now = new Date();

  // Guest selalu bertemu kartu baru, jadi label tombol cukup dihitung sekali.
  const previewLabels = buildPreviewLabels(createNewCardState(now), now, {
    config: FLASHCARD_DEFAULT_CONFIG,
    day: { timeZone: DEFAULT_TIME_ZONE, rolloverHour: FLASHCARD_DEFAULT_ROLLOVER_HOUR },
  });
  const cards: ReviewerCard[] = trial.rows.map((row) => ({
    vocabId: row.vocabId,
    kind: "new",
    content: row.content,
    previewLabels,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      {session ? (
        <p className="neo-surface mb-5 p-4 text-sm font-bold">
          Kamu sudah punya akun —{" "}
          <Link href={`/flashcard/deck/${deck.slug}`} className="underline">
            tambahkan deck ini
          </Link>{" "}
          supaya progresnya tersimpan dan dijadwalkan FSRS.
        </p>
      ) : null}
      <FlashcardReviewer
        deckSlug={deck.slug}
        deckName={deck.name}
        back={{ href: "/flashcard", label: "Kembali ke katalog" }}
        cards={cards}
        pendingLearning={[]}
        unloadedCounts={EMPTY_STUDY_COUNTS}
        tomorrow={null}
        hasMore={false}
        display={FLASHCARD_DEFAULT_DISPLAY}
        // SELALU ephemeral, termasuk untuk user yang sudah login: mode coba
        // tidak boleh menyentuh jadwal siapa pun.
        isGuest
        // Guest boleh melapor (docs/module/report.md): dialognya meminta
        // Turnstile bila tidak ada session, sama seperti laporan dari ujian guest.
        reportEnabled={FEATURES.report}
      />
    </main>
  );
}
