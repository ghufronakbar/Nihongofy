import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  History,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { getTestPackageDetail } from "@/features/test-package/actions";
import { StartAttemptActions } from "@/features/test-package/components/start-attempt-actions";
import { JLPT_SESSION_TIMING, JLPT_SECTION_LABELS } from "@/constants/jlpt";
import type { JlptLevel } from "@prisma/client";

const LEVEL_BADGE_STYLES: Record<JlptLevel, string> = {
  N5: "bg-neo-green text-black",
  N4: "bg-neo-blue text-white",
  N3: "bg-neo-yellow text-black",
  N2: "bg-neo-coral text-white",
  N1: "bg-purple-400 text-white",
};

export default async function TestPackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const testPackageId = Number(id);

  if (!Number.isInteger(testPackageId)) {
    notFound();
  }

  const { testPackage, attempts } = await getTestPackageDetail(testPackageId);

  const availableSections = Array.from(
    new Set(testPackage.testPackageItems.map((item) => item.section)),
  );

  const timing = JLPT_SESSION_TIMING[testPackage.jlptLevel];
  const levelStyle =
    LEVEL_BADGE_STYLES[testPackage.jlptLevel] || "bg-neo-blue text-white";

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Back link */}
      <div>
        <Link
          href="/test-package"
          className="neo-button bg-white text-black font-extrabold w-fit text-sm"
        >
          <ArrowLeft className="size-4" />
          Daftar Paket Ujian
        </Link>
      </div>

      {/* Hero Package Info */}
      <section className="neo-surface neo-grid-paper relative overflow-hidden bg-white p-6 sm:p-8 md:p-10 border-[3px] border-neo-ink shadow-neo-lg">
        <div
          className="absolute -top-10 -right-8 hidden size-36 rotate-12 border-[3px] border-neo-ink bg-neo-yellow shadow-neo sm:block"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`border-[3px] border-neo-ink ${levelStyle} px-3.5 py-1 font-mono text-base font-black shadow-neo-sm`}
            >
              JLPT {testPackage.jlptLevel}
            </span>
            <span className="border-2 border-neo-ink bg-neo-paper px-3 py-1 font-mono text-xs font-bold shadow-neo-sm">
              STANDAR RESMI
            </span>
          </div>

          <h1 className="mt-4 text-3xl sm:text-5xl font-black uppercase text-neo-ink leading-tight tracking-tight">
            {testPackage.name}
          </h1>

          <p className="mt-3 text-base sm:text-lg font-semibold text-foreground/75">
            Latihan ujian berstandar JLPT resmi. Kerjakan full mock test dengan durasi waktu asli atau fokus latihan pada seksi tertentu.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs font-black">
            <span className="flex items-center gap-1.5 border-2 border-neo-ink bg-white px-3 py-1.5 shadow-neo-sm">
              <BookOpen className="size-4 text-neo-blue" />
              {testPackage.testPackageItems.length} SESI UJIAN
            </span>
            <span className="flex items-center gap-1.5 border-2 border-neo-ink bg-neo-green px-3 py-1.5 shadow-neo-sm">
              <Trophy className="size-4 text-black" />
              SKALA 180 POIN
            </span>
            <span className="flex items-center gap-1.5 border-2 border-neo-ink bg-neo-yellow px-3 py-1.5 shadow-neo-sm">
              <History className="size-4 text-black" />
              {attempts.length} ATTEMPT SELESAI/BERJALAN
            </span>
          </div>
        </div>
      </section>

      {/* Official JLPT Timing */}
      <section className="neo-surface bg-neo-yellow/20 p-6 sm:p-7 border-[3px] border-neo-ink shadow-neo">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid size-10 place-items-center rounded border-2 border-neo-ink bg-neo-yellow shadow-neo-sm shrink-0">
            <Clock className="size-5 text-black" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase text-neo-ink">
              Waktu Ujian Resmi JLPT {testPackage.jlptLevel}
            </h2>
            <p className="text-xs font-semibold text-foreground/70">
              Acuan batas waktu resmi (pasang timer mandiri saat mengerjakan mock test).
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {timing.map((t) => (
            <div
              key={t.session}
              className="flex items-center justify-between border-2 border-neo-ink bg-white p-4 shadow-neo-sm rounded-lg"
            >
              <div>
                <span className="font-mono text-xs font-black text-foreground/60 uppercase">
                  SESI {t.session}
                </span>
                <p className="font-black text-sm text-neo-ink mt-0.5">{t.label}</p>
              </div>
              <span className="border-2 border-neo-ink bg-neo-paper px-3 py-1 font-mono text-sm font-black shadow-neo-sm">
                {t.durationMinutes} Menit
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Start Attempt Section */}
      <section className="neo-surface bg-white p-6 sm:p-8 border-[3px] border-neo-ink shadow-neo">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid size-10 place-items-center rounded border-2 border-neo-ink bg-neo-blue text-white shadow-neo-sm shrink-0">
            <PlayCircle className="size-5" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase text-neo-ink">Mulai Mengerjakan</h2>
            <p className="text-xs font-semibold text-foreground/70">
              Pilih mode simulasi lengkap atau latihan fokus per seksi.
            </p>
          </div>
        </div>

        {availableSections.length === 0 ? (
          <p className="text-sm font-semibold text-muted-foreground">Belum ada soal di paket ini.</p>
        ) : (
          <StartAttemptActions
            testPackageId={testPackage.id}
            availableSections={availableSections}
          />
        )}
      </section>

      {/* History of Attempts on this Package */}
      <section className="neo-surface bg-white p-6 sm:p-8 border-[3px] border-neo-ink shadow-neo">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded border-2 border-neo-ink bg-neo-green text-black shadow-neo-sm shrink-0">
              <History className="size-5" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase text-neo-ink">Riwayat Paket Ini</h2>
              <p className="text-xs font-semibold text-foreground/70">
                Attempt yang sudah pernah kamu kerjakan pada paket ini.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-black border-2 border-neo-ink bg-neo-paper px-2.5 py-1 shadow-neo-sm">
            {attempts.length} ATTEMPT
          </span>
        </div>

        {attempts.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-neo-ink/30 p-8 text-center bg-neo-paper/50">
            <p className="font-bold text-sm text-foreground/70">
              Kamu belum pernah mengerjakan paket ini. Mulai simulasi pertamamu di atas!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {attempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-neo-ink bg-white p-4 shadow-neo-sm rounded-lg hover:bg-neo-paper/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-neo-ink">
                      {attempt.sectionScope
                        ? `Latihan ${JLPT_SECTION_LABELS[attempt.sectionScope]}`
                        : "Mock Test Penuh"}
                    </span>
                    <span
                      className={`border-2 border-neo-ink px-2.5 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm ${
                        attempt.status === "COMPLETED"
                          ? "bg-neo-green text-black"
                          : "bg-neo-yellow text-black"
                      }`}
                    >
                      {attempt.status === "COMPLETED" ? "Selesai" : "Sedang Dikerjakan"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground/60">
                    <Calendar className="size-3.5" />
                    <span>
                      Mulai:{" "}
                      {new Date(attempt.startedAt).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {attempt.status === "COMPLETED" ? (
                    <>
                      <Link
                        href={`/result/${attempt.id}`}
                        className="neo-button !min-h-9 !px-3.5 !py-1.5 bg-neo-blue text-white text-xs font-black"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Hasil
                      </Link>
                      <Link
                        href={`/result/${attempt.id}/detail`}
                        className="neo-button !min-h-9 !px-3.5 !py-1.5 bg-white text-black text-xs font-black"
                      >
                        Review
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={`/exam/${attempt.id}/1`}
                      className="neo-button !min-h-9 !px-4 !py-1.5 bg-neo-yellow text-black text-xs font-black"
                    >
                      Lanjutkan <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reading Mode Option Card */}
      <section className="neo-surface bg-neo-paper p-6 sm:p-8 border-[3px] border-neo-ink shadow-neo flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <span className="neo-kicker bg-white mb-2">MODE EKSPLORASI SOAL</span>
          <h3 className="text-2xl font-black text-neo-ink">Mau mempelajari bank soal tanpa ujian?</h3>
          <p className="mt-1 text-sm font-semibold text-foreground/70 max-w-xl">
            Buka mode baca untuk melihat seluruh stimulus, pilihan jawaban, kunci jawaban, dan pembahasan secara langsung.
          </p>
        </div>
        <Link
          href={`/test-package/${testPackage.id}/questions`}
          className="neo-button bg-white text-black font-black text-sm shrink-0 hover:bg-neo-yellow"
        >
          <Eye className="size-4" />
          Lihat Semua Soal (Mode Baca)
        </Link>
      </section>
    </div>
  );
}
