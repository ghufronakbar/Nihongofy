"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}

export default function GlobalError({ error, reset, retry }: GlobalErrorProps) {
  useEffect(() => {
    // Log unexpected root layout exceptions
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
    <html lang="id">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#f4f2ec] p-4 text-[#111111]">
        <main className="w-full max-w-lg border-[3px] border-[#111111] bg-white p-6 text-center shadow-[5px_5px_0_0_#111111] sm:p-10">
          <div className="mx-auto grid size-16 place-items-center border-[3px] border-[#111111] bg-[#ff6b6b] text-white shadow-[3px_3px_0_0_#111111]">
            <AlertTriangle className="size-8 text-[#111111]" aria-hidden="true" />
          </div>
          <p className="mt-6 font-mono text-xs font-black tracking-[0.2em] uppercase text-[#ff6b6b]">
            Error Sistem
          </p>
          <h1 className="mt-2 text-2xl font-black uppercase text-[#111111] sm:text-3xl">
            Terjadi Masalah Kritis
          </h1>
          <p className="mt-4 text-sm font-semibold leading-relaxed text-[#111111]/70">
            Aplikasi mengalami kendala tak terduga pada sistem utama. Silakan coba muat ulang halaman.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-[#111111]/50">
              Kode referensi: {error.digest}
            </p>
          )}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex cursor-pointer items-center gap-2 border-[3px] border-[#111111] bg-[#facc00] px-6 py-3 font-bold text-[#111111] shadow-[3px_3px_0_0_#111111] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0"
            >
              <RotateCcw className="size-5" aria-hidden="true" />
              Muat Ulang Halaman
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
