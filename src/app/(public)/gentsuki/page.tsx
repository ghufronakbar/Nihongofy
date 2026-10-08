import type { Metadata } from "next";
import Image from "next/image";
import {
  Download,
  FileArchive,
  HardDriveDownload,
  Info,
  PackageOpen,
  Repeat2,
  ShieldCheck,
} from "lucide-react";
import { GentsukiShareActions } from "@/components/marketing/gentsuki-share-actions";
import { PageContainer } from "@/components/marketing/page-container";
import { JsonLd } from "@/components/seo/json-ld";
import { GENTSUKI_DECK_URL } from "@/constants";
import { breadcrumbJsonLd, learningResourceJsonLd } from "@/lib/json-ld";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export const dynamic = "force-static";

const GENTSUKI_PATH = "/gentsuki";
const DECK_FILENAME = "SIM_Gentsuki_Jepang_Lengkap_Vision.apkg";
const PAGE_DESCRIPTION =
  "Download deck Anki SIM gentsuki Jepang untuk mendampingi persiapan ujian teori. File .apkg sekitar 20 MB, bisa diunduh langsung tanpa login.";

export const metadata: Metadata = pageMetadata({
  title: "Download Deck Anki SIM Gentsuki Jepang",
  description: PAGE_DESCRIPTION,
  path: GENTSUKI_PATH,
  ogTitle: "Deck Anki Gentsuki Jepang, Siap Diunduh",
  ogDescription:
    "Bawa materi persiapan SIM gentsuki ke sesi review Anki-mu. Satu file .apkg, langsung unduh tanpa login.",
  ownSegmentImage: true,
  keywords: [
    "Anki gentsuki",
    "SIM gentsuki Jepang",
    "ujian gentsuki Jepang",
    "deck Anki Jepang",
    "原付免許",
  ],
});

const DOWNLOAD_FACTS = [
  {
    icon: FileArchive,
    label: "Format",
    value: "File .apkg",
  },
  {
    icon: HardDriveDownload,
    label: "Ukuran",
    value: "Sekitar 20 MB",
  },
  {
    icon: ShieldCheck,
    label: "Akses",
    value: "Langsung, tanpa login",
  },
] as const;

const IMPORT_FLOW = [
  {
    icon: Download,
    title: "Unduh file deck",
    description: "Tekan tombol unduh dan simpan file .apkg ke perangkatmu.",
  },
  {
    icon: PackageOpen,
    title: "Impor ke Anki",
    description: "Buka file yang selesai diunduh melalui aplikasi Anki yang kamu gunakan.",
  },
  {
    icon: Repeat2,
    title: "Mulai sesi review",
    description: "Ikuti antrean kartu dan ulangi secara rutin sesuai ritme belajarmu.",
  },
] as const;

