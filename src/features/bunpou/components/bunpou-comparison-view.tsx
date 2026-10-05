import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FuriganaScope } from "@/components/furigana-scope";
import { JapaneseText } from "@/components/japanese-text";
import { ReportButton } from "@/features/report/components/report-button";
import { cn } from "@/lib/utils";
import { comparisonLevels, patternVariants } from "../lib/comparison";
import { BUNPOU_LICENSE } from "../taxonomy";
import type { BunpouComparisonDetail, BunpouPointSummary, BunpouVerdict } from "../types";
import { PointLinkList } from "./point-link-list";

// Label verdict selalu tampil sebagai teks: simbol dan warna saja tidak cukup
// untuk pembaca layar maupun pembaca yang tidak membedakan warna.
const VERDICT: Record<BunpouVerdict, { mark: string; label: string; className: string }> = {
  ok: { mark: "○", label: "Wajar", className: "bg-neo-green/25" },
  awkward: { mark: "△", label: "Kurang wajar", className: "bg-neo-yellow/40" },
  wrong: { mark: "✕", label: "Salah", className: "bg-neo-coral/25" },
};

const DIMENSIONS = [
  { field: "nuance", label: "Nuansa" },
  { field: "register", label: "Ragam" },
  { field: "restriction", label: "Batasan" },
] as const;

function LevelBadge({ level }: { level: string }) {
  return (
    <span className="rounded border-2 border-neo-ink bg-neo-yellow px-1.5 text-xs font-black text-black">
      {level}
    </span>
  );
}

/** Judul pola yang menautkan ke halamannya; bentuk variasi dibungkus utuh. */
function PatternLink({ point, className }: { point: BunpouPointSummary; className?: string }) {
  return (
    <Link href={`/bunpou/${point.key}`} lang="ja" className={cn("font-japanese font-black", className)}>
      {patternVariants(point.title).map((variant, index) => (
        // inline-block tidak mewarisi dekorasi teks dari Link, jadi garis bawahnya di sini.
        <span key={index} className="inline-block underline underline-offset-4">
          <JapaneseText text={variant} />
        </span>
      ))}
    </Link>
  );
}

function VerdictBadge({ verdict }: { verdict: BunpouVerdict }) {
  const { mark, label } = VERDICT[verdict];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded border-2 border-neo-ink bg-white px-1.5 py-0.5 text-xs font-black text-black">
      <span aria-hidden className="text-sm leading-none">
        {mark}
      </span>
      {label}
    </span>
  );
}

