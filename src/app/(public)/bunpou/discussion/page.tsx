import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, MessagesSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { JapaneseText } from "@/components/japanese-text";
import { FEATURES } from "@/constants";
import { getBunpouDiscussionIndex } from "@/features/question-comment/queries";
import { DiscussionTabs } from "@/features/question-comment/components/discussion-tabs";
import { discussionIndexMetadata } from "@/features/question-comment/seo";

type Props = { searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page } = await searchParams;
  return discussionIndexMetadata(
    {
      title: "Diskusi Bunpou",
      description:
        "Catatan, contoh kalimat, dan pertanyaan pengguna seputar pola kalimat (文法) JLPT N5 sampai N1.",
      path: "/bunpou/discussion",
    },
    page,
  );
}

export default async function BunpouDiscussionIndexPage({ searchParams }: Props) {
  const { page } = await searchParams;
  const parsedPage = Number(page);
  const currentPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { entries, hasMore } = await getBunpouDiscussionIndex(currentPage);
  const pageHref = (target: number) => `/bunpou/discussion?page=${target}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/bunpou" className="text-sm font-black underline">
        ← Katalog bunpou
      </Link>

      <div className="neo-surface flex flex-col gap-2 p-6">
        <span className="neo-kicker self-start bg-white">DISKUSI</span>
        <h1 className="text-2xl font-black sm:text-3xl">Diskusi Bunpou</h1>
        <p className="text-sm font-semibold text-muted-foreground">
          Catatan yang dibagikan pengguna untuk pola kalimat, diurutkan dari aktivitas terbaru. Buka
          halaman sebuah pola untuk ikut menulis.
        </p>
      </div>

      <DiscussionTabs
        active="bunpou"
        enabled={{
          question: FEATURES.questionDiscussion,
          vocab: FEATURES.flashcardDiscussion,
          bunpou: FEATURES.bunpouDiscussion,
        }}
      />

      {entries.length === 0 ? (
        <div className="neo-surface p-8 text-center">
          <MessagesSquare className="mx-auto size-8 text-foreground/40" aria-hidden />
          <p className="mt-3 text-sm font-bold text-muted-foreground">
            {currentPage > 1
              ? "Tidak ada diskusi lagi di halaman ini."
              : "Belum ada catatan pola yang dibagikan ke diskusi."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.key}>
              <Link href={`/bunpou/${entry.key}#diskusi`} className="neo-surface neo-interactive block p-4">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="rounded border-2 border-neo-ink bg-neo-yellow px-1.5 font-mono text-[10px] font-black text-black uppercase">
                    {entry.level}
                  </span>
                  <span lang="ja" className="font-japanese text-xl font-black">
                    <JapaneseText text={entry.title} />
                  </span>
                  {entry.senseLabel ? (
                    <span className="text-xs font-black tracking-wide text-neo-blue uppercase">
                      {entry.senseLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm font-semibold">{entry.meaningId}</p>
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
    </div>
  );
}
