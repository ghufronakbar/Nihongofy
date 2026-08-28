import { Fragment } from "react";
import type { JlptScoreProjection } from "@/lib/jlpt-score";
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

function accuracyClass(accuracy: number) {
  if (accuracy < WEAK_THRESHOLD) return "text-destructive font-black";
  if (accuracy >= STRONG_THRESHOLD) return "text-emerald-600 font-bold";
  return "font-bold text-foreground";
}

// Kolom "Skor"/"Skor Berbobot" hanya terisi di baris subtotal & total — skor
// skala-60 memang milik scoring section, bukan milik satu mondai.
export function JlptScoreTable({ projection }: { projection: JlptScoreProjection }) {
  return (
    <div className="neo-surface overflow-hidden border-[3px] border-neo-ink shadow-neo bg-white">
      <Table>
        <TableHeader className="bg-neo-paper border-b-[3px] border-neo-ink">
          <TableRow className="hover:bg-transparent">
            <TableHead className="whitespace-normal font-mono font-black text-xs uppercase text-neo-ink">Mondai</TableHead>
            <TableHead className="text-right font-mono font-black text-xs uppercase text-neo-ink">Bobot</TableHead>
            <TableHead className="text-right font-mono font-black text-xs uppercase text-neo-ink">Benar</TableHead>
            <TableHead className="text-right font-mono font-black text-xs uppercase text-neo-ink">Akurasi</TableHead>
            <TableHead className="text-right font-mono font-black text-xs uppercase text-neo-ink">Skor (60)</TableHead>
            <TableHead className="text-right font-mono font-black text-xs uppercase text-neo-ink">Skor Berbobot (60)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projection.sections.map((section) => (
            <Fragment key={section.key}>
              <TableRow className="bg-neo-yellow/25 border-t-2 border-b-2 border-neo-ink hover:bg-neo-yellow/30">
                <TableCell colSpan={6} className="whitespace-normal font-black text-sm text-neo-ink">
                  {section.label}
                </TableCell>
              </TableRow>
              {section.rows.map((row) => (
                <TableRow key={row.mondaiType} className="border-b border-neo-ink/10 hover:bg-neo-paper/50">
                  <TableCell className="whitespace-normal pl-6 font-bold text-xs text-foreground/80">{row.label}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-foreground/60 tabular-nums">
                    ×{row.weight.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold tabular-nums">
                    {row.correct}/{row.total}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-xs tabular-nums",
                      accuracyClass(row.accuracy),
                    )}
                  >
                    {row.accuracy}%
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              ))}
              <TableRow className="border-b-2 border-neo-ink/20 bg-neo-paper/60 font-bold">
                <TableCell className="pl-6 font-mono text-xs font-black text-neo-ink uppercase">Subtotal {section.label}</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono text-xs font-black tabular-nums">
                  {section.correct}/{section.total}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-xs tabular-nums",
                    accuracyClass(section.accuracy),
                  )}
                >
                  {section.accuracy}%
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-black tabular-nums">{section.plainScore} / 60</TableCell>
                <TableCell className="text-right font-mono text-xs font-black tabular-nums text-neo-blue">
                  {section.weightedScore} / 60
                </TableCell>
              </TableRow>
            </Fragment>
          ))}
          <TableRow className="border-t-[3px] border-neo-ink bg-neo-blue text-white font-black hover:bg-neo-blue">
            <TableCell className="font-mono text-sm font-black uppercase text-white">TOTAL KESELURUHAN</TableCell>
            <TableCell />
            <TableCell className="text-right font-mono text-sm font-black tabular-nums text-white">
              {projection.correct}/{projection.total}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-black tabular-nums text-white">{projection.accuracy}%</TableCell>
            <TableCell className="text-right font-mono text-sm font-black tabular-nums text-white">
              {projection.plainScore} / {projection.maxScore}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-black tabular-nums text-neo-yellow">
              {projection.weightedScore} / {projection.maxScore}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
