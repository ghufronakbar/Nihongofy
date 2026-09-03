import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudyQueue } from "@/features/flashcard/data";
import {
  FlashcardReviewer,
  type ReviewerCard,
} from "@/features/flashcard/components/flashcard-reviewer";
import { previewSchedule } from "@/features/flashcard/lib/scheduler";
import { formatIntervalLabel } from "@/features/flashcard/lib/preview-interval";
import type { FlashcardRatingInput } from "@/features/flashcard/schemas";

type Props = { params: Promise<{ deckId: string }> };

export default async function StudyPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard");

  const { deckId } = await params;
  const id = Number(deckId);
  if (!Number.isInteger(id)) notFound();

  const queue = await getStudyQueue(session.userId, id);
  if (!queue) notFound();

  const now = new Date();

  // Interval tiap tombol dihitung server supaya client tidak perlu memuat
  // ts-fsrs sama sekali. Fuzz membuat angka ini bisa meleset beberapa persen
  // dari hasil akhir — perilaku yang sama dengan Anki.
  const cards: ReviewerCard[] = queue.cards.map((card) => {
    const preview = previewSchedule({
      card: {
        type: card.state.type,
        queue: card.state.queue,
        due: card.state.due,
        intervalDays: card.state.intervalDays,
        reps: card.state.reps,
        lapses: card.state.lapses,
        learningStep: card.state.learningStep,
        stability: card.state.stability,
        difficulty: card.state.difficulty,
        desiredRetention: null,
        easeFactor: card.state.easeFactor,
        lastReviewedAt: card.state.lastReviewedAt,
      },
      now,
      config: queue.config,
      day: queue.day,
    });

    const labels = Object.fromEntries(
      (["AGAIN", "HARD", "GOOD", "EASY"] as FlashcardRatingInput[]).map((rating) => [
        rating,
        formatIntervalLabel(now, preview[rating].card.due),
      ]),
    ) as Record<FlashcardRatingInput, string>;

    return {
      cardId: card.cardId,
      noteId: card.noteId,
      deckName: card.deckName,
      content: card.content,
      previewLabels: labels,
      isNew: card.state.type === "NEW",
    };
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <FlashcardReviewer

        deckName={queue.deck.name}
        cards={cards}
        buriedCardIds={queue.buriedCardIds}
        isGuest={false}
      />
    </main>
  );
}
