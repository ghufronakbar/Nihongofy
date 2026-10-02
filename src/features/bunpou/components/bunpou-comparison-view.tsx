import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FuriganaScope } from "@/components/furigana-scope";
import { JapaneseText } from "@/components/japanese-text";
import { cn } from "@/lib/utils";
import { BUNPOU_LICENSE } from "../taxonomy";
import type { BunpouComparisonDetail, BunpouVerdict } from "../types";
import { PointLinkList } from "./point-link-list";

const VERDICT: Record<BunpouVerdict, { mark: string; label: string; className: string }> = {
  ok: { mark: "○", label: "Wajar", className: "bg-neo-green/25" },
  awkward: { mark: "△", label: "Kurang wajar", className: "bg-neo-yellow/40" },
  wrong: { mark: "✕", label: "Salah", className: "bg-neo-coral/25" },
};

export function BunpouComparisonView({ detail }: { detail: BunpouComparisonDetail }) {
  const { content } = detail;
  const pointByKey = new Map(detail.points.map((point) => [point.key, point]));

  return (
    <article>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm font-bold">
        <Link href="/bunpou" className="underline underline-offset-4">
          Bunpou
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <span className="text-muted-foreground">Perbandingan</span>
      </nav>

      <FuriganaScope>
        <header className="mt-2">
          <h1 className="text-3xl font-black sm:text-4xl">{detail.title}</h1>
          <p className="mt-3 leading-relaxed font-semibold">
            <JapaneseText text={content.summary} />
          </p>
        </header>

        <section className="mt-8">
          <h2 className="text-lg font-black">Ringkasan perbedaan</h2>
          <div className="neo-surface mt-3 overflow-x-auto p-0">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead className="border-b-[3px] border-neo-ink bg-neo-yellow/40">
                <tr>
                  <th scope="col" className="px-3 py-2 font-black">Pola</th>
                  <th scope="col" className="px-3 py-2 font-black">Nuansa</th>
                  <th scope="col" className="px-3 py-2 font-black">Ragam</th>
                  <th scope="col" className="px-3 py-2 font-black">Batasan</th>
                </tr>
              </thead>
              <tbody>
                {content.rows.map((row) => {
                  const point = pointByKey.get(row.key);
                  return (
                    <tr key={row.key} className="border-b-2 border-neo-ink/20 align-top last:border-0">
                      <th scope="row" className="px-3 py-2">
                        {point ? (
                          <Link
                            href={`/bunpou/${point.key}`}
                            lang="ja"
                            className="font-japanese text-base font-black underline underline-offset-4"
                          >
                            <JapaneseText text={point.title} />
                          </Link>
                        ) : (
                          row.key
                        )}
                      </th>
                      <td className="px-3 py-2 font-semibold"><JapaneseText text={row.nuance} /></td>
                      <td className="px-3 py-2 font-semibold"><JapaneseText text={row.register} /></td>
                      <td className="px-3 py-2 font-semibold"><JapaneseText text={row.restriction} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {content.contrasts.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-black">Kalimat kontras</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              ○ wajar · △ kurang wajar · ✕ salah
            </p>
            <ol className="mt-3 space-y-4">
              {content.contrasts.map((contrast, index) => (
                <li key={`${contrast.jp}-${index}`} className="neo-surface p-5">
                  <p lang="ja" className="font-japanese text-xl leading-loose font-bold">
                    <JapaneseText text={contrast.jp} />
                  </p>
                  <p className="mt-1 font-semibold text-muted-foreground">{contrast.id}</p>
                  <ul className="mt-3 space-y-2">
                    {contrast.options.map((option) => {
                      const verdict = VERDICT[option.verdict];
                      return (
                        <li
                          key={option.key}
                          className={cn("rounded-lg border-2 border-neo-ink px-3 py-2", verdict.className)}
                        >
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span aria-label={verdict.label} title={verdict.label} className="text-lg font-black">
                              {verdict.mark}
                            </span>
                            <span lang="ja" className="font-japanese text-lg font-black">
                              <JapaneseText text={option.text} />
                            </span>
                          </span>
                          {option.note ? (
                            <span className="mt-0.5 block text-sm font-semibold">
                              <JapaneseText text={option.note} />
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </FuriganaScope>

      <section className="mt-10">
        <h2 className="text-lg font-black">Pola yang dibandingkan</h2>
        <div className="mt-3">
          <PointLinkList points={detail.points} />
        </div>
      </section>

      <p className="mt-8 text-xs font-semibold text-muted-foreground">Konten: {BUNPOU_LICENSE}</p>
    </article>
  );
}
