"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  summarizeActivity,
  type ActivityDayRow,
  type ActivitySummary,
  type CalendarDate,
  type HeatmapCell,
  type HeatmapLevel,
} from "../activity";

// Ramp sekuensial satu hue (hijau neo), terang → gelap. Divalidasi dengan
// validator ordinal skill dataviz: lightness monoton, jarak antar-level ≥ 0.06,
// ujung terang 2.15:1 terhadap putih. Level 0 abu netral, bukan hijau pucat,
// supaya "tidak ada aktivitas" tidak terbaca sebagai sedikit aktivitas.
const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: "bg-[#eef0f3]",
  1: "bg-[#2bc97f]",
  2: "bg-[#0a9e5d]",
  3: "bg-[#067243]",
  4: "bg-[#034d2c]",
};

const DAY_LABELS = ["Sen", "", "Rab", "", "Jum", "", ""];

const CELL = 11;
const GAP = 3;

type Sources = { flashcard: boolean; practice: boolean; exam: boolean };

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function describe(cell: HeatmapCell, sources: Sources) {
  const parts = [
    sources.flashcard && cell.flashcard > 0 ? `${cell.flashcard} review flashcard` : null,
    sources.practice && cell.practice > 0 ? `${cell.practice} latihan cepat` : null,
    sources.exam && cell.exam > 0 ? `${cell.exam} ujian` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Tidak ada aktivitas";
}

type MonthRow = { key: string; label: string; activeDays: number; flashcard: number; practice: number; exam: number };

function monthlyRows(summary: ActivitySummary): MonthRow[] {
  const rows = new Map<string, MonthRow>();
  for (const cell of summary.weeks.flat()) {
    if (!cell.inRange) continue;
    const key = cell.day.slice(0, 7);
    const row =
      rows.get(key) ??
      { key, label: monthFormatter.format(new Date(`${key}-01T00:00:00Z`)), activeDays: 0, flashcard: 0, practice: 0, exam: 0 };
    if (cell.level > 0) row.activeDays += 1;
    row.flashcard += cell.flashcard;
    row.practice += cell.practice;
    row.exam += cell.exam;
    rows.set(key, row);
  }
  // Terbaru dulu: yang paling sering dicari adalah bulan-bulan terakhir.
  return [...rows.values()].reverse();
}

// Menerima baris hari aktif saja, bukan grid jadi: grid 371 sel yang dikirim
// utuh akan menggelembungkan payload RSC halaman sekitar 30 KB. Grid disusun
// ulang di client dengan fungsi yang sama dengan server.
export function ActivityHeatmap({
  rows,
  today,
  sources,
}: {
  rows: ActivityDayRow[];
  today: CalendarDate;
  sources: Sources;
}) {
  const summary = useMemo(() => summarizeActivity(rows, today), [rows, today]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ cell: HeatmapCell; left: number; top: number } | null>(null);
  const months = useMemo(() => monthlyRows(summary), [summary]);
  const cellByDay = useMemo(
    () => new Map(summary.weeks.flat().map((cell) => [cell.day, cell])),
    [summary],
  );

  // Di layar sempit grid lebih lebar dari kartunya; mulai dari ujung kanan
  // supaya minggu terbaru yang terlihat lebih dulu.
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  function showTooltip(target: EventTarget) {
    if (!(target instanceof HTMLElement) || !wrapperRef.current) return;
    const day = target.dataset.day;
    const cell = day ? cellByDay.get(day) : undefined;
    if (!cell || !cell.inRange) {
      setTooltip(null);
      return;
    }
    const cellRect = target.getBoundingClientRect();
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    setTooltip({
      cell,
      left: cellRect.left - wrapperRect.left + cellRect.width / 2,
      top: cellRect.top - wrapperRect.top,
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div ref={wrapperRef} className="relative min-w-0">
        <div ref={scrollRef} className="overflow-x-auto pb-2" onScroll={() => setTooltip(null)}>
          <div className="inline-grid gap-y-1" style={{ gridTemplateColumns: "auto auto" }}>
            <span aria-hidden="true" />
            <div
              aria-hidden="true"
              className="relative h-4 font-mono text-[10px] font-bold text-black/60"
              style={{ width: summary.weeks.length * (CELL + GAP) - GAP }}
            >
              {summary.monthLabels.map((label) => (
                <span
                  key={`${label.weekIndex}-${label.label}`}
                  className="absolute top-0"
                  style={{ left: label.weekIndex * (CELL + GAP) }}
                >
                  {label.label}
                </span>
              ))}
            </div>

            <div
              aria-hidden="true"
              className="sticky left-0 z-[1] grid bg-white pr-2 font-mono text-[10px] leading-none font-bold text-black/60"
              style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP }}
            >
              {DAY_LABELS.map((label, index) => (
                <span key={index} className="flex items-center">
                  {label}
                </span>
              ))}
            </div>

            <div
              aria-hidden="true"
              className="grid grid-flow-col"
              style={{
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gridAutoColumns: `${CELL}px`,
                gap: GAP,
              }}
              onPointerOver={(event) => showTooltip(event.target)}
              onPointerLeave={() => setTooltip(null)}
            >
              {summary.weeks.flat().map((cell) => (
                <span
                  key={cell.day}
                  data-day={cell.day}
                  className={
                    cell.inRange
                      ? `rounded-[2px] ${LEVEL_CLASS[cell.level]} ${cell.level === 0 ? "ring-1 ring-black/5 ring-inset" : ""}`
                      : "invisible"
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {tooltip ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 w-max max-w-64 -translate-x-1/2 -translate-y-full border-2 border-black bg-white px-2.5 py-1.5 text-xs shadow-neo-sm"
            style={{ left: tooltip.left, top: tooltip.top - 6 }}
          >
            <span className="block font-black text-black">{describe(tooltip.cell, sources)}</span>
            <span className="block font-semibold text-black/60">
              {dateFormatter.format(new Date(`${tooltip.cell.day}T00:00:00Z`))}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-black/60" aria-hidden="true">
        <span>Sedikit</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            className={`size-[11px] rounded-[2px] ${LEVEL_CLASS[level]} ${level === 0 ? "ring-1 ring-black/5 ring-inset" : ""}`}
          />
        ))}
        <span>Banyak</span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-bold underline decoration-2 underline-offset-4">
          Lihat sebagai tabel
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <caption className="sr-only">Aktivitas belajar per bulan, 12 bulan terakhir</caption>
            <thead>
              <tr className="border-b-2 border-black">
                <th scope="col" className="py-1.5 pr-3 font-black">Bulan</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-black">Hari aktif</th>
                {sources.flashcard ? <th scope="col" className="py-1.5 pr-3 text-right font-black">Review kartu</th> : null}
                {sources.practice ? <th scope="col" className="py-1.5 pr-3 text-right font-black">Latihan cepat</th> : null}
                {sources.exam ? <th scope="col" className="py-1.5 text-right font-black">Ujian</th> : null}
              </tr>
            </thead>
            <tbody>
              {months.map((row) => (
                <tr key={row.key} className="border-b border-black/10">
                  <th scope="row" className="py-1.5 pr-3 font-semibold capitalize">{row.label}</th>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.activeDays}</td>
                  {sources.flashcard ? <td className="py-1.5 pr-3 text-right tabular-nums">{row.flashcard}</td> : null}
                  {sources.practice ? <td className="py-1.5 pr-3 text-right tabular-nums">{row.practice}</td> : null}
                  {sources.exam ? <td className="py-1.5 text-right tabular-nums">{row.exam}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
