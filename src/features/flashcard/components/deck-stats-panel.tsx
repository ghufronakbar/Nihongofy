import type { DeckStats } from "../data";
import { DailyBars, MaturityBar, StatTile } from "./stats-widgets";

const WEEKDAY_LABELS = ["Hari ini", "+1", "+2", "+3", "+4", "+5", "+6"];

/** Statistik satu deck di halaman deck. */
export function DeckStatsPanel({ stats }: { stats: DeckStats }) {
  const percent = stats.wordCount === 0 ? 0 : Math.round((stats.studied / stats.wordCount) * 100);
  const dueWeek = stats.forecast.reduce((total, bucket) => total + bucket.count, 0);

  return (
    <section className="mt-8 grid gap-4" aria-labelledby="deck-stats">
      <h2 id="deck-stats" className="text-xl font-black">
        Statistik deck
      </h2>

      <div className="neo-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-black">Progres</h3>
          <p className="text-sm font-bold tabular-nums text-muted-foreground">
            {stats.studied} dari {stats.wordCount} kata dipelajari ({percent}%)
          </p>
        </div>
        <div className="mt-4">
          <MaturityBar counts={stats.maturity} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Retensi 30 hari"
          value={stats.retention.rate === null ? "—" : `${Math.round(stats.retention.rate * 100)}%`}
          hint={
            stats.retention.rate === null
              ? "Belum ada review kartu matang."
              : `${stats.retention.passed} dari ${stats.retention.total} review diingat`
          }
        />
        <StatTile
          label="Jawaban 30 hari"
          value={String(stats.reviews30d)}
          hint="Termasuk learning dan relearning"
        />
      </div>

      <div className="neo-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-black">Perkiraan 7 hari</h3>
          <p className="text-sm font-bold tabular-nums text-muted-foreground">
            {dueWeek} kartu jatuh tempo
          </p>
        </div>
        <div className="mt-4">
          <DailyBars buckets={stats.forecast} tone="bg-neo-green" className="h-20" />
          <div className="mt-1 flex gap-0.5 text-center text-[10px] font-bold text-muted-foreground">
            {stats.forecast.map((bucket) => (
              <span key={bucket.offset} className="flex-1 tabular-nums">
                {WEEKDAY_LABELS[bucket.offset] ?? `+${bucket.offset}`}
                <span className="block text-foreground">{bucket.count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="neo-surface p-5">
        <h3 className="font-black">Kata tersulit</h3>
        {stats.hardest.length === 0 ? (
          <p className="mt-2 text-sm font-bold text-muted-foreground">
            Belum ada kartu yang terlupa di deck ini.
          </p>
        ) : (
          <ol className="mt-3 divide-y-2 divide-neo-ink/15">
            {stats.hardest.map((word) => (
              <li key={word.vocabId} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span lang="ja" className="font-japanese text-lg font-black">
                    {word.wordPlain}
                  </span>
                  {word.reading !== word.wordPlain ? (
                    <span lang="ja" className="font-japanese ml-2 text-sm font-bold text-muted-foreground">
                      {word.reading}
                    </span>
                  ) : null}
                </span>
                {word.isLeech ? (
                  <span className="text-xs font-black text-neo-coral">Leech</span>
                ) : null}
                <span className="text-sm font-bold tabular-nums">{word.lapses}× terlupa</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
