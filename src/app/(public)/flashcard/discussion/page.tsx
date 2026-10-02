import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, MessagesSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { FEATURES } from "@/constants";
import { getVocabDiscussionIndex } from "@/features/question-comment/queries";
import { DiscussionTabs } from "@/features/question-comment/components/discussion-tabs";
import { privateMetadata } from "@/lib/seo";

export const metadata: Metadata = privateMetadata(
  "Diskusi kosakata",
  "Catatan dan diskusi publik seputar kata flashcard.",
);

export default async function FlashcardDiscussionIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const parsedPage = Number(page);
  const currentPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { entries, hasMore } = await getVocabDiscussionIndex(currentPage);
  const pageHref = (target: number) => `/flashcard/discussion?page=${target}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Deck saya
      </Link>

      <div className="neo-surface flex flex-col gap-2 p-6">
        <span className="neo-kicker self-start bg-white">DISKUSI</span>
        <h1 className="text-2xl font-black sm:text-3xl">Diskusi Kosakata</h1>
        <p className="text-sm font-semibold text-muted-foreground">
          Catatan yang dibagikan pengguna untuk kata flashcard, diurutkan dari aktivitas terbaru.
          Buka jawaban sebuah kartu saat belajar lalu tekan Diskusi untuk ikut menulis.
        </p>
      </div>

      <DiscussionTabs
        active="vocab"
        questionEnabled={FEATURES.questionDiscussion}
        vocabEnabled={FEATURES.flashcardDiscussion}
      />

      {entries.length === 0 ? (
        <div className="neo-surface p-8 text-center">
          <MessagesSquare className="mx-auto size-8 text-foreground/40" aria-hidden />
          <p className="mt-3 text-sm font-bold text-muted-foreground">
            {currentPage > 1
              ? "Tidak ada diskusi lagi di halaman ini."
              : "Belum ada catatan kata yang dibagikan ke diskusi."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.vocabId}>
              <Link
                href={`/flashcard/discussion/${entry.vocabId}`}
                className="neo-surface neo-interactive block p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="rounded border-2 border-neo-ink bg-neo-yellow px-1.5 font-mono text-[10px] font-black text-black uppercase">
                    {entry.level}
                  </span>
                  <span lang="ja" className="font-japanese text-xl font-black">
                    {entry.wordPlain}
                  </span>
                  {entry.reading !== entry.wordPlain ? (
                    <span lang="ja" className="font-japanese text-sm font-bold text-muted-foreground">
                      {entry.reading}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm font-semibold">{entry.meaningsId.join("; ")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <MessagesSquare className="size-3.5" aria-hidden />
                    {entry.entryCount} catatan & balasan
                  </span>
                  <span>
                    · aktivitas terakhir{" "}
                    {formatDistanceToNow(entry.lastActivityAt, { addSuffix: true, locale: idLocale })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <nav className="flex items-center justify-between gap-3" aria-label="Halaman">
        {currentPage > 1 ? (
          <Link href={pageHref(currentPage - 1)} className="neo-button bg-white text-xs">
            <ArrowLeft className="size-4" aria-hidden /> Sebelumnya
          </Link>
        ) : (
          <span />
        )}
        {hasMore ? (
          <Link href={pageHref(currentPage + 1)} className="neo-button bg-neo-yellow text-xs">
            Selanjutnya <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
