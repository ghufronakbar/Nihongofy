import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayContextOf, ensureCollection } from "@/features/flashcard/lib/collection";
import { getFlashcardDayRange } from "@/features/flashcard/lib/scheduler/day";
import {
  averageAnswerSeconds,
  buildForecast,
  buildIntervalDistribution,
  buildReviewHistory,
  computeTrueRetention,
  type DailyBucket,
} from "@/features/flashcard/lib/stats";

export const metadata: Metadata = { title: "Statistik flashcard" };

const FORECAST_DAYS = 30;
const HISTORY_DAYS = 30;

function Bars({ buckets, tone }: { buckets: DailyBucket[]; tone: string }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <div className="flex h-32 items-end gap-0.5" role="img" aria-label="Grafik batang harian">
      {buckets.map((bucket) => (
        <div
          key={bucket.offset}
          className="flex-1"
          title={`${bucket.count} kartu (hari ${bucket.offset >= 0 ? `+${bucket.offset}` : bucket.offset})`}
        >
          <div
            className={`w-full border-2 border-neo-ink ${tone}`}
            style={{ height: `${Math.max(bucket.count === 0 ? 0 : 6, (bucket.count / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="neo-surface p-4">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default async function StatsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard/stats");

  const collection = await ensureCollection(session.userId);
  const day = dayContextOf(collection);
  const now = new Date();
  const { start: todayStart } = getFlashcardDayRange(now, day);

  const historyFrom = new Date(todayStart.getTime() - HISTORY_DAYS * 86_400_000);

  const [cards, reviews, byQueue] = await Promise.all([
    prisma.flashcardCard.findMany({
      where: { userId: session.userId, queue: { in: ["REVIEW", "LEARNING", "DAY_LEARN"] } },
      select: { due: true, intervalDays: true },
    }),
    prisma.flashcardRevlog.findMany({
      where: { userId: session.userId, reviewedAt: { gte: historyFrom } },
      select: { reviewedAt: true, rating: true, kind: true, takenMs: true },
    }),
    prisma.flashcardCard.groupBy({
      by: ["queue"],
      where: { userId: session.userId },
      _count: { _all: true },
    }),
  ]);

  const counts = Object.fromEntries(byQueue.map((row) => [row.queue, row._count._all]));
  const totalCards = byQueue.reduce((total, row) => total + row._count._all, 0);

  const forecast = buildForecast(
    cards.map((card) => card.due),
    todayStart,
    FORECAST_DAYS,
  );
  const history = buildReviewHistory(reviews, todayStart, HISTORY_DAYS);
  const retention = computeTrueRetention(reviews);
  const intervals = buildIntervalDistribution(
    cards.filter((card) => card.intervalDays > 0).map((card) => card.intervalDays),
  );
  const averageSeconds = averageAnswerSeconds(reviews);

  const reviewedToday = history[history.length - 1]?.count ?? 0;
  const dueSoon = forecast.slice(0, 7).reduce((total, bucket) => total + bucket.count, 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Semua deck
      </Link>

      <h1 className="mt-4 text-3xl font-black">Statistik</h1>
      <p className="mt-2 font-bold text-muted-foreground">
        Hari dihitung mulai jam {collection.rolloverHour}:00 {collection.timeZone}, mengikuti
        batas hari Anki.
      </p>

      {totalCards === 0 ? (
        <p className="neo-surface mt-7 p-6 text-center font-bold text-muted-foreground">
          Belum ada kartu. Tambahkan deck dulu untuk melihat statistik.
        </p>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total kartu" value={String(totalCards)} />
            <Stat
              label="True retention"
              value={retention.rate === null ? "—" : `${Math.round(retention.rate * 100)}%`}
              hint={
                retention.rate === null
                  ? "Belum ada review kartu matang."
                  : `${retention.passed} dari ${retention.total} review ${HISTORY_DAYS} hari terakhir`
              }
            />
            <Stat label="Direview hari ini" value={String(reviewedToday)} />
            <Stat
              label="Rata-rata jawab"
              value={averageSeconds === null ? "—" : `${averageSeconds.toFixed(1)}d`}
            />
          </div>

          <section className="neo-surface mt-6 p-5">
            <h2 className="text-lg font-black">Status kartu</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Baru", key: "NEW", tone: "bg-neo-blue" },
                { label: "Belajar", key: "LEARNING", tone: "bg-neo-coral" },
                { label: "Ulang", key: "REVIEW", tone: "bg-neo-green" },
                { label: "Suspend", key: "SUSPENDED", tone: "bg-neutral-300" },
              ].map((item) => (
                <div
                  key={item.key}
                  className={`rounded border-[3px] border-neo-ink p-3 text-center ${item.tone}`}
                >
                  <dt className="text-xs font-black uppercase text-black">{item.label}</dt>
                  <dd className="mt-1 text-2xl font-black tabular-nums text-black">
                    {counts[item.key] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="neo-surface mt-6 p-5">
            <h2 className="text-lg font-black">Perkiraan {FORECAST_DAYS} hari ke depan</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {dueSoon} kartu jatuh tempo dalam 7 hari. Kartu yang sudah lewat due dihitung
              di hari ini.
            </p>
            <div className="mt-4">
              <Bars buckets={forecast} tone="bg-neo-green" />
            </div>
          </section>

          <section className="neo-surface mt-6 p-5">
            <h2 className="text-lg font-black">Review {HISTORY_DAYS} hari terakhir</h2>
            <div className="mt-4">
              <Bars buckets={history} tone="bg-neo-blue" />
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
