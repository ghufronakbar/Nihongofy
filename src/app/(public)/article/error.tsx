"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";

interface ArticleErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}

export default function ArticleError({
  error,
  reset,
  retry,
}: ArticleErrorProps) {
  useEffect(() => {
    // Log unexpected errors for monitoring and debugging
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
    <section className="neo-grid-paper py-20 md:py-28">
      <PageContainer>
        <div className="neo-surface mx-auto max-w-2xl bg-white p-8 text-center sm:p-12">
          <div className="mx-auto grid size-16 place-items-center border-[3px] border-neo-ink bg-neo-coral text-neo-ink shadow-neo-sm">
            <AlertTriangle className="size-8" aria-hidden="true" />
          </div>
          <p className="mt-7 font-mono text-sm font-black tracking-[0.2em] uppercase text-neo-coral">
            Terjadi Kesalahan
          </p>
          <h1 className="mt-2 text-3xl font-black text-neo-ink sm:text-4xl">
            Gagal Memuat Artikel
          </h1>
          <p className="mx-auto mt-4 max-w-[48ch] leading-7 text-foreground/70">
            Terjadi kendala saat mengambil atau menampilkan data artikel. Kamu bisa mencoba
            memuat ulang atau kembali ke katalog artikel.
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
            <Link href="/article" className="neo-button bg-neo-blue text-white">
              <ArrowLeft className="size-5" aria-hidden="true" />
              Kembali ke artikel
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
