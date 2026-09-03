import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { FlashcardDeckSummary } from "../data";
import { flattenDeckTree, type DeckTreeNode } from "../lib/deck-tree";

type Props = {
  tree: DeckTreeNode<FlashcardDeckSummary>[];
};

/** Hitungan sebuah deck di Anki mencakup seluruh subdeck-nya, bukan deck itu saja. */
function rollUp(node: DeckTreeNode<FlashcardDeckSummary>) {
  return flattenDeckTree([node]).reduce(
    (total, current) => ({
      newCount: total.newCount + current.deck.newCount,
      learningCount: total.learningCount + current.deck.learningCount,
      reviewCount: total.reviewCount + current.deck.reviewCount,
    }),
    { newCount: 0, learningCount: 0, reviewCount: 0 },
  );
}

function DeckRow({ node }: { node: DeckTreeNode<FlashcardDeckSummary> }) {
  const counts = rollUp(node);
  const total = counts.newCount + counts.learningCount + counts.reviewCount;

  return (
    <>
      <li>
        <Link
          href={`/flashcard/deck/${node.deck.id}`}
          className="neo-surface neo-interactive flex items-center gap-3 p-4"
          style={{ marginLeft: `${node.depth * 1.25}rem` }}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-black">{node.label}</span>
            {node.deck.description ? (
              <span className="block truncate text-sm font-semibold text-muted-foreground">
                {node.deck.description}
              </span>
            ) : null}
          </span>

          <span className="flex shrink-0 items-center gap-2 font-black tabular-nums">
            <span className="text-neo-blue" title="Kartu baru">
              {counts.newCount}
            </span>
            <span className="text-neo-coral" title="Sedang dipelajari">
              {counts.learningCount}
            </span>
            <span className="text-neo-green" title="Perlu diulang">
              {counts.reviewCount}
            </span>
          </span>

          <ChevronRight
            className={`size-5 shrink-0 ${total > 0 ? "" : "opacity-30"}`}
            aria-hidden
          />
        </Link>
      </li>
      {node.children.map((child) => (
        <DeckRow key={child.deck.id} node={child} />
      ))}
    </>
  );
}

export function DeckTreeView({ tree }: Props) {
  if (tree.length === 0) {
    return (
      <div className="neo-surface p-8 text-center">
        <h2 className="text-xl font-black">Belum ada deck</h2>
        <p className="mt-2 font-bold text-muted-foreground">
          Tambahkan deck bawaan atau impor file CSV untuk mulai belajar.
        </p>
        <Link href="/flashcard/add" className="neo-button mt-5 bg-neo-yellow">
          Tambah deck
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end gap-3 text-xs font-black tracking-wide uppercase">
        <span className="text-neo-blue">Baru</span>
        <span className="text-neo-coral">Belajar</span>
        <span className="text-neo-green">Ulang</span>
      </div>
      <ul className="mt-3 space-y-3">
        {tree.map((node) => (
          <DeckRow key={node.deck.id} node={node} />
        ))}
      </ul>
    </>
  );
}
