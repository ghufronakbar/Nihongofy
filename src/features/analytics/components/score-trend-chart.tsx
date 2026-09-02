"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

type TrendPoint = {
  id: number;
  dateLabel: string;
  packageLabel: string;
  scorePercentage: number;
};

const chartConfig = {
  scorePercentage: { label: "Skor (%)", color: "#5294ff" },
} satisfies ChartConfig;

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border-2 border-neo-ink bg-white p-3 text-xs shadow-neo-sm">
      <div className="font-mono text-[10px] font-black uppercase text-foreground/60">{point.dateLabel}</div>
      <div className="font-black text-sm text-neo-ink mt-0.5">{point.packageLabel}</div>
      <div className="mt-2 inline-flex items-center gap-1.5 border border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-xs font-black shadow-neo-sm">
        <span>Akurasi:</span>
        <span>{point.scorePercentage}%</span>
      </div>
    </div>
  );
}

export function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <LineChart data={data} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#111" strokeOpacity={0.15} vertical={false} />
        <XAxis dataKey="dateLabel" tickLine={false} axisLine={{ stroke: "#111", strokeWidth: 2 }} tick={{ fill: "#111", fontWeight: 700, fontSize: 11 }} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={{ stroke: "#111", strokeWidth: 2 }} tick={{ fill: "#111", fontWeight: 700, fontSize: 11 }} width={36} />
        <Tooltip content={<TrendTooltip />} />
        <Line
          dataKey="scorePercentage"
          type="monotone"
          stroke="#5294ff"
          strokeWidth={3.5}
          dot={{ r: 5, fill: "#facc00", stroke: "#111", strokeWidth: 2 }}
          activeDot={{ r: 7, fill: "#ff5a5f", stroke: "#111", strokeWidth: 2.5 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
