import { Eye } from "lucide-react";
import { JapaneseText } from "@/components/japanese-text";
import { cn } from "@/lib/utils";
import type { VocabCardContent } from "../types";

// Kata target di contoh kalimat (`__...__`) disorot, bukan digaris bawah:
// garis bawah di markup yang sama berarti 下線部 pada soal ujian.
const TARGET_HIGHLIGHT = "rounded-sm bg-neo-yellow/70 px-0.5 font-black text-black";

type Props = {
  content: VocabCardContent;
  revealed: boolean;
  isNew: boolean;
  /** Ukuran teks kartu dalam persen; seluruh ukuran di dalam kartu memakai em. */
  textScale: number;
  furiganaVisible: boolean;
  onShowFurigana?: () => void;
};

/**
 * Satu kartu kosakata. Sisi depan hanya tulisan kata tanpa furigana; sisi
 * belakang memuat semuanya. Furigana di sisi belakang bisa disembunyikan lewat
 * pengaturan — disembunyikan dengan `visibility`, bukan dihapus, supaya tinggi
 * baris tidak melompat saat furigana dimunculkan.
 */
export function VocabCardView({
  content,
  revealed,
  isNew,
  textScale,
  furiganaVisible,
  onShowFurigana,
}: Props) {
  return (
    <article
      className="neo-surface min-h-72 p-6 sm:p-8"
      style={{ fontSize: `${textScale}%` }}
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-[0.75em] font-black tracking-wide uppercase">
        <span className="rounded border-2 border-neo-ink bg-neo-yellow px-1.5 text-black">
          {content.level}
        </span>
        {isNew ? <span className="text-neo-blue">Baru</span> : null}
      </div>

      <p
        lang="ja"
        className="font-japanese mt-6 text-center text-[3em] leading-tight font-black break-words"
      >
        {content.wordPlain}
      </p>

      {revealed ? (
        <div
          className={cn(
            "mt-7 space-y-6 border-t-[3px] border-dashed border-neo-ink pt-6",
            !furiganaVisible && "[&_rt]:invisible",
          )}
        >
          <div className="text-center">
            <p lang="ja" className="font-japanese text-[2.2em] leading-relaxed font-black">
              <JapaneseText text={content.word} />
            </p>
            {!furiganaVisible && onShowFurigana ? (
              <button
                type="button"
                onClick={onShowFurigana}
                className="mt-2 inline-flex items-center gap-1.5 text-[0.8em] font-extrabold underline underline-offset-4"
              >
                <Eye className="size-[1.1em]" aria-hidden /> Tampilkan furigana
                <kbd className="rounded border-2 border-current px-1 text-[0.85em]">F</kbd>
              </button>
            ) : null}
          </div>

          <section>
            <h3 className="text-[0.75em] font-black tracking-wide text-muted-foreground uppercase">
              Arti
            </h3>
            <p className="mt-1 text-[1.4em] leading-snug font-black">{content.meaningsId.join("; ")}</p>
            <p className="mt-1 text-[0.95em] font-semibold text-muted-foreground" lang="en">
              {content.meaningsEn.join("; ")}
            </p>
          </section>

          {content.examples.length > 0 ? (
            <section>
              <h3 className="text-[0.75em] font-black tracking-wide text-muted-foreground uppercase">
                Contoh
              </h3>
              <ul className="mt-2 space-y-4">
                {content.examples.map((example) => (
                  <li key={example.jp}>
                    <p lang="ja" className="font-japanese text-[1.3em] leading-loose font-bold">
                      <JapaneseText text={example.jp} underlineClassName={TARGET_HIGHLIGHT} />
                    </p>
                    <p className="mt-1 text-[1em] font-semibold">{example.id}</p>
                    <p className="text-[0.9em] font-semibold text-muted-foreground" lang="en">
                      {example.en}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {content.notes ? (
            <section>
              <h3 className="text-[0.75em] font-black tracking-wide text-muted-foreground uppercase">
                Catatan
              </h3>
              <p className="mt-1 text-[1em] leading-relaxed font-semibold">
                <JapaneseText text={content.notes} />
              </p>
            </section>
          ) : null}

          {content.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tag">
              {content.tags.map((tag) => (
                <li
                  key={tag.slug}
                  className="rounded border-2 border-neo-ink px-1.5 text-[0.75em] font-bold"
                >
                  {tag.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
