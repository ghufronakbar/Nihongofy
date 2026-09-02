import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  BookOpenText,
  ChartNoAxesCombined,
  Check,
  Clock3,
  Languages,
  MessageSquareText,
  Mic2,
  NotebookTabs,
  PenLine,
  Sparkles,
  Target,
  Trophy,
  Volume2,
} from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { SectionIntro } from "@/components/marketing/section-intro";
import { ArticleCard } from "@/features/article/components/article-card";
import { getArticleIndexData } from "@/features/article/queries";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Tanoshii Japanese | Belajar Bahasa Jepang & Simulasi JLPT",
  description:
    "Platform belajar bahasa Jepang dan persiapan JLPT (N5 - N1) yang interaktif, terarah, dan menyenangkan. Lengkap dengan latihan Kana, kosakata, latihan cepat, dan mock test resmi.",
  openGraph: {
    title: "Tanoshii Japanese | Belajar Bahasa Jepang & Latihan JLPT Seru",
    description:
      "Platform belajar bahasa Jepang dan persiapan JLPT (N5 - N1) lengkap dengan review mendalam dan analitik progres.",
    type: "website",
    locale: "id_ID",
  },
};

const LEARNING_FLOW = [
  {
    icon: Target,
    title: "Pilih target",
    description: "Mulai dari level dan paket soal yang sesuai dengan fokus belajarmu.",
    color: "bg-white",
  },
  {
    icon: Clock3,
    title: "Kerjakan fokus",
    description: "Jalankan mock test penuh atau latihan per seksi tanpa bocoran jawaban.",
    color: "bg-neo-yellow",
  },
  {
    icon: Check,
    title: "Bedah hasil",
    description: "Tinjau jawaban, simpan catatan, lalu ulangi pola yang masih lemah.",
    color: "bg-neo-green",
  },
];

function FeatureStatus({ children, available = false }: { children: React.ReactNode; available?: boolean }) {
  return (
    <span
      className={`border-2 border-neo-ink px-2.5 py-1 font-mono text-xs font-bold uppercase ${available ? "bg-neo-green" : "bg-white"}`}
    >
      {children}
    </span>
  );
}

