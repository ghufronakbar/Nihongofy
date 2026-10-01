import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import type { DeckKind, DeckSummary } from "../types";
import { DeckSubscribeButton } from "./deck-subscribe-button";

const GROUPS: { kind: DeckKind; title: string; note: string }[] = [
  { kind: "LEVEL", title: "Level JLPT", note: "Kosakata per level, dari N5 sampai N1." },
  { kind: "TOPIC", title: "Topik", note: "Kata dikelompokkan menurut tema, dari semua level." },
  { kind: "CATEGORY", title: "Kategori", note: "Jenis kata khusus seperti onomatope dan idiom." },
];

type Props = {
  decks: DeckSummary[];
  /** Null untuk guest: tombol tambah diganti tautan mode coba. */
  subscribedIds: Set<number> | null;
};

/**
 * Katalog deck bawaan. Satu kata bisa berada di beberapa deck sekaligus (deck
 * level dan deck topik), tetapi progresnya satu: belajar di satu deck ikut
 * memajukan kata yang sama di deck lain.
 */
export function DeckCatalog({ decks, subscribedIds }: Props) {
  if (decks.length === 0) {
    return (
      <p className="neo-surface p-6 font-bold text-muted-foreground">
        Belum ada deck bawaan yang tersedia.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {GROUPS.map((group) => {
        const items = decks.filter((deck) => deck.kind === group.kind);
        if (items.length === 0) return null;

        return (
          <section key={group.kind} aria-labelledby={`deck-group-${group.kind}`}>
            <h2 id={`deck-group-${group.kind}`} className="text-xl font-black">
              {group.title}
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{group.note}</p>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {items.map((deck) => (
                <li key={deck.slug} className="neo-surface flex flex-col gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <h3 className="font-black">{deck.name}</h3>
                      <span lang="ja" className="font-japanese text-sm font-bold text-muted-foreground">
                        {deck.nameJa}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">
                      {deck.description}
                    </p>
                    <p className="mt-2 text-xs font-bold tabular-nums text-muted-foreground">
                      {deck.wordCount} kata
                    </p>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    {subscribedIds ? (
                      <>
                        <DeckSubscribeButton
                          slug={deck.slug}
                          subscribed={subscribedIds.has(deck.id)}
                          className="text-xs"
                        />
                        <Link
                          href={`/flashcard/deck/${deck.slug}`}
                          className="inline-flex items-center gap-1 text-sm font-black underline underline-offset-4"
                        >
                          Lihat kata <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </>
                    ) : (
                      <Link href={`/flashcard/try/${deck.slug}`} className="neo-button bg-white text-xs">
                        <Play className="size-4" aria-hidden /> Coba deck ini
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
