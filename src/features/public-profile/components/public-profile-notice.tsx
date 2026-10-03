"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Globe2, X } from "lucide-react";
import { dismissPublicProfileNoticeAction } from "../actions";

/**
 * Pemberitahuan sekali tampil untuk akun yang dibuat sebelum profil publik ada:
 * profil mereka kini PUBLIC tanpa pernah memilihnya. Hilang setelah ditutup atau
 * setelah user memilih visibility sendiri (keduanya mengisi
 * `publicProfileNoticeDismissedAt`).
 */
export function PublicProfileNotice({ username }: { username: string }) {
  const [hidden, setHidden] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (hidden) return null;

  function dismiss() {
    // Disembunyikan seketika; bila action gagal, banner muncul lagi di
    // kunjungan berikutnya karena kolomnya belum terisi.
    setHidden(true);
    startTransition(async () => {
      await dismissPublicProfileNoticeAction();
    });
  }

  return (
    <aside
      aria-label="Pemberitahuan profil publik"
      className="neo-surface flex items-start gap-4 bg-neo-green p-4 sm:items-center sm:p-5"
    >
      <span className="grid size-10 shrink-0 place-items-center border-[3px] border-black bg-white shadow-neo-sm">
        <Globe2 className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black">Profil belajarmu kini publik.</p>
        <p className="mt-1 text-sm font-semibold text-black/70">
          Statistik dan jejak belajarmu tampil di{" "}
          <Link href={`/u/${username}`} className="font-bold break-all underline decoration-2 underline-offset-4">
            /u/{username}
          </Link>
          . Kamu bisa menjadikannya private kapan saja di{" "}
          <Link href="/profile/privacy" className="font-bold underline decoration-2 underline-offset-4">
            Privasi & Data
          </Link>
          .
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        disabled={isPending}
        className="grid size-9 shrink-0 place-items-center border-2 border-black bg-white shadow-neo-sm hover:bg-neo-yellow"
        aria-label="Tutup pemberitahuan"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
