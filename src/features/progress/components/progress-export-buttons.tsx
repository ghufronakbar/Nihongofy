"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { downloadProgressReport, exportProgressToExcel } from "../lib/export";
import type { ProgressLevelView } from "./progress-tabs";

export function ProgressExportButtons({ view }: { view: ProgressLevelView }) {
  const [pdfPending, setPdfPending] = useState(false);

  async function handlePdf() {
    setPdfPending(true);
    try {
      await downloadProgressReport(view.level);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat report PDF.");
    } finally {
      setPdfPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => exportProgressToExcel(view)}
        className="neo-button !min-h-9 !px-3.5 !py-1.5 bg-white text-black font-black text-xs hover:bg-neo-green hover:text-black transition-colors"
      >
        <FileSpreadsheet className="size-4 text-emerald-600" />
        Export Excel (.xlsx)
      </button>
      <button
        type="button"
        onClick={handlePdf}
        disabled={pdfPending}
        aria-busy={pdfPending}
        className="neo-button !min-h-9 !px-3.5 !py-1.5 bg-white text-black font-black text-xs hover:bg-neo-coral hover:text-white transition-colors disabled:opacity-70"
      >
        {pdfPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <FileText className="size-4 text-rose-600" />
        )}
        {pdfPending ? "Membuat report…" : "Report PDF (.pdf)"}
      </button>
    </div>
  );
}
