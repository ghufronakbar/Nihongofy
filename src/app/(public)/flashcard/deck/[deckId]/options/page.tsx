import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeckOptionsForm } from "@/features/flashcard/components/deck-options-form";
import { ensureCollection, ensureDefaultPreset } from "@/features/flashcard/lib/collection";
import { parsePresetConfig } from "@/features/flashcard/schemas";

type Props = { params: Promise<{ deckId: string }> };

export default async function DeckOptionsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard");

  const { deckId } = await params;
  const id = Number(deckId);
  if (!Number.isInteger(id)) notFound();

  await ensureCollection(session.userId);
  await ensureDefaultPreset(session.userId);

  const deck = await prisma.flashcardDeck.findFirst({
    where: { id, userId: session.userId },
    select: {
      id: true,
      name: true,
      preset: { select: { id: true, name: true, config: true } },
    },
  });
  if (!deck) notFound();

  const [presets, subdeckCount] = await Promise.all([
    prisma.flashcardPreset.findMany({
      where: { userId: session.userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { decks: true } } },
    }),
    prisma.flashcardDeck.count({
      where: { userId: session.userId, name: { startsWith: `${deck.name}::` } },
    }),
  ]);

  const current = presets.find((preset) => preset.id === deck.preset.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href={`/flashcard/deck/${deck.id}`} className="text-sm font-black underline">
        ← {deck.name}
      </Link>

      <h1 className="mt-4 text-3xl font-black">Deck options</h1>
      <p className="mt-2 font-bold text-muted-foreground">
        Pengaturan penjadwalan untuk deck ini, mengikuti struktur deck options Anki.
      </p>

      <div className="mt-7">
        <DeckOptionsForm
          deckId={deck.id}
          deckName={deck.name}
          hasSubdecks={subdeckCount > 0}
          preset={{
            id: deck.preset.id,
            name: deck.preset.name,
            config: parsePresetConfig(deck.preset.config),
            deckCount: current?._count.decks ?? 1,
          }}
          presets={presets.map((preset) => ({
            id: preset.id,
            name: preset.name,
            deckCount: preset._count.decks,
          }))}
        />
      </div>
    </main>
  );
}
