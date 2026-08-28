"use client";

import Link from "next/link";
import type { JlptLevel, MondaiType } from "@prisma/client";
import type { ScoringSectionKey } from "@/lib/jlpt-score";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import { ProgressExportButtons } from "./progress-export-buttons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const WEAK_THRESHOLD = 60;
const STRONG_THRESHOLD = 80;

export const SECTION_COLUMNS: { key: ScoringSectionKey; label: string }[] = [
  { key: "GENGO_CHISHIKI", label: "言語知識" },
  { key: "DOKKAI", label: "読解" },
  { key: "CHOUKAI", label: "聴解" },
];

export type ProgressTableRow = {
  attemptId: number;
  packageName: string;
  dateLabel: string;
  mondaiAccuracy: Partial<Record<MondaiType, number>>;
  sections: Record<
    ScoringSectionKey,
    { plainScore: number; weightedScore: number; accuracy: number } | null
  >;
  totalPlain: number;
  totalWeighted: number;
  totalMax: number;
  totalAccuracy: number;
};

export type ProgressLevelView = {
  level: JlptLevel;
  mondaiColumns: { mondaiType: MondaiType; label: string }[];
  rows: ProgressTableRow[];
};

function accuracyClass(accuracy: number) {
  if (accuracy < WEAK_THRESHOLD) return "text-destructive font-black";
  if (accuracy >= STRONG_THRESHOLD) return "text-emerald-600 font-bold";
  return "font-medium text-foreground";
}