export function BunpouComparisonView({
  detail,
  reportEnabled,
}: {
  detail: BunpouComparisonDetail;
  reportEnabled: boolean;
}) {
  const { content } = detail;
  // Detail menjamin satu baris per pola dalam urutan `points`.
  const entries = detail.points.map((point, index) => ({ point, row: content.rows[index] }));

  return (
    <article>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm font-bold">
        <Link href="/bunpou" className="underline underline-offset-4">
          Bunpou
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <Link href="/bunpou#bunpou-comparisons" className="underline underline-offset-4">
          Perbandingan
        </Link>
      </nav>

      <FuriganaScope>
        <header className="mt-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black">
            {comparisonLevels(detail.points).map((level) => (
              <LevelBadge key={level} level={level} />
            ))}
            <span className="rounded border-2 border-neo-ink px-1.5">
              Perbandingan {detail.points.length} pola
            </span>
          </div>
          <h1 className="mt-3 text-3xl leading-tight font-black text-balance sm:text-4xl">
            {detail.title}
          </h1>
          <p className="mt-4 max-w-3xl leading-relaxed font-semibold">
            <JapaneseText text={content.summary} />
          </p>
        </header>

        <section className="mt-10" aria-labelledby="ringkasan-perbedaan">
          <h2 id="ringkasan-perbedaan" className="text-lg font-black">
            Ringkasan perbedaan
          </h2>

          {/* Layar sempit: satu kartu per pola, tanpa gulir menyamping. */}
          <ul className="mt-3 space-y-4 md:hidden">
            {entries.map(({ point, row }) => (
              <li key={point.key} className="neo-surface p-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <LevelBadge level={point.level} />
                  <PatternLink point={point} className="text-lg leading-relaxed" />
                </div>
                <dl className="mt-3 space-y-3 text-sm">
                  {DIMENSIONS.map(({ field, label }) => (
                    <div key={field}>
                      <dt className="text-xs font-black tracking-wide text-muted-foreground uppercase">
                        {label}
                      </dt>
                      <dd className="mt-0.5 leading-relaxed font-semibold">
                        <JapaneseText text={row[field]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          <div className="neo-surface mt-3 hidden overflow-hidden p-0 md:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Nuansa, ragam, dan batasan tiap pola</caption>
              <colgroup>
                {/* Muat bentuk terpanjang (〜てばかりはいられない, 11 huruf) tanpa terpotong. */}
                <col className="w-52" />
                <col />
                <col />
                <col />
              </colgroup>
              <thead className="border-b-[3px] border-neo-ink bg-neo-yellow/40">
                <tr>
                  <th scope="col" className="px-3 py-2 font-black">Pola</th>
                  {DIMENSIONS.map(({ field, label }) => (
                    <th key={field} scope="col" className="px-3 py-2 font-black">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(({ point, row }) => (
                  <tr key={point.key} className="border-b-2 border-neo-ink/20 align-top last:border-0">
                    <th scope="row" className="px-3 py-3 font-normal">
                      <span className="flex flex-col items-start gap-1.5">
                        <LevelBadge level={point.level} />
                        <PatternLink point={point} className="text-base leading-relaxed" />
                      </span>
                    </th>
                    {DIMENSIONS.map(({ field }) => (
                      <td key={field} className="px-3 py-3 leading-relaxed font-semibold">
                        <JapaneseText text={row[field]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {content.contrasts.length > 0 ? (
          <section className="mt-10" aria-labelledby="kalimat-kontras">
            <h2 id="kalimat-kontras" className="text-lg font-black">
              Kalimat kontras
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Isi bagian kosong dengan tiap pilihan: ○ wajar, △ kurang wajar, ✕ salah.
            </p>
            <ol className="mt-3 space-y-4">
              {content.contrasts.map((contrast, index) => (
                <li key={index} className="neo-surface p-4 sm:p-5">
                  <p className="text-xs font-black tracking-wide text-muted-foreground uppercase">
                    Kalimat {index + 1}
                  </p>
                  <p lang="ja" className="font-japanese mt-2 text-xl leading-loose font-bold">
                    <JapaneseText text={contrast.jp} />
                  </p>
                  <p className="mt-1 font-semibold text-muted-foreground">{contrast.id}</p>
                  <ul className="mt-3 space-y-2">
                    {/* Key opsi bisa berulang: satu pola boleh muncul dalam bentuk benar dan salah. */}
                    {contrast.options.map((option, optionIndex) => (
                      <li
                        key={optionIndex}
                        className={cn(
                          "rounded-lg border-2 border-neo-ink px-3 py-2",
                          VERDICT[option.verdict].className,
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <VerdictBadge verdict={option.verdict} />
                          <span lang="ja" className="font-japanese text-lg leading-relaxed font-black">
                            <JapaneseText text={option.text} />
                          </span>
                        </span>
                        {option.note ? (
                          <span className="mt-1 block text-sm leading-relaxed font-semibold">
                            <JapaneseText text={option.note} />
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </FuriganaScope>

      <section className="mt-10" aria-labelledby="pola-dibandingkan">
        <h2 id="pola-dibandingkan" className="text-lg font-black">
          Pola yang dibandingkan
        </h2>
        <div className="mt-3">
          <PointLinkList points={detail.points} />
        </div>
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">Konten: {BUNPOU_LICENSE}</p>
        {reportEnabled ? (
          <ReportButton
            target={{ targetType: "BUNPOU_COMPARISON", bunpouComparisonId: detail.id }}
            variant="outline"
            label="Laporkan perbandingan ini"
            subject={detail.title}
          />
        ) : null}
      </footer>
    </article>
  );
}
