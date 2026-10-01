import type { DailyBucket, MaturityCounts } from "../lib/stats";

/** Potongan UI statistik, dipakai halaman statistik dan halaman deck. */

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="neo-surface p-4">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DailyBars({
  buckets,
  tone,
  className = "h-32",
}: {
  buckets: DailyBucket[];
  tone: string;
  className?: string;
}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <div className={`flex items-end gap-0.5 ${className}`} role="img" aria-label="Grafik batang harian">
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

export const MATURITY_ITEMS: {
  key: keyof MaturityCounts;
  label: string;
  hint: string;
  tone: string;
}[] = [
  { key: "new", label: "Baru", hint: "Belum pernah dijawab", tone: "bg-neo-blue" },
  { key: "learning", label: "Belajar", hint: "Masih di learning steps", tone: "bg-neo-coral" },
  { key: "young", label: "Young", hint: "Interval di bawah 21 hari", tone: "bg-neo-yellow" },
  { key: "mature", label: "Mature", hint: "Interval 21 hari atau lebih", tone: "bg-neo-green" },
  { key: "suspended", label: "Suspend", hint: "Tidak muncul di antrean", tone: "bg-neutral-300" },
];

/** Batang bertumpuk kematangan kartu beserta legendanya, seperti "Card Counts" Anki. */
export function MaturityBar({ counts }: { counts: MaturityCounts }) {
  const total = MATURITY_ITEMS.reduce((sum, item) => sum + counts[item.key], 0);

  return (
    <div>
      <div
        className="flex h-5 overflow-hidden rounded border-2 border-neo-ink bg-card"
        role="img"
        aria-label={MATURITY_ITEMS.map((item) => `${item.label} ${counts[item.key]}`).join(", ")}
      >
        {total > 0
          ? MATURITY_ITEMS.map((item) =>
              counts[item.key] > 0 ? (
                <span
                  key={item.key}
                  className={`h-full ${item.tone}`}
                  style={{ width: `${(counts[item.key] / total) * 100}%` }}
                />
              ) : null,
            )
          : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {MATURITY_ITEMS.map((item) => (
          <div key={item.key} className="flex items-start gap-2" title={item.hint}>
            <span className={`mt-1 size-3 shrink-0 rounded-sm border-2 border-neo-ink ${item.tone}`} />
            <div>
              <dt className="text-xs font-black uppercase">{item.label}</dt>
              <dd className="text-lg font-black tabular-nums">{counts[item.key]}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
