"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { getReportFormContextAction, type ReportFormContext } from "../actions";
import { REPORT_TARGET_TYPE_LABELS } from "../constants";
import type { ReportTarget } from "../schemas";
import { ReportForm } from "./report-form";

const TARGET_DESCRIPTIONS: Record<ReportTarget["targetType"], string> = {
  GENERAL: "Laporan umum tentang aplikasi ini.",
  QUESTION: "Laporan ini otomatis membawa identitas soal yang sedang Anda buka.",
  QUESTION_EXPLANATION:
    "Laporan ini otomatis membawa identitas soal yang pembahasannya sedang Anda baca.",
  ARTICLE: "Laporan ini otomatis membawa identitas artikel yang sedang Anda baca.",
  COMMENT: "Laporan ini otomatis membawa identitas entri diskusi yang Anda pilih.",
  FLASHCARD_VOCAB:
    "Laporan ini otomatis membawa identitas kartu yang Anda pilih, jadi kata dan levelnya tidak perlu ditulis ulang.",
};

/**
 * Tombol "Laporkan" yang dapat dipasang di mana saja. Dialognya terbuka di tempat
 * alih-alih menavigasi ke /report dengan id di query string: di runner ujian,
 * meninggalkan halaman berarti mengorbankan state jawaban dan timer yang sedang
 * berjalan.
 *
 * Target dikirim sebagai props dan divalidasi ulang di server — id dari client
 * tidak pernah dipercaya apa adanya.
 */
export function ReportButton({
  target,
  variant = "icon",
  label = "Laporkan",
  subject,
  disabled = false,
  onOpenChange,
  className,
}: {
  target: ReportTarget;
  /** `neo` dan `neo-icon` mengikuti tombol aksi bergaya `neo-button` di sekitarnya. */
  variant?: "icon" | "link" | "outline" | "neo" | "neo-icon";
  label?: string;
  /**
   * Nama singkat hal yang dilaporkan, ditampilkan di dialog (mis. kata pada kartu
   * flashcard yang dipilih dari daftar). Hanya tampilan: tidak ikut dikirim, dan
   * label target tetap disusun server dari databasenya sendiri. Elemen inline
   * saja, karena dirender di dalam deskripsi dialog.
   */
  subject?: ReactNode;
  disabled?: boolean;
  /**
   * Dipanggil setiap kali dialog terbuka atau tertutup, termasuk penutupan
   * otomatis setelah laporan terkirim. Reviewer flashcard memakainya untuk
   * mematikan pintasan keyboard selama dialog terbuka.
   */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ReportFormContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const closeTimer = useRef<number | null>(null);

  // Konteks form (perlu captcha atau tidak, ada email akun atau tidak) diambil
  // saat dialog dibuka. Kalau diteruskan sebagai props, setiap komponen induk
  // sampai ke runner ujian harus ikut merantai sitekey yang tidak mereka pakai.
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setContext(await getReportFormContextAction());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current === null) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  function handleOpenChange(next: boolean) {
    // Penutupan otomatis yang masih menunggu tidak boleh menutup dialog yang
    // sudah ditutup lalu dibuka lagi oleh pengguna.
    clearCloseTimer();
    setOpen(next);
    onOpenChange?.(next);
    if (next && context === null) void load();
  }

  const trigger =
    variant === "link" ? (
      <button
        type="button"
        className={cn("text-xs text-muted-foreground hover:underline", className)}
      >
        {label}
      </button>
    ) : variant === "outline" ? (
      <Button size="sm" variant="outline" className={cn("h-8 gap-1.5 text-xs", className)}>
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        {label}
      </Button>
    ) : variant === "neo" ? (
      <button type="button" className={cn("neo-button bg-white text-black", className)}>
        <TriangleAlert className="size-4" aria-hidden="true" />
        {label}
      </button>
    ) : variant === "neo-icon" ? (
      <button
        type="button"
        aria-label={label}
        title={label}
        className={cn("neo-button bg-white text-black", className)}
      >
        <TriangleAlert className="size-4" aria-hidden="true" />
      </button>
    ) : (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        title={label}
        className={className}
      >
        <TriangleAlert className="size-4" aria-hidden="true" />
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} disabled={disabled} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Laporkan · {REPORT_TARGET_TYPE_LABELS[target.targetType]}</DialogTitle>
          <DialogDescription>
            {subject ? (
              <span className="mb-1 block text-base font-black text-foreground">{subject}</span>
            ) : null}
            {TARGET_DESCRIPTIONS[target.targetType]}
          </DialogDescription>
        </DialogHeader>

        {context === null ? (
          <div className="flex justify-center py-8">
            {isLoading ? <Spinner /> : null}
          </div>
        ) : (
          <ReportForm
            target={target}
            context={context}
            onSuccess={() => {
              // Dialog dibiarkan terbuka sebentar supaya pesan berhasilnya
              // terbaca; menutupnya seketika membuat laporan terasa hilang.
              closeTimer.current = window.setTimeout(() => handleOpenChange(false), 2500);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
