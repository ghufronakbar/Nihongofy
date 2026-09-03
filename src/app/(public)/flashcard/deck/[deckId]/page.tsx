import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, Play, Search, Settings2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDeckOverview, rollUpCounts } from "@/features/flashcard/data";
import { flattenDeckTree } from "@/features/flashcard/lib/deck-tree";

type Props = { params: Promise<{ deckId: string }> };

export default async function DeckPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard");

  const { deckId } = await params;
  const id = Number(deckId);
  if (!Number.isInteger(id)) notFound();

  const overview = await getDeckOverview(session.userId);
  const node = flattenDeckTree(overview.tree).find((item) => item.deck.id === id);
  if (!node) notFound();

  const counts = rollUpCounts(node);
  const total = counts.newCount + counts.learningCount + counts.reviewCount;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Semua deck
      </Link>

      <h1 className="mt-4 text-3xl font-black">{node.deck.name}</h1>
      {node.deck.description ? (
        <p className="mt-2 font-bold text-muted-foreground">{node.deck.description}</p>
      ) : null}

      <dl className="mt-7 grid grid-cols-3 gap-3">
        {[
          { label: "Baru", value: counts.newCount, tone: "bg-neo-blue" },
          { label: "Belajar", value: counts.learningCount, tone: "bg-neo-coral" },
          { label: "Ulang", value: counts.reviewCount, tone: "bg-neo-green" },
        ].map((item) => (
          <div key={item.label} className={`neo-surface p-4 text-center ${item.tone}`}>
            <dt className="text-xs font-black tracking-wide uppercase text-black">
              {item.label}
            </dt>
            <dd className="mt-1 text-3xl font-black tabular-nums text-black">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 flex flex-wrap gap-3">
        {total > 0 ? (
          <Link
            href={`/flashcard/deck/${node.deck.id}/study`}
            className="neo-button bg-neo-yellow"
          >
            <Play className="size-4" aria-hidden /> Mulai belajar
          </Link>
        ) : (
          <p className="font-bold text-muted-foreground">
            Tidak ada kartu yang jatuh tempo hari ini. Sampai jumpa besok.
          </p>
        )}
        <Link
          href={`/flashcard/deck/${node.deck.id}/options`}
          className="neo-button bg-white"
        >
          <Settings2 className="size-4" aria-hidden /> Deck options
        </Link>
        <Link
          href={`/flashcard/browse?deck=${node.deck.id}`}
          className="neo-button bg-white"
        >
          <Search className="size-4" aria-hidden /> Kartu
        </Link>
        <a
          href={`/api/flashcard/export?deck=${node.deck.id}`}
          className="neo-button bg-white"
          download
        >
          <Download className="size-4" aria-hidden /> Export
        </a>
      </div>

      <p className="mt-6 text-sm font-bold text-muted-foreground">
        Preset: {node.deck.presetName}
      </p>
    </main>
  );
}
