"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}

export default function DashboardError({
  error,
  reset,
  retry,
}: DashboardErrorProps) {
  useEffect(() => {
    // Log unexpected dashboard errors
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
    <div className="neo-surface mx-auto my-auto w-full max-w-2xl bg-white p-7 text-center sm:p-12">
      <div className="mx-auto grid size-16 place-items-center border-[3px] border-neo-ink bg-neo-coral text-neo-ink shadow-neo-sm">
        <AlertTriangle className="size-8" aria-hidden="true" />
      </div>
      <p className="mt-6 font-mono text-sm font-black tracking-[0.2em] uppercase text-neo-coral">
        Kendala Dashboard
      </p>
      <h1 className="mt-2 text-2xl font-black text-neo-ink sm:text-3xl">
        Gagal Memuat Data Dashboard
      </h1>
      <p className="mx-auto mt-4 max-w-[46ch] leading-7 text-foreground/70">
        Terjadi kendala saat mengambil data akun atau aktivitas belajarmu. Coba muat ulang bagian ini atau kembali ke ringkasan dashboard.
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
        <Link href="/dashboard" className="neo-button bg-neo-blue text-white">
          <ArrowLeft className="size-5" aria-hidden="true" />
          Ke ringkasan dashboard
        </Link>
      </div>
    </div>
  );
}
