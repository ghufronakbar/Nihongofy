import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Brain, Clock3, Sparkles } from "lucide-react";
import { getVocabularyDeck } from "@/features/vocabulary/actions";
import { VocabularyStudy } from "@/features/vocabulary/components/vocabulary-study";

type PageProps = {
  params: Promise<{ deckSlug: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { deckSlug } = await params;
  const deck = await getVocabularyDeck(deckSlug);
  return { title: `${deck.title} | Vocabulary JLPT Exam`, description: deck.description };
}

export default async function VocabularyDeckPage({ params, searchParams }: PageProps) {
  const [{ deckSlug }, query] = await Promise.all([params, searchParams]);
  const deck = await getVocabularyDeck(deckSlug);
  const mode = query.mode === "review" ? "review" : "browse";

  return (
    <main className="mx-auto w-full max-w-5xl pb-12">
      <Link href="/vocab" className="neo-button mb-6 w-fit bg-white"><ArrowLeft className="size-5" /> Semua deck</Link>

      <header className="neo-surface mb-7 overflow-hidden bg-white">
        <div className="grid gap-5 border-b-[3px] border-black bg-neo-blue p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
          <div>
            <span className="neo-kicker bg-neo-yellow">{deck.jlptLevel} / {deck.cards.length} kartu</span>
            <h1 className="mt-5 text-4xl uppercase sm:text-6xl">{deck.title}</h1>
            <p className="mt-3 max-w-2xl font-semibold">{deck.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="border-2 border-black bg-neo-yellow p-3 shadow-neo-sm"><Clock3 className="size-5" /><strong className="mt-2 block text-2xl">{deck.dueCount}</strong><span className="text-xs font-black uppercase">Due</span></div>
            <div className="border-2 border-black bg-neo-green p-3 shadow-neo-sm"><Sparkles className="size-5" /><strong className="mt-2 block text-2xl">{deck.newCount}</strong><span className="text-xs font-black uppercase">Baru</span></div>
          </div>
        </div>
        <nav aria-label="Mode belajar" className="grid grid-cols-2">
          <Link href={`/vocab/${deck.slug}?mode=browse`} aria-current={mode === "browse" ? "page" : undefined} className={`flex items-center justify-center gap-2 border-r-[3px] border-black p-4 font-black ${mode === "browse" ? "bg-neo-yellow" : "bg-white"}`}>
            <BookOpen className="size-5" /> Jelajahi
          </Link>
          <Link href={`/vocab/${deck.slug}?mode=review`} aria-current={mode === "review" ? "page" : undefined} className={`flex items-center justify-center gap-2 p-4 font-black ${mode === "review" ? "bg-neo-green" : "bg-white"}`}>
            <Brain className="size-5" /> Review SRS
          </Link>
        </nav>
      </header>

      <VocabularyStudy deck={deck} mode={mode} />
    </main>
  );
}
