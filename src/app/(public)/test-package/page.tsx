import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock,
  FileQuestion,
  Layers,
  Sparkles,
  Trophy,
} from "lucide-react";
import { getTestPackages } from "@/features/test-package/actions";
import { JLPT_LEVEL_ORDER } from "@/constants/jlpt";
import type { JlptLevel } from "@prisma/client";

const LEVEL_CONFIG: Record<
  JlptLevel,
  {
    color: string;
    textColor: string;
    tagline: string;
    description: string;
  }
> = {
  N5: {
    color: "bg-neo-green",
    textColor: "text-black",
    tagline: "Dasar Pemula",
    description: "Kosakata dasar, hiragana/katakana, dan kanji awal sehari-hari.",
  },
  N4: {
    color: "bg-neo-blue",
    textColor: "text-white",
    tagline: "Dasar Menengah",
    description: "Struktur kalimat percakapan dasar dan bacaan santai berkecepatan lambat.",
  },
  N3: {
    color: "bg-neo-yellow",
    textColor: "text-black",
    tagline: "Menengah (Bridge Level)",
    description: "Jembatan menuju bahasa Jepang kontekstual dan artikel surat kabar ringkas.",
  },
  N2: {
    color: "bg-neo-coral",
    textColor: "text-white",
    tagline: "Lanjutan / Bisnis",
    description: "Pemahaman artikel majalah, dialog cepat, dan pemakaian kanji tingkat kerja.",
  },
  N1: {
    color: "bg-purple-400",
    textColor: "text-white",
    tagline: "Mahir / Native-Level",
    description: "Teks abstrak, wacana akademik, dan ragam bahasa formal kompleks.",
  },
};

export default async function TestPackageListPage() {
  const testPackages = await getTestPackages();

  const grouped = JLPT_LEVEL_ORDER.map((level) => ({
    level,
    config: LEVEL_CONFIG[level],
    packages: testPackages.filter((testPackage) => testPackage.jlptLevel === level),
  })).filter((group) => group.packages.length > 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-10">
      {/* Hero Banner */}
      <section className="neo-surface neo-grid-paper relative overflow-hidden bg-neo-blue p-6 sm:p-8 md:p-10 border-[3px] border-neo-ink shadow-neo-lg text-black">
        <div
          className="absolute -top-10 -right-8 hidden size-36 rotate-12 border-[3px] border-neo-ink bg-neo-yellow shadow-neo sm:block"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-8 right-24 hidden size-24 -rotate-12 border-[3px] border-neo-ink bg-neo-coral shadow-neo md:block"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl">
          <div className="neo-kicker bg-white -rotate-1">
            <Sparkles className="size-3.5" />
            SIMULASI JLPT RESMI
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-black uppercase leading-[0.95] text-neo-ink tracking-tight">
            Paket Mock Test &
            <span className="block text-white [text-shadow:2px_2px_0_#111]">Latihan Per Seksi.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg font-semibold text-black/80">
            Pilih paket ujian sesuai level targetmu. Kerjakan simulasi penuh dengan panduan durasi resmi atau fokus latihan per seksi.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs font-black">
            <span className="border-2 border-neo-ink bg-white px-3 py-1.5 shadow-neo-sm">
              {testPackages.length} TOTAL PAKET
            </span>
            <span className="border-2 border-neo-ink bg-neo-green px-3 py-1.5 shadow-neo-sm">
              SKALA RESMI 180 POIN
            </span>
            <span className="border-2 border-neo-ink bg-neo-yellow px-3 py-1.5 shadow-neo-sm">
              MODE BACA & REVIEW
            </span>
          </div>
        </div>
      </section>

      {/* Package Groups */}
      {grouped.length === 0 ? (
        <section className="neo-surface bg-white p-8 text-center border-[3px] border-neo-ink shadow-neo">
          <Layers className="mx-auto size-12 text-muted-foreground" />
          <h2 className="mt-4 text-2xl font-black">Belum Ada Paket Tes</h2>
          <p className="mt-2 text-muted-foreground font-medium">
            Bank soal belum tersedia di sistem.
          </p>
        </section>
      ) : (
        <div className="space-y-12">
          {grouped.map((group) => (
            <section key={group.level} className="space-y-5">
              {/* Level Header Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-neo-ink pb-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`border-[3px] border-neo-ink ${group.config.color} ${group.config.textColor} px-4 py-1.5 font-mono text-2xl font-black shadow-neo-sm`}
                  >
                    {group.level}
                  </span>
                  <div>
                    <h2 className="text-xl font-black text-neo-ink">{group.config.tagline}</h2>
                    <p className="text-xs font-semibold text-foreground/65 hidden sm:block">
                      {group.config.description}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs font-black border-2 border-neo-ink bg-neo-paper px-2.5 py-1 shadow-neo-sm">
                  {group.packages.length} PAKET TERSEDIA
                </span>
              </div>

              {/* Package Grid */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {group.packages.map((testPackage) => (
                  <Link
                    key={testPackage.id}
                    href={`/test-package/${testPackage.id}`}
                    className="neo-surface neo-interactive group flex flex-col justify-between bg-white p-6 border-[3px] border-neo-ink shadow-neo"
                  >
                    <div>
                      {/* Top Accent Strip */}
                      <div
                        className={`w-full h-3.5 border-2 border-neo-ink ${group.config.color} shadow-neo-sm mb-5`}
                      />

                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="border-2 border-neo-ink bg-neo-paper px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                          JLPT {testPackage.jlptLevel}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-xs font-bold text-muted-foreground">
                          <Trophy className="size-3.5" /> 180 Poin
                        </span>
                      </div>

                      <h3 className="text-2xl font-black text-neo-ink group-hover:text-neo-blue transition-colors leading-tight">
                        {testPackage.name}
                      </h3>

                      <p className="mt-3 text-xs leading-relaxed font-semibold text-foreground/70">
                        Termasuk sesi simulasi penuh, latihan per bagian, kunci jawaban, dan pembahasan di mode baca.
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t-2 border-neo-ink/10 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-foreground/60 flex items-center gap-1">
                        <BookOpen className="size-3.5" /> Mock Exam
                      </span>
                      <span className="neo-button !min-h-9 !px-4 !py-1.5 bg-neo-yellow text-black font-black text-xs group-hover:bg-neo-blue group-hover:text-white transition-colors">
                        Buka Paket <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Info / Coming Soon Card */}
      <section className="neo-surface bg-white p-6 sm:p-8 border-[3px] border-neo-ink shadow-neo flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <span className="neo-kicker mb-2">PENGEMBANGAN BANK SOAL</span>
          <h3 className="text-2xl font-black">Mencari level atau tahun tertentu?</h3>
          <p className="mt-1 text-sm font-semibold text-foreground/70 max-w-xl">
            Bank soal terus diperbarui secara berkala dengan audio listening berkualitas tinggi dan penjelasan terstruktur.
          </p>
        </div>
        <Link href="/exercises" className="neo-button bg-neo-green text-black shrink-0 font-black">
          Coba Latihan Cepat
          <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
