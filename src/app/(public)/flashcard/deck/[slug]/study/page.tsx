import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { getStudySession } from "@/features/flashcard/data";
import { FlashcardReviewer } from "@/features/flashcard/components/flashcard-reviewer";
import { FlashcardDeckSlugSchema } from "@/features/flashcard/schemas";
import { privateMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = privateMetadata(
  "Sesi belajar flashcard",
  "Sesi review flashcard dengan penjadwalan FSRS.",
);

export default async function StudyPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const parsedSlug = FlashcardDeckSlugSchema.safeParse(rawSlug);
  if (!parsedSlug.success) notFound();
  const slug = parsedSlug.data;

  const session = await getSession();
  if (!session) redirect(`/login?next=/flashcard/deck/${slug}`);

  const study = await getStudySession(session.userId, slug);
  if (!study) notFound();
  // Belajar hanya untuk deck yang sudah ditambahkan; halaman deck menawarkan
  // tombol tambahnya.
  if (!study.subscribed) redirect(`/flashcard/deck/${slug}`);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <FlashcardReviewer
        // Kunci baru setiap kali server membangun antrean ("Lanjutkan" memanggil
        // router.refresh), supaya state sesi dimulai ulang dari antrean baru.
        key={`${study.cards.map((card) => card.vocabId).join(",")}|${study.pendingLearning.length}`}
        deckName={study.deck.name}
        deckHref={`/flashcard/deck/${slug}`}
        cards={study.cards}
        pendingLearning={study.pendingLearning}
        hasMore={study.hasMore}
        display={study.display}
        isGuest={false}
        reportEnabled={FEATURES.report}
      />
    </main>
  );
}
