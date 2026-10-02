import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, Scale } from "lucide-react";
import { FuriganaScope } from "@/components/furigana-scope";
import { JapaneseText } from "@/components/japanese-text";
import { cn } from "@/lib/utils";
import {
  BUNPOU_CONNECTION_FORM_BY_SLUG,
  BUNPOU_KIND_LABEL,
  BUNPOU_LICENSE,
  describeBunpouTags,
  sectionLabel,
} from "../taxonomy";
import type { BunpouConnection, BunpouPointDetail, BunpouPointSummary } from "../types";
import { ExampleList } from "./example-list";
import { PointLinkList } from "./point-link-list";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-black">{children}</h2>;
}

function ConnectionRow({ connection }: { connection: BunpouConnection }) {
  const form = BUNPOU_CONNECTION_FORM_BY_SLUG.get(connection.form);
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span
        lang="ja"
        title={form?.label}
        className="font-japanese rounded border-2 border-neo-ink bg-neo-blue/15 px-2 py-0.5 text-sm font-black"
      >
        {form && connection.form !== "other" ? form.labelJa : "…"}
      </span>
      <span aria-hidden className="font-black">
        ＋
      </span>
      <span lang="ja" className="font-japanese text-lg font-black">
        <JapaneseText text={connection.pattern} />
      </span>
      <span className="w-full text-sm font-semibold text-muted-foreground">
        {form && connection.form !== "other" ? form.label : null}
        {form && connection.form !== "other" && connection.note ? " — " : null}
        {connection.note ? <JapaneseText text={connection.note} /> : null}
      </span>
    </li>
  );
}