function LevelTable({ view }: { view: ProgressLevelView }) {
  return (
    <div className="neo-surface overflow-hidden border-[3px] border-neo-ink shadow-neo bg-white">
      <Table>
        <TableHeader className="bg-neo-paper border-b-[3px] border-neo-ink">
          <TableRow className="border-b-[2px] border-neo-ink/20 hover:bg-transparent">
            <TableHead rowSpan={2} className="whitespace-normal align-bottom font-mono font-black text-xs uppercase text-neo-ink">
              Paket Ujian
            </TableHead>
            <TableHead rowSpan={2} className="align-bottom font-mono font-black text-xs uppercase text-neo-ink">
              Tanggal
            </TableHead>
            <TableHead colSpan={view.mondaiColumns.length} className="border-l-2 border-neo-ink/20 text-center font-mono font-black text-xs uppercase text-neo-ink bg-neo-yellow/30">
              Akurasi per Mondai (%)
            </TableHead>
            <TableHead colSpan={SECTION_COLUMNS.length} className="border-l-2 border-neo-ink/20 text-center font-mono font-black text-xs uppercase text-neo-ink bg-neo-blue/20">
              Skor per Seksi (60)
            </TableHead>
            <TableHead colSpan={SECTION_COLUMNS.length} className="border-l-2 border-neo-ink/20 text-center font-mono font-black text-xs uppercase text-neo-ink bg-neo-green/20">
              Skor Berbobot (60)
            </TableHead>
            <TableHead colSpan={2} className="border-l-2 border-neo-ink/20 text-center font-mono font-black text-xs uppercase text-neo-ink bg-neo-paper">
              Total Skor (180)
            </TableHead>
          </TableRow>
          <TableRow className="hover:bg-transparent">
            {view.mondaiColumns.map((column, index) => (
              <TableHead
                key={column.mondaiType}
                title={mondaiTypeFullLabel(column.mondaiType)}
                className={cn("text-right font-mono text-[11px] font-bold text-foreground/80", index === 0 && "border-l-2 border-neo-ink/20")}
              >
                {column.label}
              </TableHead>
            ))}
            {SECTION_COLUMNS.map((column, index) => (
              <TableHead
                key={`plain-${column.key}`}
                className={cn("text-right font-mono text-[11px] font-bold text-foreground/80", index === 0 && "border-l-2 border-neo-ink/20")}
              >
                {column.label}
              </TableHead>
            ))}
            {SECTION_COLUMNS.map((column, index) => (
              <TableHead
                key={`weighted-${column.key}`}
                className={cn("text-right font-mono text-[11px] font-bold text-foreground/80", index === 0 && "border-l-2 border-neo-ink/20")}
              >
                {column.label}
              </TableHead>
            ))}
            <TableHead className="border-l-2 border-neo-ink/20 text-right font-mono text-[11px] font-black text-neo-ink">Skor Asli</TableHead>
            <TableHead className="text-right font-mono text-[11px] font-black text-neo-ink">Berbobot</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.rows.map((row) => (
            <TableRow key={row.attemptId} className="border-b border-neo-ink/10 hover:bg-neo-paper/60 transition-colors">
              <TableCell className="whitespace-normal">
                <Link
                  href={`/result/${row.attemptId}`}
                  className="font-black text-neo-ink underline decoration-2 underline-offset-4 hover:text-neo-blue transition-colors"
                >
                  {row.packageName}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{row.dateLabel}</TableCell>
              {view.mondaiColumns.map((column, index) => {
                const accuracy = row.mondaiAccuracy[column.mondaiType];
                return (
                  <TableCell
                    key={column.mondaiType}
                    className={cn(
                      "text-right tabular-nums text-xs font-bold",
                      index === 0 && "border-l-2 border-neo-ink/10",
                      accuracy !== undefined && accuracyClass(accuracy),
                    )}
                  >
                    {accuracy !== undefined ? `${accuracy}%` : "–"}
                  </TableCell>
                );
              })}
              {SECTION_COLUMNS.map((column, index) => {
                const section = row.sections[column.key];
                return (
                  <TableCell
                    key={`plain-${column.key}`}
                    className={cn("text-right tabular-nums text-xs font-bold", index === 0 && "border-l-2 border-neo-ink/10")}
                  >
                    {section ? (
                      <>
                        {section.plainScore}/60{" "}
                        <span className={cn("text-[10px]", accuracyClass(section.accuracy))}>
                          ({section.accuracy}%)
                        </span>
                      </>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                );
              })}
              {SECTION_COLUMNS.map((column, index) => {
                const section = row.sections[column.key];
                return (
                  <TableCell
                    key={`weighted-${column.key}`}
                    className={cn("text-right tabular-nums text-xs font-bold", index === 0 && "border-l-2 border-neo-ink/10")}
                  >
                    {section ? `${section.weightedScore}/60` : "–"}
                  </TableCell>
                );
              })}
              <TableCell className="border-l-2 border-neo-ink/10 text-right font-black tabular-nums text-sm">
                {row.totalPlain}/{row.totalMax}{" "}
                <span className={cn("font-bold text-xs ml-1", accuracyClass(row.totalAccuracy))}>
                  ({row.totalAccuracy}%)
                </span>
              </TableCell>
              <TableCell className="text-right font-black tabular-nums text-sm text-neo-blue">
                {row.totalWeighted}/{row.totalMax}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ProgressTabs({ levels }: { levels: ProgressLevelView[] }) {
  return (
    <Tabs defaultValue={levels[0].level} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <TabsList className="flex-wrap gap-2 bg-transparent p-0">
          {levels.map((view) => (
            <TabsTrigger
              key={view.level}
              value={view.level}
              className="h-10 rounded-lg border-2 border-neo-ink bg-white px-5 font-mono text-sm font-black shadow-neo-sm transition-all data-active:bg-neo-blue data-active:text-white data-active:shadow-neo hover:bg-neo-paper"
            >
              JLPT {view.level}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {levels.map((view) => (
        <TabsContent key={view.level} value={view.level} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-neo-ink/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black shadow-neo-sm">
                LEVEL {view.level}
              </span>
              <span className="font-mono text-xs font-bold text-foreground/60">
                {view.rows.length} ATTEMPT TERCATAT
              </span>
            </div>
            <ProgressExportButtons view={view} />
          </div>

          <LevelTable view={view} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
