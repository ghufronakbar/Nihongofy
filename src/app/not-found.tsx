import Link from "next/link";
import { ArrowLeft, FileQuestion, Search } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";

export default function NotFound() {
  return (
    <section className="neo-grid-paper relative flex min-h-[70vh] items-center overflow-hidden py-16 sm:py-24">
      <div
        className="absolute -left-14 top-12 size-32 -rotate-12 border-[3px] border-neo-ink bg-neo-coral shadow-neo-lg sm:size-44"
        aria-hidden="true"
      />
      <div
        className="absolute -right-10 bottom-10 size-28 rotate-12 border-[3px] border-neo-ink bg-neo-yellow shadow-neo-lg sm:size-40"
        aria-hidden="true"
      />

      <PageContainer className="relative z-10">
        <div className="neo-surface mx-auto max-w-3xl bg-white p-7 text-center sm:p-12">
          <div className="mx-auto grid size-16 -rotate-3 place-items-center border-[3px] border-neo-ink bg-neo-blue text-white shadow-neo sm:size-20">
            <FileQuestion className="size-9 sm:size-11" aria-hidden="true" />
          </div>
          <p className="mt-7 font-mono text-sm font-black tracking-[0.24em] text-neo-coral">
            ERROR 404
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-none text-neo-ink sm:text-6xl">
            Halaman tidak ditemukan
          </h1>
          <p className="mx-auto mt-5 max-w-[52ch] text-base font-semibold leading-7 text-foreground/70">
            Alamatnya mungkin salah, datanya tidak tersedia, atau halaman sudah dipindahkan.
            Kembali ke beranda atau lanjutkan mencari paket latihan.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="neo-button bg-neo-blue text-white">
              <ArrowLeft className="size-5" aria-hidden="true" />
              Kembali ke beranda
            </Link>
            <Link href="/test-package" className="neo-button bg-neo-yellow text-black">
              <Search className="size-5" aria-hidden="true" />
              Cari paket JLPT
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
