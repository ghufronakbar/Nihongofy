"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

interface AuthErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}

export default function AuthError({ error, reset, retry }: AuthErrorProps) {
  useEffect(() => {
    // Log unexpected auth errors
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
    <div className="neo-surface bg-white p-6 text-center sm:p-8">
      <div className="mx-auto grid size-14 place-items-center border-[3px] border-neo-ink bg-neo-coral text-neo-ink shadow-neo-sm">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </div>
      <p className="mt-5 font-mono text-xs font-black tracking-[0.2em] uppercase text-neo-coral">
        Terjadi Kesalahan
      </p>
      <h1 className="mt-2 text-2xl font-black text-neo-ink">
        Gagal Memuat Formulir
      </h1>
      <p className="mt-3 text-sm leading-6 text-foreground/70">
        Terjadi kendala saat memuat layanan autentikasi. Silakan coba kembali atau masuk ke halaman login.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-xs text-foreground/50">
          Kode referensi: {error.digest}
        </p>
      )}

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleRetry}
          className="neo-button cursor-pointer bg-neo-yellow text-neo-ink"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Coba lagi
        </button>
        <Link href="/login" className="neo-button bg-neo-blue text-white">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Halaman masuk
        </Link>
      </div>
    </div>
  );
}
