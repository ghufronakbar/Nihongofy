import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { countUnstudiedWords, getSubscribedDecks } from "@/features/flashcard/data";
import { getFlashcardSettings } from "@/features/flashcard/lib/collection";
import { getFlashcardDayRange } from "@/features/flashcard/lib/scheduler/day";
import {
  averageAnswerSeconds,
  buildForecast,
  buildIntervalDistribution,
  buildMaturity,
  buildReviewHistory,
  computeTrueRetention,
} from "@/features/flashcard/lib/stats";
import { DailyBars, MaturityBar, StatTile } from "@/features/flashcard/components/stats-widgets";

export const metadata: Metadata = privateMetadata(
  "Statistik flashcard",
  "Ringkasan beban review dan riwayat belajar flashcard-mu.",
);

const FORECAST_DAYS = 30;
const HISTORY_DAYS = 30;

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function StatsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard/stats");
  const userId = session.userId;

  const deckParam = (await searchParams).deck;
  const [{ day }, decks] = await Promise.all([
    getFlashcardSettings(userId),
    getSubscribedDecks(userId),
  ]);
  // Filter hanya untuk deck yang sedang ditambahkan; nilai lain berarti semua deck.
  const selected = decks.find((deck) => deck.slug === deckParam) ?? null;

  const now = new Date();
  const { start: todayStart } = getFlashcardDayRange(now, day);
  const historyFrom = new Date(todayStart.getTime() - HISTORY_DAYS * 86_400_000);

  const [cards, reviews, unstudied] = await Promise.all([
    // Kartu deck yang sudah dilepas dibekukan, jadi tidak ikut beban review.
    // Kartu NEW hanya perlu bila di-suspend; sisanya dihitung lewat unstudied.
    prisma.flashcardCard.findMany({
      where: {
        userId,
        subscription: { unsubscribedAt: null },
        ...(selected ? { deckId: selected.id } : {}),
        OR: [{ type: { not: "NEW" } }, { isSuspended: true }],
      },
      select: { due: true, intervalDays: true, type: true, isSuspended: true },
    }),
    prisma.flashcardRevlog.findMany({
      where: {
        userId,
        reviewedAt: { gte: historyFrom },
        ...(selected ? { deckId: selected.id } : {}),
      },
      select: { reviewedAt: true, rating: true, kind: true, takenMs: true },
    }),
    countUnstudiedWords(userId, selected?.id),
  ]);

  const maturity = buildMaturity(cards, unstudied);
  const active = cards.filter((card) => !card.isSuspended && card.type !== "NEW");
  const studiedCards = cards.filter((card) => card.type !== "NEW").length;

  const forecast = buildForecast(
    active.map((card) => card.due),
    todayStart,
    FORECAST_DAYS,
  );
  const history = buildReviewHistory(reviews, todayStart, HISTORY_DAYS);
  const retention = computeTrueRetention(reviews);
  const intervals = buildIntervalDistribution(
    active.filter((card) => card.intervalDays > 0).map((card) => card.intervalDays),
  );
  const averageSeconds = averageAnswerSeconds(reviews);

  const reviewedToday = history[history.length - 1]?.count ?? 0;
  const dueSoon = forecast.slice(0, 7).reduce((total, bucket) => total + bucket.count, 0);

  const filterLink = (slug: string | null, label: string) => {
    const isCurrent = (selected?.slug ?? null) === slug;
    return (
      <Link
        key={slug ?? "all"}
        href={slug ? `/flashcard/stats?deck=${slug}` : "/flashcard/stats"}
        aria-current={isCurrent ? "page" : undefined}
        className={cn(
          "rounded-md border-2 border-neo-ink px-2.5 py-1 text-xs font-black",
          isCurrent ? "bg-neo-ink text-white" : "bg-white text-black",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Deck saya
      </Link>

      <h1 className="mt-4 text-3xl font-black">Statistik</h1>
      <p className="mt-2 font-bold text-muted-foreground">
        Hari dihitung mulai jam {day.rolloverHour}:00 {day.timeZone}, mengikuti batas hari Anki.
        {selected ? null : " Kata yang ada di beberapa deck dihitung sebagai kartu di tiap deck."}
      </p>

      {decks.length > 1 ? (
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Filter deck">
          {filterLink(null, "Semua deck")}
          {decks.map((deck) => filterLink(deck.slug, deck.name))}
        </nav>
      ) : null}

      {studiedCards === 0 && reviews.length === 0 ? (
        <p className="neo-surface mt-7 p-6 text-center font-bold text-muted-foreground">
          Belum ada kartu yang dipelajari{selected ? ` di ${selected.name}` : ""}. Mulai belajar dari
          salah satu deck untuk melihat statistik.
        </p>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Kartu dipelajari" value={String(studiedCards)} />
            <StatTile
              label="True retention"
              value={retention.rate === null ? "—" : `${Math.round(retention.rate * 100)}%`}
              hint={
                retention.rate === null
                  ? "Belum ada review kartu matang."
                  : `${retention.passed} dari ${retention.total} review ${HISTORY_DAYS} hari terakhir`
              }
            />
            <StatTile label="Direview hari ini" value={String(reviewedToday)} />
            <StatTile
              label="Rata-rata jawab"
              value={averageSeconds === null ? "—" : `${averageSeconds.toFixed(1)}d`}
            />
          </div>

          <section className="neo-surface mt-6 p-5">
            <h2 className="text-lg font-black">Kematangan kartu</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Young: interval di bawah 21 hari. Mature: 21 hari atau lebih.
            </p>
            <div className="mt-4">
              <MaturityBar counts={maturity} />
            </div>
          </section>

          <section className="neo-surface mt-6 p-5">
            <h2 className="text-lg font-black">Perkiraan {FORECAST_DAYS} hari ke depan</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {dueSoon} kartu jatuh tempo dalam 7 hari. Kartu yang sudah lewat due dihitung
              di hari ini.
            </p>
            <div className="mt-4">
              <DailyBars buckets={forecast} tone="bg-neo-green" />
            </div>
          </section>

          <section className="neo-surface mt-6 p-5">
            <h2 className="text-lg font-black">Review {HISTORY_DAYS} hari terakhir</h2>
            <div className="mt-4">
              <DailyBars buckets={history} tone="bg-neo-blue" />
            </div>
          </section>

          <section className="neo-surface mt-6 p-5">
            <h2 className="text-lg font-black">Sebaran interval</h2>
            <ul className="mt-4 grid gap-2">
              {intervals.map((bucket) => {
                const max = Math.max(1, ...intervals.map((item) => item.count));
                return (
                  <li key={bucket.label} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3">
                    <span className="text-sm font-bold">{bucket.label}</span>
                    <span className="h-4 border-2 border-neo-ink">
                      <span
                        className="block h-full bg-neo-yellow"
                        style={{ width: `${(bucket.count / max) * 100}%` }}
                      />
                    </span>
                    <span className="text-right font-bold tabular-nums">{bucket.count}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
