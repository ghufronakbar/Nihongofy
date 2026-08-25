import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  ChartNoAxesCombined,
  Check,
  Clock3,
  Headphones,
  MessagesSquare,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { SectionIntro } from "@/components/marketing/section-intro";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Latihan JLPT yang serius dan tetap seru",
  description:
    "Kerjakan mock test JLPT, tinjau jawaban, dan pahami bagian yang perlu dilatih ulang.",
  openGraph: {
    title: "JLPT Exam | Latihan serius, tetap seru",
    description:
      "Kerjakan mock test JLPT, tinjau jawaban, dan pahami bagian yang perlu dilatih ulang.",
    type: "website",
    locale: "id_ID",
  },
};

const FEATURE_ITEMS = [
  {
    icon: Trophy,
    title: "Mock test lengkap",
    description: "Kerjakan paket ujian per sesi atau fokus pada satu seksi JLPT.",
    className: "bg-neo-blue md:col-span-2",
    status: "Tersedia",
  },
  {
    icon: BookOpenCheck,
    title: "Review mendalam",
    description: "Buka kembali jawaban, furigana, penjelasan, dan catatan pribadi.",
    className: "bg-white",
    status: "Tersedia",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Progres nyata",
    description: "Lihat tren skor dan pola kelemahan berdasarkan hasil ujianmu.",
    className: "bg-neo-yellow",
    status: "Tersedia",
  },
  {
    icon: MessagesSquare,
    title: "Partner percakapan",
    description: "Simulasi percakapan terpandu akan hadir sebagai mode preview.",
    className: "bg-neo-coral md:col-span-2",
    status: "Segera",
  },
];

const FLOW_ITEMS = [
  {
    number: "01",
    icon: Target,
    title: "Pilih target",
    description: "Mulai dari level dan paket soal yang sesuai dengan jadwal belajarmu.",
  },
  {
    number: "02",
    icon: Clock3,
    title: "Kerjakan fokus",
    description: "Jalankan mock test penuh atau latihan per seksi tanpa bocoran jawaban.",
  },
  {
    number: "03",
    icon: Check,
    title: "Bedah hasil",
    description: "Tinjau jawaban, beri catatan, lalu ulangi pola yang masih lemah.",
  },
];

