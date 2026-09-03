import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  FlashcardReviewer,
  type ReviewerCard,
} from "@/features/flashcard/components/flashcard-reviewer";
import { renderCard } from "@/features/flashcard/lib/render/card-content";
import { formatIntervalLabel } from "@/features/flashcard/lib/preview-interval";
import { createNewCardState, previewSchedule } from "@/features/flashcard/lib/scheduler";
import { countCardsForNote } from "@/features/flashcard/note-types";
import {
  FLASHCARD_DEFAULT_PRESET_CONFIG,
  type FlashcardRatingInput,
} from "@/features/flashcard/schemas";

/**
 * Mode coba: siapa pun boleh mencicipi deck bawaan tanpa akun.
 *
 * Tidak ada koleksi, tidak ada revlog, tidak ada penjadwalan yang disimpan —
 * seluruh antrean hidup di state React reviewer. Modul vocabulary lama pernah
 * memberi kesan progres guest tersimpan padahal tidak; di sini statusnya
 * dinyatakan eksplisit lewat banner di reviewer.
 */

const TRY_CARD_LIMIT = 20;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const deck = await prisma.flashcardSystemDeck.findFirst({
    where: { slug, isPublished: true },
    select: { name: true, description: true },
  });
  if (!deck) return { title: "Coba deck" };

  return {
    title: `Coba ${deck.name}`,
    description: deck.description,
  };
}

export default async function TryDeckPage({ params }: Props) {
  const { slug } = await params;

  const deck = await prisma.flashcardSystemDeck.findFirst({
    where: { slug, isPublished: true },
    select: {
      name: true,
      noteType: true,
      notes: {
        orderBy: { order: "asc" },
        take: TRY_CARD_LIMIT,
        select: { guid: true, fields: true },
      },
    },
  });
  if (!deck) notFound();

  const session = await getSession();
  const now = new Date();


  // Guest selalu bertemu kartu baru, jadi preview cukup dihitung sekali.
  const preview = previewSchedule({
    card: createNewCardState(now),
    now,
    config: FLASHCARD_DEFAULT_PRESET_CONFIG,
    day: { timeZone: "Asia/Jakarta", rolloverHour: 4 },
  });
  const previewLabels = Object.fromEntries(
    (["AGAIN", "HARD", "GOOD", "EASY"] as FlashcardRatingInput[]).map((rating) => [
      rating,
      formatIntervalLabel(now, preview[rating].card.due),
    ]),
  ) as Record<FlashcardRatingInput, string>;

  const cards: ReviewerCard[] = deck.notes.flatMap((note) =>
    Array.from({ length: countCardsForNote(deck.noteType, note.fields) }, (_, ord) => ({
      cardId: `${note.guid}:${ord}`,
      noteId: note.guid,
      deckName: deck.name,
      content: renderCard(deck.noteType, note.fields, ord),
      previewLabels,
      isNew: true,
    })),
  );

  if (cards.length === 0) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      {session ? (
        <p className="neo-surface mb-5 p-4 text-sm font-bold">
          Kamu sudah punya akun — tambahkan deck ini lewat{" "}
          <Link href="/flashcard/add" className="underline">
            Tambah deck
          </Link>{" "}
          supaya progresnya tersimpan dan dijadwalkan FSRS.
        </p>
      ) : null}
      <FlashcardReviewer
        deckName={deck.name}
        cards={cards}
        buriedCardIds={[]}
        // SELALU ephemeral, termasuk untuk user yang sudah login: `cardId` di sini
        // adalah guid katalog, bukan kartu milik siapa pun, jadi tidak ada yang
        // bisa (atau boleh) disimpan.
        isGuest
      />
    </main>
  );
}
