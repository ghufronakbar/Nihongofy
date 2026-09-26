import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { getReportFormContextAction } from "@/features/report/actions";
import { ReportForm } from "@/features/report/components/report-form";
import { pageMetadata } from "@/lib/seo";

// noindex: form yang dapat dikirim tanpa akun dan mudah ditemukan dari pencarian
// akan menarik bot. `follow` supaya tautan di dalamnya tetap ditelusuri.
export const metadata: Metadata = pageMetadata({
  title: "Laporkan masalah",
  description:
    "Laporkan bug, kesalahan isi soal, atau kirim saran untuk Nihongofy. Bisa dikirim tanpa akun.",
  noindex: "follow",
});

export default async function ReportPage() {
  const context = await getReportFormContextAction();

  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="mx-auto grid w-full max-w-2xl gap-6">
        <div>
          <span className="inline-flex items-center gap-2 border-2 border-neo-ink bg-neo-coral px-2.5 py-1 font-mono text-[11px] font-black tracking-widest text-white uppercase shadow-neo-sm">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Laporan
          </span>
          <h1 className="mt-4 text-3xl leading-tight font-black uppercase sm:text-4xl">
            Ada yang keliru? Beri tahu kami.
          </h1>
          <p className="mt-3 text-base leading-7 text-foreground/70">
            Halaman ini untuk laporan umum: aplikasi error, tampilan rusak, atau saran fitur.
            Untuk melaporkan satu soal, pembahasan, artikel, atau entri diskusi tertentu, pakai
            tombol <strong className="font-extrabold">Laporkan</strong> yang ada di halamannya —
            tombol itu ikut membawa identitas yang dilaporkan sehingga tidak perlu Anda tulis
            manual.
          </p>
        </div>

        <div className="border-[3px] border-neo-ink bg-white p-5 shadow-neo sm:p-6">
          <ReportForm target={{ targetType: "GENERAL" }} context={context} />
        </div>

        <p className="text-xs font-semibold text-foreground/60">
          Laporan dibaca admin secara manual. Kami tidak selalu membalas, dan alamat email yang
          Anda tulis hanya dipakai untuk menjawab laporan ini.
        </p>
      </div>
    </PageContainer>
  );
}