export default async function HomePage() {
  const session = await getSession();

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

        <PageContainer className="grid min-h-[calc(100dvh-76px)] items-center gap-12 py-14 md:py-18 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
          <div className="relative z-10 max-w-3xl">
            <div className="neo-kicker page-reveal -rotate-1">
              Mock JLPT + review terarah
            </div>
            <h1 className="page-reveal page-reveal-delay-1 mt-7 text-[clamp(3.4rem,8vw,7.7rem)] leading-[0.88] font-black tracking-[-0.075em] text-neo-ink">
              LATIHAN JLPT.
              <span className="block text-neo-blue [text-shadow:3px_3px_0_#111]">
                SERIUS, TETAP SERU.
              </span>
            </h1>
            <p className="page-reveal page-reveal-delay-2 mt-7 max-w-[58ch] text-lg leading-8 font-semibold text-foreground/75 md:text-xl">
              Kerjakan mock test, bedah kesalahan, lalu ulangi bagian yang paling lemah.
            </p>
            <div className="page-reveal page-reveal-delay-2 mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href="/test-package" className="neo-button bg-neo-blue px-7 py-3.5 text-base">
                Mulai mock test
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
              <Link
                href={session ? "/dashboard" : "/login"}
                className="neo-button bg-white px-7 py-3.5 text-base"
              >
                {session ? "Lanjut ke dashboard" : "Masuk ke akun"}
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[32rem] pb-8 lg:pb-0" aria-label="Ilustrasi kartu latihan JLPT">
            <div className="neo-surface absolute top-7 -right-2 h-[82%] w-[88%] rotate-6 bg-neo-coral" aria-hidden="true" />
            <div className="neo-surface relative -rotate-2 overflow-hidden bg-white p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b-[3px] border-neo-ink pb-5">
                <div>
                  <p className="font-mono text-xs font-bold tracking-[0.15em] uppercase">Practice ticket</p>
                  <p lang="ja" className="font-japanese mt-1 text-3xl font-black">日本語能力試験</p>
                </div>
                <span className="border-[3px] border-neo-ink bg-neo-green px-3 py-2 font-mono text-xl font-black shadow-neo-sm">
                  N3
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-5 py-7">
                <div>
                  <p className="text-sm font-bold text-foreground/60">Sesi latihan hari ini</p>
                  <p className="mt-1 text-3xl font-black">Dokkai + Bunpou</p>
                  <div className="mt-5 flex flex-wrap gap-2 font-mono text-xs font-bold">
                    <span className="border-2 border-neo-ink bg-neo-yellow px-2.5 py-1">読解</span>
                    <span className="border-2 border-neo-ink bg-neo-blue px-2.5 py-1">文法</span>
                    <span className="border-2 border-neo-ink bg-white px-2.5 py-1">語彙</span>
                  </div>
                </div>
                <div className="grid size-24 place-items-center border-[3px] border-neo-ink bg-neo-yellow text-center shadow-neo-sm">
                  <span className="font-mono text-xs font-bold">SCORE</span>
                  <strong className="text-4xl leading-none tabular-nums">128</strong>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t-[3px] border-neo-ink text-center font-mono text-xs font-bold">
                <div className="border-r-[3px] border-neo-ink py-3">FOCUS</div>
                <div className="border-r-[3px] border-neo-ink py-3">REVIEW</div>
                <div className="py-3">REPEAT</div>
              </div>
            </div>
            <div className="neo-surface absolute -bottom-1 left-5 flex items-center gap-2 bg-neo-green px-4 py-2 font-bold sm:left-auto sm:-right-6">
              <Sparkles className="size-4" aria-hidden="true" />
              Progres yang bisa ditindaklanjuti
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="cara-belajar" className="border-b-[3px] border-neo-ink bg-white py-18 md:py-24">
        <PageContainer>
          <SectionIntro title="BUKAN SEKADAR MENGERJAKAN SOAL." className="max-w-3xl">
            <p>
              Setiap attempt menjadi bahan evaluasi. Kamu bisa kembali ke jawaban,
              memahami konteks soal, dan menyimpan catatan untuk review berikutnya.
            </p>
          </SectionIntro>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FLOW_ITEMS.map((item, index) => (
              <article
                key={item.number}
                className={`neo-surface p-6 ${index === 1 ? "md:translate-y-8 bg-neo-yellow" : index === 2 ? "bg-neo-green" : "bg-white"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-black">{item.number}</span>
                  <item.icon className="size-8" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <h3 className="mt-8 text-2xl">{item.title}</h3>
                <p className="mt-3 leading-7 text-foreground/70">{item.description}</p>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      <section id="fitur" className="border-b-[3px] border-neo-ink bg-background py-18 md:py-24">
        <PageContainer>
          <SectionIntro
            eyebrow="Ruang belajar"
            eyebrowClassName="bg-neo-coral"
            title="YANG SUDAH KUAT DIPERTAHANKAN. YANG BARU DIBANGUN BERTAHAP."
          >
            <p>
              Engine mock test tetap menjadi inti. Kana, kosakata, latihan cepat, dan partner
              percakapan akan mengikuti visual reference tanpa berpura-pura sudah production.
            </p>
          </SectionIntro>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {FEATURE_ITEMS.map((item) => (
              <article key={item.title} className={`neo-surface p-6 md:p-8 ${item.className}`}>
                <div className="flex items-start justify-between gap-5">
                  <div className="grid size-14 shrink-0 place-items-center border-[3px] border-neo-ink bg-white shadow-neo-sm">
                    <item.icon className="size-7" strokeWidth={2.5} aria-hidden="true" />
                  </div>
                  <span className="border-2 border-neo-ink bg-white px-2.5 py-1 font-mono text-xs font-bold uppercase">
                    {item.status}
                  </span>
                </div>
                <h3 className="mt-8 text-3xl">{item.title}</h3>
                <p className="mt-3 max-w-[48ch] text-base leading-7 text-foreground/75">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="border-b-[3px] border-neo-ink bg-neo-green py-16 md:py-20">
        <PageContainer className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <Headphones className="size-10" strokeWidth={2.5} aria-hidden="true" />
            <h2 className="mt-5 text-4xl leading-[0.95] font-black md:text-6xl">
              SIAP MENGUKUR KEMAMPUANMU?
            </h2>
            <p className="mt-4 max-w-[52ch] text-lg font-semibold">
              Pilih paket JLPT, kerjakan dengan fokus, lalu gunakan hasilnya untuk menentukan latihan berikutnya.
            </p>
          </div>
          <Link href="/test-package" className="neo-button w-full bg-white px-8 py-4 text-base lg:w-auto">
            Lihat paket ujian
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </PageContainer>
      </section>
    </>
  );
}