export default function GentsukiPage() {
  return (
    <>
      <JsonLd
        data={[
          learningResourceJsonLd({
            path: GENTSUKI_PATH,
            name: "Deck Anki SIM Gentsuki Jepang",
            description: PAGE_DESCRIPTION,
            resourceType: "Flashcard deck",
            educationalLevel: "Persiapan ujian SIM gentsuki Jepang",
          }),
          breadcrumbJsonLd([
            { name: "Beranda", path: "/" },
            { name: "Deck Anki Gentsuki", path: GENTSUKI_PATH },
          ]),
        ]}
      />

      <section className="neo-grid-paper relative overflow-hidden border-b-[3px] border-neo-ink">
        <div
          className="absolute -top-12 right-[4%] hidden size-32 rotate-6 border-[3px] border-neo-ink bg-neo-yellow shadow-neo-lg lg:block"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-14 left-[2%] hidden size-20 -rotate-12 border-[3px] border-neo-ink bg-neo-blue shadow-neo lg:block"
          aria-hidden="true"
        />

        <PageContainer className="grid min-h-[calc(100dvh-76px)] items-center gap-12 py-12 md:py-16 lg:grid-cols-[1.02fr_0.98fr] lg:py-18">
          <div className="relative z-10 max-w-3xl">
            <div className="neo-kicker page-reveal -rotate-1">Deck Anki Gentsuki</div>
            <h1 className="page-reveal page-reveal-delay-1 mt-7 text-[clamp(3rem,6.3vw,6.2rem)] leading-[0.9] font-black tracking-[-0.07em] text-neo-ink">
              SIAP UJIAN.
              <span className="block text-neo-blue [text-shadow:3px_3px_0_#111]">
                PAKAI ANKI.
              </span>
            </h1>
            <p className="page-reveal page-reveal-delay-2 mt-7 max-w-[52ch] text-lg leading-8 font-semibold text-foreground/75 md:text-xl">
              Unduh deck Anki untuk mendampingi persiapan ujian SIM gentsuki di Jepang, lalu belajar
              kapan saja.
            </p>
            <div className="page-reveal page-reveal-delay-2 mt-8">
              <a
                href={GENTSUKI_DECK_URL}
                download={DECK_FILENAME}
                className="neo-button bg-neo-blue px-7 py-3.5 text-base"
                aria-describedby="deck-download-details"
              >
                <Download className="size-5" strokeWidth={2.5} aria-hidden="true" />
                Unduh deck Anki
              </a>
            </div>
          </div>

          <figure className="page-reveal page-reveal-delay-2 relative mx-auto w-full max-w-[35rem] pb-7">
            <div
              className="absolute top-5 -right-2 h-[88%] w-[92%] rotate-3 border-[3px] border-neo-ink bg-neo-yellow shadow-neo-lg"
              aria-hidden="true"
            />
            <div className="neo-surface relative overflow-hidden bg-white p-3 sm:p-4">
              <div className="relative aspect-[4/3] overflow-hidden border-[3px] border-neo-ink bg-slate-200 lg:aspect-[5/4]">
                <Image
                  src="/gentsuki/gentsuki-hero.webp"
                  alt="Skuter kecil di lintasan latihan berkendara Jepang"
                  fill
                  priority
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="object-cover object-[58%_center]"
                />
              </div>
              <figcaption
                id="deck-download-details"
                className="grid gap-2 px-1 pt-4 font-mono text-xs font-bold text-neo-ink sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <span className="break-all sm:break-normal">{DECK_FILENAME}</span>
                <span>Sekitar 20 MB</span>
              </figcaption>
            </div>
          </figure>
        </PageContainer>
      </section>

      <section className="border-b-[3px] border-neo-ink bg-neo-yellow" aria-label="Rincian unduhan">
        <PageContainer className="grid sm:grid-cols-3">
          {DOWNLOAD_FACTS.map((fact, index) => (
            <div
              key={fact.label}
              className={`flex items-center gap-4 py-6 sm:px-6 ${index < DOWNLOAD_FACTS.length - 1 ? "border-b-[3px] border-neo-ink sm:border-r-[3px] sm:border-b-0" : ""}`}
            >
              <span className="grid size-12 shrink-0 place-items-center border-[3px] border-neo-ink bg-white shadow-neo-sm">
                <fact.icon className="size-6" strokeWidth={2.5} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-mono text-xs font-bold tracking-[0.1em] uppercase text-neo-ink/65">
                  {fact.label}
                </span>
                <strong className="mt-1 block text-lg text-neo-ink">{fact.value}</strong>
              </span>
            </div>
          ))}
        </PageContainer>
      </section>

      <section className="border-b-[3px] border-neo-ink bg-white py-18 dark:bg-card md:py-24">
        <PageContainer className="grid items-start gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <div className="neo-surface relative overflow-hidden bg-neo-blue p-8 text-neo-ink lg:sticky lg:top-28 lg:p-10">
            <div className="absolute -right-8 -bottom-16 font-japanese text-[14rem] leading-none font-black text-white/20" aria-hidden="true">
              付
            </div>
            <p lang="ja" className="font-japanese relative text-[clamp(5rem,12vw,9rem)] leading-none font-black">
              原付
            </p>
            <p className="relative mt-8 max-w-[24ch] text-2xl leading-tight font-black">
              Satu file untuk sesi belajar yang bisa kamu bawa ke mana saja.
            </p>
          </div>

          <div>
            <h2 className="max-w-[12ch] text-4xl leading-[0.95] font-black text-foreground md:text-6xl">
              DARI FILE KE SESI REVIEW.
            </h2>
            <p className="mt-6 max-w-[58ch] text-lg leading-8 text-foreground/70">
              Tidak ada akun tambahan atau proses impor khusus. Gunakan alur Anki yang sudah kamu
              kenal.
            </p>

            <div className="mt-10 grid gap-7">
              {IMPORT_FLOW.map((item) => (
                <div key={item.title} className="grid gap-5 border-t-[3px] border-neo-ink pt-7 sm:grid-cols-[auto_1fr]">
                  <span className="grid size-14 place-items-center border-[3px] border-neo-ink bg-neo-yellow text-neo-ink shadow-neo-sm">
                    <item.icon className="size-7" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-2xl text-foreground">{item.title}</h3>
                    <p className="mt-2 max-w-[52ch] leading-7 text-foreground/70">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <aside className="neo-surface mt-10 grid gap-4 bg-neo-yellow p-6 text-neo-ink sm:grid-cols-[auto_1fr]">
              <Info className="size-7" strokeWidth={2.5} aria-hidden="true" />
              <div>
                <h3 className="text-xl">Materi belajar mandiri</h3>
                <p className="mt-2 leading-7 text-neo-ink/75">
                  Deck ini bukan materi resmi lembaga ujian Jepang. Selalu cocokkan informasi penting
                  dengan sumber resmi terbaru.
                </p>
              </div>
            </aside>
          </div>
        </PageContainer>
      </section>

      <section id="bagikan" className="border-b-[3px] border-neo-ink bg-neo-blue py-18 text-neo-ink md:py-24">
        <PageContainer className="grid items-end gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
          <div>
            <h2 className="max-w-[15ch] text-4xl leading-[0.95] font-black md:text-6xl">
              PUNYA TEMAN YANG JUGA MENGEJAR SIM DI JEPANG?
            </h2>
            <p className="mt-6 max-w-[54ch] text-lg leading-8 font-semibold text-neo-ink/70">
              Bagikan halaman ini supaya deck-nya mudah ditemukan saat mereka siap mulai belajar.
            </p>
          </div>
          <GentsukiShareActions pageUrl={absoluteUrl(GENTSUKI_PATH)} />
        </PageContainer>
      </section>
    </>
  );
}
