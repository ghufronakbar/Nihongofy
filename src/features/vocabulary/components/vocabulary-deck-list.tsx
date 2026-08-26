import Link from "next/link";
import { ArrowRight, BookOpen, Brain, Clock3, Sparkles } from "lucide-react";
import { getVocabularyDecks } from "../actions";

const ACCENTS = ["bg-neo-blue", "bg-neo-yellow", "bg-neo-green", "bg-neo-coral"];

export async function VocabularyDeckList() {
  const decks = await getVocabularyDecks();

  if (decks.length === 0) {
    return (
      <div className="neo-surface bg-white p-10 text-center">
        <BookOpen className="mx-auto size-14" aria-hidden="true" />
        <h2 className="mt-4 text-3xl">Deck belum tersedia</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Struktur belajar sudah siap, tetapi belum ada deck vocabulary yang diterbitkan.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {decks.map((deck, index) => (
        <article key={deck.id} className="neo-surface flex min-h-80 flex-col overflow-hidden bg-white">
          <div className={`flex items-center justify-between border-b-[3px] border-black p-5 ${ACCENTS[index % ACCENTS.length]}`}>
            <span className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-black shadow-neo-sm">
              {deck.jlptLevel}
            </span>
            <Brain className="size-9" aria-hidden="true" />
          </div>
          <div className="flex flex-1 flex-col p-6">
            <p className="font-mono text-xs font-bold tracking-widest uppercase">{deck.cardCount} kartu</p>
            <h2 className="mt-3 text-3xl uppercase">{deck.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{deck.description}</p>

            <div className="my-5 grid grid-cols-2 gap-3">
              <div className="border-2 border-black bg-neo-yellow p-3 shadow-neo-sm">
                <Clock3 className="size-5" aria-hidden="true" />
                <strong className="mt-2 block text-2xl tabular-nums">{deck.dueCount}</strong>
                <span className="text-xs font-bold uppercase">Jatuh tempo</span>
              </div>
              <div className="border-2 border-black bg-neo-green p-3 shadow-neo-sm">
                <Sparkles className="size-5" aria-hidden="true" />
                <strong className="mt-2 block text-2xl tabular-nums">{deck.newCount}</strong>
                <span className="text-xs font-bold uppercase">Baru</span>
              </div>
            </div>

            <Link href={`/vocab/${deck.slug}`} className="neo-button w-full justify-between">
              Buka deck <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
