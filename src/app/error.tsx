"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}

export default function RootError({ error, reset, retry }: RootErrorProps) {
  useEffect(() => {
    // Log unexpected errors
    console.error(error);
  }, [error]);

  const handleRetry = () => {
    if (typeof retry === "function") {
      retry();
    } else {
      reset();
    }
  };

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
        <div className="neo-surface mx-auto max-w-2xl bg-white p-7 text-center sm:p-12">
          <div className="mx-auto grid size-16 -rotate-3 place-items-center border-[3px] border-neo-ink bg-neo-coral text-neo-ink shadow-neo sm:size-20">
            <AlertTriangle className="size-9 sm:size-11" aria-hidden="true" />
          </div>
          <p className="mt-7 font-mono text-sm font-black tracking-[0.24em] uppercase text-neo-coral">
            Terjadi Kesalahan
          </p>
          <h1 className="mt-3 text-3xl font-black uppercase leading-tight text-neo-ink sm:text-5xl">
            Sesuatu Tidak Berjalan Semestinya
          </h1>
          <p className="mx-auto mt-4 max-w-[50ch] text-base font-semibold leading-7 text-foreground/70">
            Terjadi kendala saat memproses permintaanmu. Coba muat ulang halaman atau kembali ke beranda.
          </p>

          {error.digest && (
            <p className="mt-3 font-mono text-xs text-foreground/50">
              Kode referensi: {error.digest}
            </p>
          )}

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleRetry}
              className="neo-button cursor-pointer bg-neo-yellow text-neo-ink"
            >
              <RotateCcw className="size-5" aria-hidden="true" />
              Coba lagi
            </button>
            <Link href="/" className="neo-button bg-neo-blue text-white">
              <ArrowLeft className="size-5" aria-hidden="true" />
              Kembali ke beranda
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
