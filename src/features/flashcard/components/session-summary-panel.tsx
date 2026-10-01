import { AlertTriangle } from "lucide-react";
import { formatDuration, type SessionSummary } from "../lib/session-summary";
import { RATING_OPTIONS } from "./rating-options";

type Props = {
  title: string;
  summary: SessionSummary;
  /** Perkiraan kartu deck ini yang jatuh tempo besok; null di mode coba. */
  tomorrowCount: number | null;
};

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border-[3px] border-neo-ink bg-card p-3">
      <dt className="text-[0.7rem] font-black tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-black tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs font-semibold text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

/** Ringkasan sesi belajar: dihitung di client dari jawaban sesi ini saja. */
export function SessionSummaryPanel({ title, summary, tomorrowCount }: Props) {
  const percent = (count: number) =>
    summary.total === 0 ? 0 : Math.round((count / summary.total) * 100);

  return (
    <section className="mt-6 text-left" aria-labelledby="session-summary-title">
      <h3 id="session-summary-title" className="text-lg font-black">
        {title}
      </h3>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Dijawab"
          value={String(summary.total)}
          hint={`${summary.uniqueCards} kartu · ${summary.newLearned} baru`}
        />
        <Tile
          label="Benar"
          value={summary.correctRate === null ? "—" : `${Math.round(summary.correctRate * 100)}%`}
          hint="Selain Again"
        />
        <Tile
          label="Rata-rata"
          value={summary.averageSeconds === null ? "—" : `${summary.averageSeconds.toFixed(1)}d`}
          hint="per jawaban"
        />
        <Tile
          label="Durasi"
          value={formatDuration(summary.durationMs)}
          hint={`${formatDuration(summary.answerMs)} menjawab`}
        />
      </dl>

      <div className="mt-4 space-y-1.5" role="list" aria-label="Sebaran jawaban">
        {RATING_OPTIONS.map((rating) => {
          const count = summary.ratings[rating.value];
          return (
            <div key={rating.value} role="listitem" className="flex items-center gap-2 text-sm">
              <span className="w-12 shrink-0 font-black">{rating.label}</span>
              <span className="h-4 flex-1 overflow-hidden rounded border-2 border-neo-ink bg-card">
                <span
                  className={`block h-full ${rating.tone}`}
                  style={{ width: `${percent(count)}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right font-bold tabular-nums">
                {count} <span className="text-muted-foreground">({percent(count)}%)</span>
              </span>
            </div>
          );
        })}
      </div>

      {summary.mostMissed.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-sm font-black">Paling sering terlupa</h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {summary.mostMissed.map((card) => (
              <li
                key={card.vocabId}
                className="rounded-md border-2 border-neo-ink bg-card px-2 py-1 text-sm font-bold"
              >
                <span lang="ja" className="font-japanese font-black">
                  {card.wordPlain}
                </span>{" "}
                <span className="text-xs text-muted-foreground tabular-nums">×{card.again}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.leeches.length > 0 ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border-2 border-neo-ink bg-neo-yellow px-3 py-2 text-sm font-bold text-black">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Leech baru:{" "}
            {summary.leeches.map((card, index) => (
              <span key={card.vocabId}>
                {index > 0 ? ", " : null}
                <span lang="ja" className="font-japanese font-black">
                  {card.wordPlain}
                </span>
              </span>
            ))}
            . Kartu ini sering terlupa; cek catatannya di daftar kata deck.
          </span>
        </p>
      ) : null}

      {tomorrowCount !== null ? (
        <p className="mt-4 text-sm font-bold text-muted-foreground">
          Besok: <span className="text-foreground tabular-nums">{tomorrowCount}</span> kartu di
          deck ini jatuh tempo.
        </p>
      ) : null}
    </section>
  );
}