export default async function HomePage() {
  const [session, articleIndex] = await Promise.all([getSession(), getArticleIndexData()]);
  const isAuthenticated = Boolean(session);

  return (
    <>
      <section className="neo-grid-paper relative overflow-hidden border-b-[3px] border-neo-ink">
        <div
          className="absolute -top-14 right-[8%] hidden size-36 rotate-12 border-[3px] border-neo-ink bg-neo-coral shadow-neo-lg lg:block"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-12 left-[3%] hidden size-24 -rotate-12 border-[3px] border-neo-ink bg-neo-yellow shadow-neo lg:block"
          aria-hidden="true"
        />

        <PageContainer className="grid min-h-[calc(100dvh-76px)] items-center gap-12 py-12 md:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-18">
          <div className="relative z-10 max-w-3xl">
            <div className="neo-kicker page-reveal -rotate-1">Mock JLPT + review terarah</div>
            <h1 className="page-reveal page-reveal-delay-1 mt-7 text-[clamp(3.2rem,7.5vw,7rem)] leading-[0.88] font-black tracking-[-0.075em] text-neo-ink">
              LATIHAN JLPT.
              <span className="block text-neo-blue [text-shadow:3px_3px_0_#111]">
                SERIUS, TETAP SERU.
              </span>
            </h1>
            <p className="page-reveal page-reveal-delay-2 mt-7 max-w-[55ch] text-lg leading-8 font-semibold text-foreground/75 md:text-xl">
              Kerjakan mock test, bedah kesalahan, lalu ulangi bagian yang paling lemah.
            </p>
            <div className="page-reveal page-reveal-delay-2 mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href={isAuthenticated ? "/dashboard" : "/register"}
                className="neo-button bg-neo-blue px-7 py-3.5 text-base"
              >
                {isAuthenticated ? "Lanjut ke dashboard" : "Buat akun"}
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
              <Link
                href={isAuthenticated ? "/test-package" : "/login"}
                className="neo-button bg-white px-7 py-3.5 text-base"
              >
                {isAuthenticated ? "Pilih mock test" : "Masuk ke akun"}
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[32rem] pb-8 lg:pb-0" aria-label="Preview alur review JLPT">
            <div className="neo-surface absolute top-7 -right-2 h-[82%] w-[88%] rotate-6 bg-neo-coral" aria-hidden="true" />
            <div className="neo-surface relative -rotate-2 overflow-hidden bg-white p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b-[3px] border-neo-ink pb-5">
                <div>
                  <p className="font-mono text-xs font-bold tracking-[0.15em] uppercase">Contoh alur review</p>
                  <p lang="ja" className="font-japanese mt-1 text-3xl font-black">日本語能力試験</p>
                </div>
                <span className="border-[3px] border-neo-ink bg-neo-green px-3 py-2 font-mono text-xl font-black shadow-neo-sm">
                  N3
                </span>
              </div>
              <div className="grid gap-5 py-7 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-sm font-bold text-foreground/60">Fokus latihan</p>
                  <p className="mt-1 text-3xl font-black">Dokkai + Bunpou</p>
                  <div className="mt-5 flex flex-wrap gap-2 font-mono text-xs font-bold">
                    <span className="border-2 border-neo-ink bg-neo-yellow px-2.5 py-1">読解</span>
                    <span className="border-2 border-neo-ink bg-neo-blue px-2.5 py-1">文法</span>
                    <span className="border-2 border-neo-ink bg-white px-2.5 py-1">語彙</span>
                  </div>
                </div>
                <div className="grid min-h-24 min-w-24 place-items-center border-[3px] border-neo-ink bg-neo-yellow p-3 text-center shadow-neo-sm">
                  <ChartNoAxesCombined className="size-8" strokeWidth={2.5} aria-hidden="true" />
                  <strong className="text-sm leading-tight">LIHAT POLA</strong>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t-[3px] border-neo-ink text-center font-mono text-xs font-bold">
                <div className="border-r-[3px] border-neo-ink py-3">FOKUS</div>
                <div className="border-r-[3px] border-neo-ink py-3">REVIEW</div>
                <div className="py-3">ULANGI</div>
              </div>
            </div>
            <div className="neo-surface absolute -bottom-1 left-5 flex items-center gap-2 bg-neo-green px-4 py-2 font-bold sm:left-auto sm:-right-6">
              <Sparkles className="size-4" aria-hidden="true" />
              Hasil yang bisa ditindaklanjuti
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="cara-belajar" className="border-b-[3px] border-neo-ink bg-white py-18 md:py-24">
        <PageContainer className="grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-28">
            <h2 className="text-4xl leading-[0.95] font-black md:text-6xl">
              BUKAN SEKADAR MENGERJAKAN SOAL.
            </h2>
            <p className="mt-6 max-w-[55ch] text-lg leading-8 text-foreground/70">
              Setiap attempt menjadi bahan evaluasi yang bisa kamu buka dan catat kembali.
            </p>
            <div className="neo-surface mt-9 -rotate-2 overflow-hidden bg-neo-blue p-7 text-center">
              <p lang="ja" className="font-japanese text-8xl leading-none font-black text-white/45 sm:text-9xl">
                学
              </p>
              <p className="-mt-5 text-xl font-black">Belajar berarti melihat pola, bukan menebak.</p>
            </div>
          </div>

          <div className="grid gap-5">
            {LEARNING_FLOW.map((item, index) => (
              <article
                key={item.title}
                className={`neo-surface grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:items-center ${item.color} ${index === 1 ? "sm:-translate-x-5" : index === 2 ? "sm:translate-x-3" : ""}`}
              >
                <div className="grid size-14 place-items-center border-[3px] border-neo-ink bg-white shadow-neo-sm">
                  <item.icon className="size-7" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-2xl">{item.title}</h3>
                  <p className="mt-2 leading-7 text-foreground/70">{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      <section id="fitur" className="border-b-[3px] border-neo-ink bg-background py-18 md:py-24">
        <PageContainer>
          <SectionIntro title="SATU RUANG UNTUK EMPAT CARA BELAJAR.">
            <p>
              Kana, kosakata, latihan cepat, dan mock JLPT sudah aktif dengan progres yang tersimpan di akunmu.
            </p>
          </SectionIntro>

          <div className="mt-12 grid gap-6 md:grid-cols-12">
            <article className="neo-surface overflow-hidden bg-neo-blue p-6 md:col-span-5 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <Languages className="size-10" strokeWidth={2.5} aria-hidden="true" />
                <FeatureStatus available>Tersedia</FeatureStatus>
              </div>
              <h3 className="mt-8 text-3xl">Kana interaktif</h3>
              <p className="mt-3 max-w-[38ch] leading-7 text-neo-ink/75">
                Hiragana dan katakana dengan flip card, romaji, variasi bunyi, dan fallback audio.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-3" aria-label="Contoh kartu kana">
                {["あ", "か", "さ", "た", "な", "は"].map((kana, index) => (
                  <span
                    key={kana}
                    lang="ja"
                    className={`font-japanese grid aspect-square place-items-center border-[3px] border-neo-ink text-3xl font-black shadow-neo-sm ${index === 4 ? "bg-neo-yellow" : "bg-white"}`}
                  >
                    {kana}
                  </span>
                ))}
              </div>
              <Link href="/kana/hiragana" className="neo-button mt-7 bg-white px-5 py-3">
                Buka hiragana
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </article>

            <article className="neo-surface bg-neo-coral p-6 md:col-span-7 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <BookOpenText className="size-10" strokeWidth={2.5} aria-hidden="true" />
                <FeatureStatus available>Tersedia</FeatureStatus>
              </div>
              <div className="mt-8 grid items-end gap-7 sm:grid-cols-[1fr_0.9fr]">
                <div>
                  <h3 className="text-3xl">Paket kosakata</h3>
                  <p className="mt-3 max-w-[38ch] leading-7 text-neo-ink/75">
                    Deck per level dengan reading, arti, contoh penggunaan, dan antrean review.
                  </p>
                </div>
                <div className="neo-surface rotate-2 bg-white p-5 text-center">
                  <p lang="ja" className="font-japanese text-5xl font-black">準備</p>
                  <p className="mt-2 font-mono text-sm font-bold">じゅんび / persiapan</p>
                  <div className="mt-4 flex items-center justify-center gap-2 border-t-2 border-neo-ink pt-3 text-xs font-bold">
                    <Volume2 className="size-4" aria-hidden="true" />
                    Dengar dan ulangi
                  </div>
                </div>
              </div>
              <Link href="/vocab" className="neo-button mt-7 bg-white px-5 py-3 sm:w-fit">
                Buka vocabulary
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </article>

            <article className="neo-surface bg-neo-yellow p-6 md:col-span-7 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <PenLine className="size-10" strokeWidth={2.5} aria-hidden="true" />
                <FeatureStatus available>Tersedia</FeatureStatus>
              </div>
              <div className="mt-8 grid gap-7 sm:grid-cols-[0.9fr_1.1fr] sm:items-center">
                <div>
                  <h3 className="text-3xl">Latihan cepat</h3>
                  <p className="mt-3 max-w-[38ch] leading-7 text-neo-ink/75">
                    Satu soal per langkah dengan feedback langsung, terpisah dari skor mock resmi.
                  </p>
                </div>
                <div className="border-[3px] border-neo-ink bg-white p-5 shadow-neo-sm">
                  <p className="text-sm font-extrabold">Pilih arti yang tepat</p>
                  <p lang="ja" className="font-japanese mt-3 text-3xl font-black">新しい</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold">
                    <span className="border-2 border-neo-ink bg-neo-green px-3 py-2">baru</span>
                    <span className="border-2 border-neo-ink px-3 py-2">lama</span>
                  </div>
                </div>
              </div>
              <Link href="/exercises" className="neo-button mt-7 bg-white px-5 py-3 sm:w-fit">
                Mulai latihan cepat
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </article>

            <article className="neo-surface flex flex-col bg-neo-green p-6 md:col-span-5 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <Trophy className="size-10" strokeWidth={2.5} aria-hidden="true" />
                <FeatureStatus available>Tersedia</FeatureStatus>
              </div>
              <h3 className="mt-8 text-3xl">Mock JLPT lengkap</h3>
              <p className="mt-3 leading-7 text-neo-ink/75">
                Paket soal per sesi atau per seksi, history attempt, review, catatan, dan analitik.
              </p>
              <Link href="/test-package" className="neo-button mt-8 bg-white px-6 py-3 sm:self-start">
                Buka paket ujian
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </article>
          </div>
        </PageContainer>
      </section>

      <section className="border-b-[3px] border-neo-ink bg-neo-blue py-18 md:py-24">
        <PageContainer className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <FeatureStatus>Preview</FeatureStatus>
            <MessageSquareText className="mt-8 size-12" strokeWidth={2.5} aria-hidden="true" />
            <h2 className="mt-5 text-4xl leading-[0.95] font-black md:text-6xl">
              LATIH PERCAKAPAN TANPA TAKUT SALAH.
            </h2>
            <p className="mt-5 max-w-[55ch] text-lg leading-8 font-semibold text-neo-ink/75">
              Preview ini menunjukkan arah setup karakter, tingkat kesulitan, topik, romaji, dan history chat.
            </p>
            <div className="mt-7 border-[3px] border-neo-ink bg-white px-4 py-3 font-bold shadow-neo-sm sm:w-fit">
              Simulasi percakapan belum memakai provider AI production.
            </div>
          </div>

          <div className="relative pb-8 sm:px-8" aria-label="Preview percakapan terpandu">
            <div className="neo-surface ml-auto max-w-md bg-white p-5 sm:p-6">
              <div className="flex items-center gap-4 border-b-[3px] border-neo-ink pb-4">
                <div className="grid size-14 place-items-center border-[3px] border-neo-ink bg-neo-yellow text-2xl font-black shadow-neo-sm">
                  会
                </div>
                <div>
                  <p className="font-black">Partner belajar</p>
                  <p className="text-sm font-semibold text-foreground/60">Topik: perkenalan</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div className="mr-12 border-[3px] border-neo-ink bg-background p-4 shadow-neo-sm">
                  <p lang="ja" className="font-japanese font-bold">はじめまして。お名前は何ですか。</p>
                  <p className="mt-1 text-sm text-foreground/65">Senang berkenalan. Siapa namamu?</p>
                </div>
                <div className="ml-12 border-[3px] border-neo-ink bg-neo-green p-4 text-right shadow-neo-sm">
                  <p lang="ja" className="font-japanese font-bold">わたしはランスです。</p>
                  <p className="mt-1 text-sm text-foreground/65">Saya Lans.</p>
                </div>
              </div>
            </div>
            <div className="neo-surface absolute right-0 bottom-0 flex items-center gap-2 bg-neo-yellow px-4 py-3 font-bold sm:right-3">
              <AudioLines className="size-5" aria-hidden="true" />
              TTS dengan fallback
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="border-b-[3px] border-neo-ink bg-neo-coral py-18 md:py-24">
        <PageContainer className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative order-2 lg:order-1" aria-label="Preview latihan speaking">
            <div className="neo-surface overflow-hidden bg-white p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4 border-b-[3px] border-neo-ink pb-5">
                <div>
                  <p className="font-black">Latihan pengucapan</p>
                  <p className="text-sm font-semibold text-foreground/60">Mode capability-aware</p>
                </div>
                <Mic2 className="size-9" strokeWidth={2.5} aria-hidden="true" />
              </div>
              <div className="grid min-h-48 place-items-center py-8 text-center">
                <div>
                  <div className="mx-auto flex h-16 items-center justify-center gap-1" aria-hidden="true">
                    {["h-7", "h-12", "h-16", "h-10", "h-14", "h-13", "h-8", "h-15", "h-11"].map((heightClass, index) => (
                      <span
                        key={`${heightClass}-${index}`}
                        className={`w-2 border-2 border-neo-ink bg-neo-blue ${heightClass}`}
                      />
                    ))}
                  </div>
                  <p lang="ja" className="font-japanese mt-6 text-3xl font-black">よろしくお願いします</p>
                  <p className="mt-2 font-semibold text-foreground/65">Mohon kerja samanya.</p>
                </div>
              </div>
              <div className="border-[3px] border-neo-ink bg-neo-yellow p-3 text-sm font-bold">
                Jika speech recognition tidak tersedia, input teks menjadi fallback.
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <FeatureStatus>Preview</FeatureStatus>
            <Mic2 className="mt-8 size-12" strokeWidth={2.5} aria-hidden="true" />
            <h2 className="mt-5 text-4xl leading-[0.95] font-black md:text-6xl">
              SUARA, TRANSKRIP, DAN FEEDBACK YANG JUJUR.
            </h2>
            <p className="mt-5 max-w-[55ch] text-lg leading-8 font-semibold text-neo-ink/75">
              Speaking akan memeriksa dukungan browser, izin mikrofon, serta menyediakan typed transcript bila dibutuhkan.
            </p>
            <div className="mt-7 border-[3px] border-neo-ink bg-white px-4 py-3 font-bold shadow-neo-sm sm:w-fit">
              Tidak ada rekaman atau transkripsi palsu pada preview ini.
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="neo-grid-paper border-b-[3px] border-neo-ink py-18 md:py-24">
        <PageContainer>
          <SectionIntro
            title={articleIndex.featured ? "BACA SATU HAL. COBA HARI INI." : "ARTIKEL AKAN HADIR SAAT KONTENNYA SIAP."}
          >
            <p>
              {articleIndex.featured
                ? "Panduan singkat menghubungkan konsep bahasa Jepang dengan latihan yang tersedia di akunmu."
                : "Area artikel tetap empty-safe agar home berguna tanpa mengarang penulis atau konten."}
            </p>
          </SectionIntro>

          {articleIndex.featured ? (
            <div className="mt-12">
              <ArticleCard article={articleIndex.featured} variant="featured" />
            </div>
          ) : (
            <div className="neo-surface mt-12 grid items-center gap-7 bg-white p-6 sm:p-8 md:grid-cols-[auto_1fr_auto]">
              <div className="grid size-16 place-items-center border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
                <NotebookTabs className="size-8" strokeWidth={2.5} aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-2xl">Belum ada artikel yang diterbitkan</h3>
                <p className="mt-2 max-w-[60ch] leading-7 text-foreground/70">
                  Mock test dan alat belajar lain tetap dapat dipakai sambil menunggu konten pertama.
                </p>
              </div>
              <span className="border-[3px] border-neo-ink bg-background px-4 py-3 text-center font-mono text-sm font-bold shadow-neo-sm">
                EMPTY STATE SIAP
              </span>
            </div>
          )}
        </PageContainer>
      </section>

      <section className="border-b-[3px] border-neo-ink bg-neo-green py-16 md:py-20">
        <PageContainer className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <Trophy className="size-10" strokeWidth={2.5} aria-hidden="true" />
            <h2 className="mt-5 text-4xl leading-[0.95] font-black md:text-6xl">
              {isAuthenticated ? "LANJUTKAN DARI HASIL TERAKHIRMU." : "MULAI DENGAN SATU ATTEMPT."}
            </h2>
            <p className="mt-4 max-w-[52ch] text-lg font-semibold">
              {isAuthenticated
                ? "Buka dashboard atau pilih paket JLPT berikutnya tanpa kehilangan history belajarmu."
                : "Buat akun untuk menyimpan history, review jawaban, catatan, dan progres milikmu sendiri."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href={isAuthenticated ? "/dashboard" : "/register"}
              className="neo-button w-full bg-white px-8 py-4 text-base lg:w-auto"
            >
              {isAuthenticated ? "Buka dashboard" : "Buat akun"}
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <Link
              href={isAuthenticated ? "/test-package" : "/login"}
              className="neo-button w-full bg-neo-yellow px-8 py-4 text-base lg:w-auto"
            >
              {isAuthenticated ? "Pilih paket ujian" : "Sudah punya akun"}
            </Link>
          </div>
        </PageContainer>
      </section>
    </>
  );
}
