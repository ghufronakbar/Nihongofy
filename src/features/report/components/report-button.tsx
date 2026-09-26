"use client";

import { useCallback, useState } from "react";
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
  className,
}: {
  target: ReportTarget;
  variant?: "icon" | "link" | "outline";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ReportFormContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  function handleOpenChange(next: boolean) {
    setOpen(next);
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
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Laporkan · {REPORT_TARGET_TYPE_LABELS[target.targetType]}</DialogTitle>
          <DialogDescription>{TARGET_DESCRIPTIONS[target.targetType]}</DialogDescription>
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
              window.setTimeout(() => setOpen(false), 2500);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
