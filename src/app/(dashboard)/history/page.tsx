import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  History,
  PlayCircle,
  Sparkles,
  Trophy,
} from "lucide-react";
import { getAttemptHistory } from "@/features/history/actions";
import { JLPT_SECTION_LABELS } from "@/constants/jlpt";
import type { JlptLevel } from "@prisma/client";
import { formatInTimeZone } from "@/lib/time-zone";
import { getCurrentUserTimeZone } from "@/lib/user-time-zone";

const LEVEL_BADGE_STYLES: Record<JlptLevel, string> = {
  N5: "bg-neo-green text-black",
  N4: "bg-neo-blue text-white",
  N3: "bg-neo-yellow text-black",
  N2: "bg-neo-coral text-white",
  N1: "bg-purple-400 text-white",
};

export default async function HistoryPage() {
  const [attempts, timeZone] = await Promise.all([
    getAttemptHistory(),
    getCurrentUserTimeZone(),
  ]);

  const completedAttempts = attempts.filter((a) => a.status === "COMPLETED").length;
  const inProgressAttempts = attempts.filter((a) => a.status === "IN_PROGRESS").length;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Hero Banner */}
      <section className="neo-surface neo-grid-paper relative overflow-hidden bg-white p-6 sm:p-8 md:p-10 border-[3px] border-neo-ink shadow-neo-lg">
        <div
          className="absolute -top-10 -right-8 hidden size-36 rotate-12 border-[3px] border-neo-ink bg-neo-coral shadow-neo sm:block"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-8 right-24 hidden size-20 -rotate-12 border-[3px] border-neo-ink bg-neo-yellow shadow-neo md:block"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl">
          <div className="neo-kicker -rotate-1">
            <History className="size-3.5" />
            CATATAN & EVALUASI
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-black uppercase leading-[0.95] text-neo-ink tracking-tight">
            Riwayat Attempt
            <span className="block text-neo-blue [text-shadow:2px_2px_0_#111]">Ujian & Latihan.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg font-semibold text-foreground/75">
            Semua attempt yang pernah kamu mulai, lintas paket dan level. Buka kembali hasil ujian atau lanjutkan attempt yang masih berjalan.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs font-black">
            <span className="border-2 border-neo-ink bg-white px-3 py-1.5 shadow-neo-sm">
              {attempts.length} TOTAL ATTEMPT
            </span>
            <span className="border-2 border-neo-ink bg-neo-green px-3 py-1.5 shadow-neo-sm">
              {completedAttempts} SELESAI
            </span>
            {inProgressAttempts > 0 && (
              <span className="border-2 border-neo-ink bg-neo-yellow px-3 py-1.5 shadow-neo-sm">
                {inProgressAttempts} SEDANG DIKERJAKAN
              </span>
            )}
          </div>
        </div>
      </section>

      {/* KPI Stats Summary */}
      <section className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <div className="neo-surface bg-white p-4 sm:p-5 border-[3px] border-neo-ink shadow-neo flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded border-2 border-neo-ink bg-neo-paper text-neo-ink shadow-neo-sm shrink-0">
            <History className="size-6" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-mono text-xs font-black uppercase text-foreground/60">Total Sesi</p>
            <p className="text-3xl font-black tabular-nums">{attempts.length}</p>
          </div>
        </div>

        <div className="neo-surface bg-neo-green p-4 sm:p-5 border-[3px] border-neo-ink shadow-neo text-black flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded border-2 border-neo-ink bg-white text-black shadow-neo-sm shrink-0">
            <Trophy className="size-6" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-mono text-xs font-black uppercase text-black/70">Selesai</p>
            <p className="text-3xl font-black tabular-nums">{completedAttempts}</p>
          </div>
        </div>

        <div className="neo-surface bg-neo-yellow p-4 sm:p-5 border-[3px] border-neo-ink shadow-neo text-black flex items-center gap-4 col-span-2 sm:col-span-1">
          <div className="grid size-12 place-items-center rounded border-2 border-neo-ink bg-white text-black shadow-neo-sm shrink-0">
            <Clock3 className="size-6" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-mono text-xs font-black uppercase text-black/70">In Progress</p>
            <p className="text-3xl font-black tabular-nums">{inProgressAttempts}</p>
          </div>
        </div>
      </section>

      {/* Attempts List */}
      {attempts.length === 0 ? (
        <section className="neo-surface bg-white p-8 sm:p-12 text-center border-[3px] border-neo-ink shadow-neo">
          <div className="mx-auto grid size-16 place-items-center rounded-lg border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
            <Sparkles className="size-8 text-black" strokeWidth={2.5} />
          </div>
          <h2 className="mt-4 text-2xl font-black text-neo-ink">Belum Ada Riwayat Ujian</h2>
          <p className="mt-2 text-sm font-semibold text-muted-foreground max-w-md mx-auto">
            Kamu belum pernah mengerjakan paket tes. Pilih paket ujian untuk mulai latihan atau simulasi JLPT.
          </p>
          <div className="mt-6">
            <Link href="/test-package" className="neo-button bg-neo-blue text-white font-black">
              Pilih Paket Tes Sekarang
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b-[3px] border-neo-ink pb-2">
            <span className="font-mono text-xs font-black uppercase text-foreground/70">
              DAFTAR ATTEMPT ({attempts.length})
            </span>
            <Link
              href="/test-package"
              className="font-mono text-xs font-bold text-neo-blue underline decoration-2 underline-offset-4 hover:text-neo-ink"
            >
              + Tambah Attempt Baru
            </Link>
          </div>

          <div className="space-y-4">
            {attempts.map((attempt) => {
              const levelStyle =
                LEVEL_BADGE_STYLES[attempt.testPackage.jlptLevel] || "bg-neo-blue text-white";

              return (
                <div
                  key={attempt.id}
                  className="neo-surface neo-interactive bg-white p-5 sm:p-6 border-[3px] border-neo-ink shadow-neo flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`border-2 border-neo-ink ${levelStyle} px-2.5 py-0.5 font-mono text-xs font-black shadow-neo-sm`}
                      >
                        {attempt.testPackage.jlptLevel}
                      </span>
                      <span
                        className={`border-2 border-neo-ink px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm ${
                          attempt.status === "COMPLETED"
                            ? "bg-neo-green text-black"
                            : "bg-neo-yellow text-black"
                        }`}
                      >
                        {attempt.status === "COMPLETED" ? "Selesai" : "Sedang Dikerjakan"}
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground/60 border border-neo-ink/20 bg-neo-paper px-2 py-0.5 rounded">
                        {attempt.sectionScope
                          ? `Latihan ${JLPT_SECTION_LABELS[attempt.sectionScope]}`
                          : "Mock Test Penuh"}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-neo-ink">
                      {attempt.testPackage.name}
                    </h3>

                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground/65">
                      <Calendar className="size-3.5" />
                      <span>
                        Dimulai:{" "}
                        {formatInTimeZone(attempt.startedAt, timeZone, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-3 md:pt-0 border-t-2 md:border-t-0 border-neo-ink/10">
                    {attempt.status === "COMPLETED" && (
                      <>
                        <Link
                          href={`/result/${attempt.id}`}
                          className="neo-button !min-h-9 !px-4 !py-1.5 bg-neo-blue text-white text-xs font-black"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Lihat Hasil
                        </Link>
                        <Link
                          href={`/result/${attempt.id}/detail`}
                          className="neo-button !min-h-9 !px-4 !py-1.5 bg-white text-black text-xs font-black"
                        >
                          Review Jawaban
                        </Link>
                      </>
                    )}

                    {attempt.status === "IN_PROGRESS" && (
                      <Link
                        href={`/exam/${attempt.id}/${attempt.resumeSession}`}
                        className="neo-button !min-h-9 !px-5 !py-1.5 bg-neo-yellow text-black text-xs font-black"
                      >
                        <PlayCircle className="size-3.5" />
                        Lanjutkan Ujian
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
