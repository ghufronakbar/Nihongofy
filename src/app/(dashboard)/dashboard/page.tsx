import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Languages,
  Sparkles,
  Trophy,
} from "lucide-react";
import { getDashboardSummary } from "@/features/dashboard/actions";
import { formatInTimeZone } from "@/lib/time-zone";
import { getCurrentUserTimeZone } from "@/lib/user-time-zone";
import { JLPT_SECTION_LABELS } from "@/constants/jlpt";

export default async function DashboardPage() {
  const [{ lastAttempt, completedCount }, timeZone] = await Promise.all([
    getDashboardSummary(),
    getCurrentUserTimeZone(),
  ]);

  const QUICK_MODES = [
    {
      title: "Kana Lab",
      subtitle: "Hiragana & Katakana",
      desc: "Latih pengenalan huruf Jepang dengan flashcard interaktif dan audio.",
      href: "/kana/hiragana",
      icon: Languages,
      color: "bg-neo-blue",
      badge: "KANA",
    },
    {
      title: "Vocabulary Deck",
      subtitle: "N5 - N1 Decks",
      desc: "Kuasai ribuan kosakata dengan reading kanji, arti, dan antrean SRS.",
      href: "/vocab",
      icon: Brain,
      color: "bg-neo-coral",
      badge: "KOSAKATA",
    },
    {
      title: "Latihan Cepat",
      subtitle: "Instant Feedback",
      desc: "Kerjakan 5-20 soal tanpa timer dengan pembahasan langsung.",
      href: "/exercises",
      icon: Sparkles,
      color: "bg-neo-yellow",
      badge: "LATIHAN",
    },
    {
      title: "Mock Test Penuh",
      subtitle: "Simulasi Resmi",
      desc: "Ujian simulasi lengkap sesuai format durasi dan seksi JLPT asli.",
      href: "/test-package",
      icon: BookOpen,
      color: "bg-neo-green",
      badge: "UJIAN",
    },
  ];

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Hero Banner */}
      <section className="neo-surface neo-grid-paper relative overflow-hidden bg-white p-6 sm:p-8 md:p-10 border-[3px] border-neo-ink shadow-neo-lg">
        <div
          className="absolute -top-10 -right-8 hidden size-36 rotate-12 border-[3px] border-neo-ink bg-neo-coral shadow-neo sm:block"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-8 right-32 hidden size-20 -rotate-12 border-[3px] border-neo-ink bg-neo-yellow shadow-neo md:block"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl">
          <div className="neo-kicker -rotate-1">DASHBOARD / 学習管理</div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-black uppercase leading-[0.95] text-neo-ink tracking-tight">
            Latihan Terarah.
            <span className="block text-neo-blue [text-shadow:2px_2px_0_#111]">
              Pantau Progresmu.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg font-semibold text-foreground/75">
            Mulai dari paket ujian baru, tuntaskan antrean vocabulary, atau bedah kelemahan dari attempt sebelumnya.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/test-package" className="neo-button bg-neo-blue text-white px-6 py-3">
              Pilih Paket Ujian
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/history" className="neo-button bg-white text-black px-6 py-3">
              Lihat Riwayat
            </Link>
          </div>
        </div>
      </section>

      {/* KPI Overview Cards */}
      <section className="grid gap-5 sm:grid-cols-2">
        {/* Total Attempt Selesai */}
        <div className="neo-surface bg-neo-green p-6 text-black border-[3px] border-neo-ink shadow-neo flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block border-2 border-neo-ink bg-white px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm">
                TOTAL SELESAI
              </span>
              <h2 className="mt-2 text-xl font-black">Attempt Mock Test</h2>
            </div>
            <div className="grid size-12 place-items-center border-2 border-neo-ink bg-white shadow-neo-sm shrink-0">
              <Trophy className="size-6 text-black" strokeWidth={2.5} />
            </div>
          </div>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-6xl sm:text-7xl font-black tabular-nums tracking-tight">
              {completedCount}
            </span>
            <span className="font-bold text-sm text-black/75">sesi ujian diselesaikan</span>
          </div>
        </div>

        {/* Attempt Terakhir */}
        <div className="neo-surface bg-neo-yellow p-6 text-black border-[3px] border-neo-ink shadow-neo flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-block border-2 border-neo-ink bg-white px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm">
                ATTEMPT TERAKHIR
              </span>
              {lastAttempt && (
                <span className="border-2 border-neo-ink bg-neo-blue text-white px-2 py-0.5 font-mono text-xs font-black shadow-neo-sm">
                  {lastAttempt.testPackage.jlptLevel}
                </span>
              )}
            </div>

            {lastAttempt ? (
              <div className="mt-4 space-y-1">
                <h3 className="text-2xl font-black line-clamp-1">{lastAttempt.testPackage.name}</h3>
                <div className="flex items-center gap-2 text-sm font-bold text-black/75">
                  <Calendar className="size-4" />
                  <span>
                    {lastAttempt.sectionScope
                      ? `Latihan ${JLPT_SECTION_LABELS[lastAttempt.sectionScope]}`
                      : "Mock Test Penuh"}
                    {lastAttempt.finishedAt
                      ? ` · ${formatInTimeZone(lastAttempt.finishedAt, timeZone, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : ""}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-lg font-black">Belum Ada Sesi Ujian</p>
                <p className="text-sm font-semibold text-black/70">
                  Kamu belum menyelesaikan mock test. Mulai paket pertama sekarang!
                </p>
              </div>
            )}
          </div>

          <div className="mt-6">
            <Link
              href={lastAttempt ? `/result/${lastAttempt.id}` : "/test-package"}
              className="neo-button w-full sm:w-fit bg-white text-black font-extrabold"
            >
              {lastAttempt ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Lihat Hasil Ujian
                </>
              ) : (
                <>
                  Mulai Latihan
                  <ArrowRight className="size-4" />
                </>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* Learning Hub Bento Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-xs font-black tracking-widest uppercase text-foreground/70">
              MODUL BELAJAR
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase">Pusat Latihan</h2>
          </div>
          <Link
            href="/test-package"
            className="hidden sm:inline-flex items-center gap-1.5 font-bold text-sm underline decoration-2 underline-offset-4 hover:text-neo-blue"
          >
            Lihat Semua Paket <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_MODES.map((mode) => (
            <Link
              key={mode.title}
              href={mode.href}
              className="neo-surface neo-interactive group flex flex-col justify-between bg-white p-5 border-[3px] border-neo-ink shadow-neo"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`grid size-12 place-items-center rounded-md border-2 border-neo-ink ${mode.color} shadow-neo-sm shrink-0`}
                  >
                    <mode.icon className="size-6 text-black" strokeWidth={2.5} />
                  </div>
                  <span className="border-2 border-neo-ink bg-neo-paper px-2 py-0.5 font-mono text-xs font-black shadow-neo-sm">
                    {mode.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-black group-hover:text-neo-blue transition-colors">
                  {mode.title}
                </h3>
                <p className="mt-1 text-xs font-bold text-muted-foreground">{mode.subtitle}</p>
                <p className="mt-2 text-xs leading-relaxed text-foreground/70 font-semibold">
                  {mode.desc}
                </p>
              </div>

              <div className="mt-5 flex items-center gap-1 text-xs font-black text-neo-ink group-hover:translate-x-1 transition-transform">
                Buka Modul <ArrowRight className="size-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
