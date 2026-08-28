"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { exportProgressToExcel, exportProgressToPdf } from "../lib/export";
import type { ProgressLevelView } from "./progress-tabs";

export function ProgressExportButtons({ view }: { view: ProgressLevelView }) {
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
        onClick={() => exportProgressToPdf(view)}
        className="neo-button !min-h-9 !px-3.5 !py-1.5 bg-white text-black font-black text-xs hover:bg-neo-coral hover:text-white transition-colors"
      >
        <FileText className="size-4 text-rose-600" />
        Export PDF (.pdf)
      </button>
    </div>
  );
}
