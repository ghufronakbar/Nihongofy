import type { JlptLevel } from "@prisma/client";
import { JlptScoreTable } from "@/components/jlpt-score-table";
import type { JlptScoreProjection } from "@/lib/jlpt-score";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Trophy } from "lucide-react";

export function AnalyticsTabs({
  levelStats,
}: {
  levelStats: { level: JlptLevel; projection: JlptScoreProjection }[];
}) {
  return (
    <Tabs defaultValue={levelStats[0].level} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <TabsList className="flex-wrap gap-2 bg-transparent p-0">
          {levelStats.map(({ level }) => (
            <TabsTrigger
              key={level}
              value={level}
              className="h-10 rounded-lg border-2 border-neo-ink bg-white px-5 font-mono text-sm font-black shadow-neo-sm transition-all data-active:bg-neo-blue data-active:text-white data-active:shadow-neo hover:bg-neo-paper"
            >
              JLPT {level}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {levelStats.map(({ level, projection }) => (
        <TabsContent key={level} value={level} className="space-y-4">
          <div className="neo-surface bg-white p-6 sm:p-7 border-[3px] border-neo-ink shadow-neo">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-neo-ink pb-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm">
                    PROYEKSI AKUMULATIF
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground/60">
                    JLPT {level}
                  </span>
                </div>
                <h3 className="mt-2 text-2xl font-black text-neo-ink">
                  Akurasi Mondai & Skala 180 Poin
                </h3>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-foreground/70 max-w-2xl">
                  Agregat attempt sesuai filter rentang waktu. Skala resmi 60 per section (total 180 poin) dengan aproksimasi bobot kesulitan soal.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="border-2 border-neo-ink bg-neo-paper p-3 rounded-lg text-right shadow-neo-sm">
                  <span className="font-mono text-[10px] font-black uppercase text-foreground/60 block">
                    TOTAL AKURASI
                  </span>
                  <span className="text-2xl font-black text-neo-ink">{projection.accuracy}%</span>
                </div>
                <div className="border-2 border-neo-ink bg-neo-green p-3 rounded-lg text-right shadow-neo-sm text-black">
                  <span className="font-mono text-[10px] font-black uppercase text-black/70 block">
                    SKOR PROYEKSI
                  </span>
                  <span className="text-2xl font-black">{projection.weightedScore}/{projection.maxScore}</span>
                </div>
              </div>
            </div>

            <JlptScoreTable projection={projection} />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
