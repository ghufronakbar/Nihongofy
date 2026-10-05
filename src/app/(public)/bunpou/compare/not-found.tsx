import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";

export default function BunpouComparisonNotFound() {
  return (
    <section className="neo-grid-paper py-20 md:py-28">
      <PageContainer>
        <div className="neo-surface mx-auto max-w-2xl bg-white p-8 text-center sm:p-12">
          <div className="mx-auto grid size-16 place-items-center border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
            <Scale className="size-8" aria-hidden="true" />
          </div>
          <h1 className="mt-7 text-4xl">Perbandingan tidak ditemukan</h1>
          <p className="mx-auto mt-4 max-w-[48ch] leading-7 text-foreground/70">
            Tautan mungkin sudah berubah, atau perbandingan ini belum atau tidak lagi diterbitkan.
          </p>
          <Link href="/bunpou#bunpou-comparisons" className="neo-button mt-7 bg-neo-blue">
            <ArrowLeft className="size-5" aria-hidden="true" />
            Lihat daftar perbandingan
          </Link>
        </div>
      </PageContainer>
    </section>
  );
}
