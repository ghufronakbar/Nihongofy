import Link from "next/link";
import { ArrowLeft, ArrowRight, MessagesSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { getDiscussionIndex } from "@/features/question-comment/queries";
import { JapaneseText } from "@/components/japanese-text";
import { FuriganaScope } from "@/components/furigana-scope";
import { mondaiTypeFullLabel } from "@/constants/jlpt";

export default async function DiscussionIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const parsedPage = Number(page);
  const currentPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { entries, hasMore } = await getDiscussionIndex(currentPage);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      <div className="neo-surface bg-white p-6 border-[3px] border-neo-ink shadow-neo flex flex-col gap-2">
        <span className="neo-kicker bg-white self-start">DISKUSI</span>
        <h1 className="text-2xl sm:text-4xl font-black uppercase text-neo-ink">
          Semua Diskusi Soal
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-foreground/70">
          Catatan belajar yang dibagikan pengguna, dikelompokkan per soal dan diurutkan dari
          aktivitas terbaru.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="neo-surface bg-white p-8 text-center border-[3px] border-neo-ink shadow-neo">
          <MessagesSquare className="mx-auto size-8 text-foreground/40" />
          <p className="mt-3 text-sm font-bold text-muted-foreground">
            {currentPage > 1
              ? "Tidak ada diskusi lagi di halaman ini."
              : "Belum ada catatan yang dibagikan ke diskusi."}
          </p>
        </div>
      ) : (
        <FuriganaScope>
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li key={entry.questionId}>
                <Link
                  href={`/discussion/question/${entry.questionId}`}
                  className="neo-surface block bg-white p-4 border-[3px] border-neo-ink shadow-neo transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm">
                      {entry.testPackage.jlptLevel}
                    </span>
                    <span className="font-mono text-[11px] font-black uppercase text-foreground/60">
                      {entry.testPackage.name}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-foreground/50">
                      · Soal {entry.questionOrder}
                    </span>
                  </div>

                  <h2 className="mt-1.5 text-sm font-black text-neo-ink">
                    {mondaiTypeFullLabel(entry.testPackageItem.mondaiType)}
                  </h2>

                  {entry.questionText && (
                    <div className="mt-1.5 line-clamp-2 text-sm font-semibold text-foreground/80">
                      <JapaneseText text={entry.questionText} />
                    </div>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 text-neo-ink">
                      <MessagesSquare className="size-3.5" />
                      {entry.entryCount} catatan & balasan
                    </span>
                    <span>
                      · aktivitas terakhir{" "}
                      {formatDistanceToNow(entry.lastActivityAt, {
                        addSuffix: true,
                        locale: idLocale,
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </FuriganaScope>
      )}

      <div className="flex items-center justify-between gap-3">
        {currentPage > 1 ? (
          <Link
            href={`/discussion?page=${currentPage - 1}`}
            className="neo-button bg-white text-black font-extrabold text-xs sm:text-sm"
          >
            <ArrowLeft className="size-4" />
            Sebelumnya
          </Link>
        ) : (
          <button disabled className="neo-button bg-white text-black opacity-40 font-bold text-xs sm:text-sm">
            <ArrowLeft className="size-4" />
            Sebelumnya
          </button>
        )}

        {hasMore ? (
          <Link
            href={`/discussion?page=${currentPage + 1}`}
            className="neo-button bg-neo-yellow text-black font-black text-xs sm:text-sm"
          >
            Selanjutnya
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <button disabled className="neo-button bg-white text-black opacity-40 font-bold text-xs sm:text-sm">
            Selanjutnya
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
