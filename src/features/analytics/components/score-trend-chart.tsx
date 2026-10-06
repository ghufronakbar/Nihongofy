"use client";

import { useState } from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type TrendPoint = {
  id: number;
  attemptNumber: number;
  dateLabel: string;
  dateTimeLabel: string;
  packageLabel: string;
  sectionLabel: string | null;
  totalCorrect: number;
  totalQuestions: number;
  accuracy: number;
  plainScore: number;
  weightedScore: number;
  maxScore: number;
};

type TrendMetric = "plainScore" | "weightedScore" | "accuracy";

const METRICS: { key: TrendMetric; label: string; hint: string }[] = [
  {
    key: "plainScore",
    label: "Skor",
    hint: "Skor per seksi diskalakan ke 60 (total 180), sama dengan kolom Skor Asli di Progress.",
  },
  {
    key: "weightedScore",
    label: "Berbobot",
    hint: "Seperti Skor, tapi tiap mondai diberi bobot kesulitan (kolom Berbobot di Progress).",
  },
  {
    key: "accuracy",
    label: "Akurasi",
    hint: "Persentase soal yang dijawab benar dari seluruh soal, tanpa skala per seksi.",
  },
];

const chartConfig = {
  value: { label: "Nilai", color: "#5294ff" },
} satisfies ChartConfig;

function TrendTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  metric: TrendMetric;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  const rows: { key: TrendMetric; label: string; value: string }[] = [
    { key: "plainScore", label: "Skor", value: `${point.plainScore}/${point.maxScore}` },
    { key: "weightedScore", label: "Berbobot", value: `${point.weightedScore}/${point.maxScore}` },
    {
      key: "accuracy",
      label: "Akurasi",
      value: `${point.accuracy}% (${point.totalCorrect}/${point.totalQuestions})`,
    },
  ];

  return (
    <div className="min-w-56 rounded-lg border-2 border-neo-ink bg-white p-3 text-xs shadow-neo-sm">
      <div className="font-mono text-[10px] font-black uppercase text-foreground/60">
        Attempt #{point.attemptNumber} · {point.dateTimeLabel}
      </div>
      <div className="font-black text-sm text-neo-ink mt-0.5">{point.packageLabel}</div>
      {point.sectionLabel && (
        <div className="mt-1 inline-block border border-neo-ink bg-neo-paper px-1.5 font-mono text-[10px] font-black">
          {point.sectionLabel}
        </div>
      )}
      <dl className="mt-2 grid gap-1">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "flex items-center justify-between gap-4 border px-2 py-0.5",
              row.key === metric
                ? "border-neo-ink bg-neo-yellow shadow-neo-sm"
                : "border-transparent",
            )}
          >
            <dt className="font-mono text-[10px] font-black uppercase text-foreground/70">
              {row.label}
            </dt>
            <dd className="font-mono text-xs font-black tabular-nums text-neo-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AttemptTick({
  x,
  y,
  payload,
  className,
  pointsByNumber,
}: {
  x?: number;
  y?: number;
  payload?: { value: number };
  className?: string;
  pointsByNumber: Map<number, TrendPoint>;
}) {
  const point = payload ? pointsByNumber.get(payload.value) : undefined;
  if (!point) return null;

  // `className` (recharts-cartesian-axis-tick-value) + fontSize di <text>
  // wajib ada: Recharts membaca font-size elemen ini untuk mengukur label.
  // Tanpanya ia mengukur pakai 16px dan menyembunyikan tick terlalu banyak.
  return (
    <g transform={`translate(${x},${y})`}>
      <text className={className} textAnchor="middle" fontSize={10}>
        <tspan x={0} dy={12} fill="#111" fontSize={11} fontWeight={800}>
          #{point.attemptNumber}
        </tspan>
        <tspan x={0} dy={14} fill="#111" fillOpacity={0.6} fontWeight={700}>
          {point.dateLabel}
        </tspan>
      </text>
    </g>
  );
}

export function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  const [metric, setMetric] = useState<TrendMetric>("plainScore");

  // Skor ditampilkan apa adanya (mis. /180) kalau semua attempt punya skala
  // yang sama. Kalau tercampur (mock penuh /180 + latihan per seksi /60),
  // skor diubah ke persen dari skor maksimal masing-masing supaya tetap bisa
  // dibandingkan dalam satu sumbu.
  const firstMax = data[0]?.maxScore ?? 0;
  const uniformMax =
    firstMax > 0 && data.every((point) => point.maxScore === firstMax) ? firstMax : null;
  const isPercent = metric === "accuracy" || uniformMax === null;
  const yMax = isPercent ? 100 : uniformMax;
  const yTicks = [0, 1, 2, 3, 4].map((step) => (yMax * step) / 4);

  const chartData = data.map((point) => {
    if (metric === "accuracy") return { ...point, value: point.accuracy };
    const score = point[metric];
    if (!isPercent) return { ...point, value: score };
    return {
      ...point,
      value: point.maxScore > 0 ? Math.round((score / point.maxScore) * 100) : 0,
    };
  });

  const pointsByNumber = new Map(data.map((point) => [point.attemptNumber, point]));
  const activeMetric = METRICS.find((item) => item.key === metric)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Metrik tren" className="flex flex-wrap gap-2">
          {METRICS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={metric === item.key}
              onClick={() => setMetric(item.key)}
              className={cn(
                "neo-button min-h-9 px-3.5 py-1.5 font-mono text-xs font-black uppercase",
                metric === item.key ? "bg-neo-yellow text-black" : "bg-white text-black",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-foreground/70">
          {activeMetric.hint}
          {metric !== "accuracy" && isPercent && (
            <> Ditampilkan dalam % karena skala skor maksimal tiap attempt berbeda.</>
          )}
        </p>
      </div>

      <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
        <LineChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#111" strokeOpacity={0.15} vertical={false} />
          {/* Kunci unik per attempt — jangan pakai label tanggal sebagai
              dataKey, dua attempt di hari yang sama akan dianggap satu titik. */}
          <XAxis
            dataKey="attemptNumber"
            tickLine={false}
            axisLine={{ stroke: "#111", strokeWidth: 2 }}
            height={40}
            // Ruang supaya label tick pertama/terakhir tidak keluar plot —
            // kalau keluar, Recharts menggeser lalu menyembunyikan tick di
            // sebelahnya.
            padding={{ left: 20, right: 20 }}
            minTickGap={4}
            // Teks yang diukur Recharts saat memilih tick mana yang
            // disembunyikan (baris terlebar); tampilannya dirender AttemptTick.
            tickFormatter={(value: number) => pointsByNumber.get(value)?.dateLabel ?? ""}
            tick={<AttemptTick pointsByNumber={pointsByNumber} />}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={yTicks}
            tickFormatter={(value: number) => (isPercent ? `${value}%` : `${value}`)}
            tickLine={false}
            axisLine={{ stroke: "#111", strokeWidth: 2 }}
            tick={{ fill: "#111", fontWeight: 700, fontSize: 11 }}
            width={44}
          />
          <Tooltip content={<TrendTooltip metric={metric} />} />
          <Line
            dataKey="value"
            type="monotone"
            stroke="#5294ff"
            strokeWidth={3.5}
            dot={{ r: 5, fill: "#facc00", stroke: "#111", strokeWidth: 2 }}
            activeDot={{ r: 7, fill: "#ff5a5f", stroke: "#111", strokeWidth: 2.5 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
