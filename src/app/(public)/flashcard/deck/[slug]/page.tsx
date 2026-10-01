import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Play, Search } from "lucide-react";
import { FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  DECK_WORD_STATUSES,
  getDeckForUser,
  getDeckWords,
  type DeckWordFilter,
} from "@/features/flashcard/data";
import { DeckSubscribeButton } from "@/features/flashcard/components/deck-subscribe-button";
import { DeckWordActions } from "@/features/flashcard/components/deck-word-actions";
import { FlashcardDeckSlugSchema } from "@/features/flashcard/schemas";
import type { DeckWordStatus } from "@/features/flashcard/types";
import { privateMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = privateMetadata(
  "Deck flashcard",
  "Daftar kata dalam deck flashcard dan beban belajar hari ini.",
);

const STATUS_LABELS: Record<DeckWordFilter, string> = {
  all: "Semua",
  new: "Baru",
  learning: "Belajar",
  review: "Ulang",
  suspended: "Suspend",
};

const STATUS_BADGES: Record<DeckWordStatus, { label: string; tone: string }> = {
  new: { label: "Baru", tone: "bg-neo-blue" },
  learning: { label: "Belajar", tone: "bg-neo-coral" },
  review: { label: "Ulang", tone: "bg-neo-green" },
  suspended: { label: "Suspend", tone: "bg-neutral-300" },
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DeckPage({ params, searchParams }: Props) {
  const { slug: rawSlug } = await params;
  const parsedSlug = FlashcardDeckSlugSchema.safeParse(rawSlug);
  if (!parsedSlug.success) notFound();
  const slug = parsedSlug.data;

  const session = await getSession();
  if (!session) redirect(`/login?next=/flashcard/deck/${slug}`);

  const query = single((await searchParams).q) ?? "";
  const statusParam = single((await searchParams).status);
  const status: DeckWordFilter = DECK_WORD_STATUSES.includes(statusParam as DeckWordFilter)
    ? (statusParam as DeckWordFilter)
    : "all";
  const page = Math.max(1, Number.parseInt(single((await searchParams).page) ?? "1", 10) || 1);

  const access = await getDeckForUser(session.userId, slug);
  if (!access) notFound();

  const { deck, subscribed, due } = access;
  const list = await getDeckWords(session.userId, deck, { query, status, page });
  const total = due.newCount + due.learningCount + due.reviewCount;

  const hrefWith = (next: { status?: DeckWordFilter; page?: number }) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    const nextStatus = next.status ?? status;
    if (nextStatus !== "all") search.set("status", nextStatus);
    const nextPage = next.page ?? 1;
    if (nextPage > 1) search.set("page", String(nextPage));
    const text = search.toString();
    return `/flashcard/deck/${slug}${text ? `?${text}` : ""}`;
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Deck saya
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-3xl font-black">{deck.name}</h1>
        <span lang="ja" className="font-japanese font-bold text-muted-foreground">
          {deck.nameJa}
        </span>
      </div>
      <p className="mt-2 font-bold text-muted-foreground">{deck.description}</p>

      {subscribed ? (
        <dl className="mt-7 grid grid-cols-3 gap-3">
          {[
            { label: "Baru", value: due.newCount, tone: "bg-neo-blue" },
            { label: "Belajar", value: due.learningCount, tone: "bg-neo-coral" },
            { label: "Ulang", value: due.reviewCount, tone: "bg-neo-green" },
          ].map((item) => (
            <div key={item.label} className={`neo-surface p-4 text-center ${item.tone}`}>
              <dt className="text-xs font-black tracking-wide text-black uppercase">{item.label}</dt>
              <dd className="mt-1 text-3xl font-black tabular-nums text-black">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {subscribed && total > 0 ? (
          <Link href={`/flashcard/deck/${slug}/study`} className="neo-button bg-neo-yellow">
            <Play className="size-4" aria-hidden /> Mulai belajar
          </Link>
        ) : null}
        <DeckSubscribeButton slug={slug} subscribed={subscribed} />
      </div>

      {subscribed && total === 0 ? (
        <p className="mt-4 font-bold text-muted-foreground">
          {due.learningLaterCount > 0
            ? `${due.learningLaterCount} kartu learning tampil lagi nanti hari ini.`
            : "Tidak ada kartu yang perlu dipelajari hari ini. Sampai jumpa besok."}
        </p>
      ) : null}
      {!subscribed ? (
        <p className="mt-4 text-sm font-bold text-muted-foreground">
          Tambahkan deck ini untuk mulai belajar. Setiap deck punya kartu dan pengaturannya
          sendiri: kata yang juga ada di deck lain dipelajari terpisah di sini.
        </p>
      ) : null}

      <section className="mt-10" aria-labelledby="deck-words">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="deck-words" className="text-xl font-black">
            Daftar kata <span className="text-base font-bold tabular-nums">({list.total})</span>
          </h2>
          <form className="flex w-full gap-2 sm:w-auto" action={`/flashcard/deck/${slug}`}>
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <label className="sr-only" htmlFor="deck-word-search">
              Cari kata
            </label>
            <input
              id="deck-word-search"
              name="q"
              defaultValue={query}
              placeholder="Cari kata, bacaan, atau arti"
              className="neo-input h-11 sm:w-64"
            />
            <button type="submit" className="neo-button bg-white px-3" aria-label="Cari">
              <Search className="size-4" aria-hidden />
            </button>
          </form>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter status">
          {DECK_WORD_STATUSES.map((value) => (
            <Link
              key={value}
              href={hrefWith({ status: value })}
              aria-current={value === status ? "page" : undefined}
              className={cn(
                "rounded-md border-2 border-neo-ink px-2.5 py-1 text-xs font-black",
                value === status ? "bg-neo-ink text-white" : "bg-white text-black",
              )}
            >
              {STATUS_LABELS[value]}
            </Link>
          ))}
        </nav>

        {list.words.length === 0 ? (
          <p className="neo-surface mt-5 p-6 text-center font-bold text-muted-foreground">
            Tidak ada kata yang cocok.
          </p>
        ) : (
          <ul className="mt-5 divide-y-2 divide-neo-ink/15 rounded-lg border-[3px] border-neo-ink bg-card">
            {list.words.map((word) => {
              const badge = STATUS_BADGES[word.status];
              return (
                <li key={word.vocabId} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span lang="ja" className="font-japanese text-lg font-black">
                        {word.wordPlain}
                      </span>
                      {word.reading !== word.wordPlain ? (
                        <span lang="ja" className="font-japanese text-sm font-bold text-muted-foreground">
                          {word.reading}
                        </span>
                      ) : null}
                      <span className="text-xs font-bold text-muted-foreground">{word.level}</span>
                    </p>
                    <p className="truncate text-sm font-semibold">{word.meaningsId.join("; ")}</p>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded border-2 border-neo-ink px-1.5 text-xs font-black text-black ${badge.tone}`}
                    >
                      {badge.label}
                    </span>
                    {word.isBuried ? (
                      <span className="text-[11px] font-bold text-muted-foreground">Ditunda</span>
                    ) : null}
                    {word.isLeech ? (
                      <span className="text-[11px] font-bold text-neo-coral">Leech</span>
                    ) : null}
                  </span>
                  <DeckWordActions
                    deckSlug={slug}
                    // Kartu milik langganan deck ini; deck yang belum atau tidak
                    // lagi ditambahkan hanya bisa dilaporkan isinya.
                    cardActions={subscribed}
                    vocabId={word.vocabId}
                    word={word.wordPlain}
                    status={word.status}
                    hasCard={word.hasCard}
                    reportEnabled={FEATURES.report}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {list.pageCount > 1 ? (
          <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Halaman">
            {list.page > 1 ? (
              <Link href={hrefWith({ page: list.page - 1 })} className="neo-button bg-white text-xs">
                ← Sebelumnya
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm font-bold tabular-nums">
              {list.page} / {list.pageCount}
            </span>
            {list.page < list.pageCount ? (
              <Link href={hrefWith({ page: list.page + 1 })} className="neo-button bg-white text-xs">
                Berikutnya →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