function FamilyTabs({ family, current }: { family: BunpouPointSummary[]; current: string }) {
  return (
    <nav aria-label="Makna lain dari bentuk ini" className="mt-5">
      <p className="text-xs font-black tracking-wide text-muted-foreground uppercase">
        Bentuk ini punya {family.length} makna
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {family.map((item) => {
          const active = item.key === current;
          return (
            <li key={item.key}>
              <Link
                href={`/bunpou/${item.key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "neo-button min-h-9 px-3 py-1.5 text-xs",
                  active ? "bg-neo-yellow text-black" : "bg-white text-black",
                )}
              >
                {item.senseLabel ?? item.titlePlain}
                <span className="opacity-60">{item.level}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BunpouPointView({ detail }: { detail: BunpouPointDetail }) {
  const { point, content } = detail;
  const tags = describeBunpouTags(content.tags);

  return (
    <article>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm font-bold">
        <Link href="/bunpou" className="underline underline-offset-4">
          Bunpou
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <Link href={`/bunpou?level=${point.level}`} className="underline underline-offset-4">
          {point.level}
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <span className="text-muted-foreground">{sectionLabel(point.sectionKey)}</span>
      </nav>

      <FuriganaScope>
        <header className="mt-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black">
            <span className="rounded border-2 border-neo-ink bg-neo-yellow px-1.5 text-black">
              {point.level}
            </span>
            <span className="rounded border-2 border-neo-ink px-1.5">
              {BUNPOU_KIND_LABEL[point.kind]}
            </span>
            {tags.map((tag) => (
              <span
                key={tag.slug}
                className={cn(
                  "rounded border-2 border-neo-ink px-1.5",
                  tag.dimension === "register" && "bg-neo-blue/15",
                  tag.dimension === "nuance" && "bg-neo-coral/20",
                )}
                title={tag.labelJa}
              >
                {tag.label}
              </span>
            ))}
          </div>
          <h1 lang="ja" className="font-japanese mt-3 text-4xl leading-relaxed font-black sm:text-5xl">
            <JapaneseText text={content.title} />
          </h1>
          {content.senseLabel ? (
            <p className="mt-1 text-sm font-black tracking-wide text-neo-blue uppercase">
              {content.senseLabel}
            </p>
          ) : null}
          <p className="mt-3 text-xl leading-snug font-black">{content.meaningId}</p>
          <p className="mt-1 font-semibold text-muted-foreground" lang="en">
            {content.meaningEn}
          </p>
          {detail.family.length > 1 ? (
            <FamilyTabs family={detail.family} current={point.key} />
          ) : null}
        </header>

        <div className="mt-8 space-y-8">
          {content.connections.length > 0 ? (
            <section className="neo-surface p-5">
              <SectionHeading>Sambungan</SectionHeading>
              <ul className="mt-3 space-y-3">
                {content.connections.map((connection, index) => (
                  <ConnectionRow key={`${connection.form}-${index}`} connection={connection} />
                ))}
              </ul>
            </section>
          ) : null}

          {content.formation.length > 0 ? (
            <section>
              <SectionHeading>Pembentukan</SectionHeading>
              <div className="neo-surface mt-3 overflow-x-auto p-0">
                <table className="w-full min-w-xl text-left text-sm">
                  <thead className="border-b-[3px] border-neo-ink bg-neo-yellow/40">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-black">Kelompok</th>
                      <th scope="col" className="px-3 py-2 font-black">Asal</th>
                      <th scope="col" className="px-3 py-2 font-black">Aturan</th>
                      <th scope="col" className="px-3 py-2 font-black">Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.formation.map((row, index) => (
                      <tr key={`${row.label}-${index}`} className="border-b-2 border-neo-ink/20 align-top last:border-0">
                        <th scope="row" className="px-3 py-2 font-black">{row.label}</th>
                        <td lang="ja" className="font-japanese px-3 py-2 font-bold">
                          <JapaneseText text={row.input} />
                        </td>
                        <td className="px-3 py-2 font-semibold">{row.rule}</td>
                        <td lang="ja" className="font-japanese px-3 py-2 font-black">
                          <JapaneseText text={row.output} />
                          {row.note ? (
                            <span className="mt-1 block font-sans text-xs font-semibold text-muted-foreground">
                              <JapaneseText text={row.note} />
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {content.variants.length > 0 ? (
            <section>
              <SectionHeading>Bentuk lain</SectionHeading>
              <ul className="mt-3 flex flex-wrap gap-2">
                {content.variants.map((variant) => (
                  <li
                    key={variant}
                    lang="ja"
                    className="font-japanese rounded-lg border-2 border-neo-ink px-3 py-1 font-black"
                  >
                    <JapaneseText text={variant} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionHeading>Penjelasan</SectionHeading>
            <div className="mt-3 space-y-3 leading-relaxed font-semibold">
              {content.explanation.map((paragraph) => (
                <p key={paragraph}>
                  <JapaneseText text={paragraph} />
                </p>
              ))}
            </div>
          </section>

          {content.examples.length > 0 ? (
            <section>
              <SectionHeading>Contoh kalimat</SectionHeading>
              <div className="neo-surface mt-3 p-5">
                <ExampleList examples={content.examples} />
              </div>
            </section>
          ) : null}

          {content.pitfalls.length > 0 ? (
            <section className="neo-surface bg-neo-coral/10 p-5">
              <SectionHeading>Perhatikan</SectionHeading>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed font-semibold">
                {content.pitfalls.map((pitfall) => (
                  <li key={pitfall}>
                    <JapaneseText text={pitfall} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </FuriganaScope>

      {detail.comparisons.length > 0 ? (
        <section className="mt-10">
          <SectionHeading>Dibandingkan dengan pola mirip</SectionHeading>
          <ul className="mt-3 space-y-3">
            {detail.comparisons.map((comparison) => (
              <li key={comparison.key}>
                <Link
                  href={`/bunpou/compare/${comparison.key}`}
                  className="neo-surface neo-interactive flex items-start gap-3 p-4"
                >
                  <Scale className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-black">{comparison.title}</span>
                    {comparison.summary ? (
                      <span className="mt-1 line-clamp-2 block text-sm font-semibold text-muted-foreground">
                        <JapaneseText text={comparison.summary} />
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="mt-0.5 size-5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.related.length > 0 ? (
        <section className="mt-10">
          <SectionHeading>Pola lain dengan fungsi serupa</SectionHeading>
          <div className="mt-3">
            <PointLinkList points={detail.related} />
          </div>
        </section>
      ) : null}

      <nav aria-label={`Pola ${point.level} sebelum dan sesudahnya`} className="mt-10 grid gap-3 sm:grid-cols-2">
        {detail.previous ? (
          <Link
            href={`/bunpou/${detail.previous.key}`}
            className="neo-surface neo-interactive flex items-center gap-3 p-4"
          >
            <ArrowLeft className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block text-xs font-black text-muted-foreground">Sebelumnya</span>
              <span lang="ja" className="font-japanese block truncate font-black">
                {detail.previous.titlePlain}
              </span>
            </span>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        {detail.next ? (
          <Link
            href={`/bunpou/${detail.next.key}`}
            className="neo-surface neo-interactive flex items-center justify-end gap-3 p-4 text-right"
          >
            <span className="min-w-0">
              <span className="block text-xs font-black text-muted-foreground">Berikutnya</span>
              <span lang="ja" className="font-japanese block truncate font-black">
                {detail.next.titlePlain}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0" aria-hidden />
          </Link>
        ) : null}
      </nav>

      <p className="mt-8 text-xs font-semibold text-muted-foreground">Konten: {BUNPOU_LICENSE}</p>
    </article>
  );
}
