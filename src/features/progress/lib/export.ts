import * as XLSX from "xlsx";
import { MONDAI_TYPE_TRANSLATIONS } from "@/constants/jlpt";
import { SCORING_SECTION_TRANSLATIONS } from "@/lib/jlpt-score";
import { SECTION_COLUMNS, type ProgressLevelView } from "../components/progress-tabs";

// Header/row shape mirrors the table on screen. Labels are Indonesian-only
// (the PDF report — rendered server-side, see app/api/progress/report — uses
// the bilingual labels instead).
function buildHeaderRow(view: ProgressLevelView): string[] {
  return [
    "Paket",
    "Tanggal",
    ...view.mondaiColumns.map(
      (column) => `${MONDAI_TYPE_TRANSLATIONS[column.mondaiType]} (%)`,
    ),
    ...SECTION_COLUMNS.map((column) => `${SCORING_SECTION_TRANSLATIONS[column.key]} Skor`),
    ...SECTION_COLUMNS.map((column) => `${SCORING_SECTION_TRANSLATIONS[column.key]} Skor (%)`),
    ...SECTION_COLUMNS.map((column) => `${SCORING_SECTION_TRANSLATIONS[column.key]} Berbobot`),
    "Total Skor",
    "Total (%)",
    "Total Berbobot",
  ];
}

function buildDataRows(view: ProgressLevelView): (string | number)[][] {
  return view.rows.map((row) => [
    row.packageName,
    row.dateLabel,
    ...view.mondaiColumns.map((column) => row.mondaiAccuracy[column.mondaiType] ?? ""),
    ...SECTION_COLUMNS.map((column) => row.sections[column.key]?.plainScore ?? ""),
    ...SECTION_COLUMNS.map((column) => row.sections[column.key]?.accuracy ?? ""),
    ...SECTION_COLUMNS.map((column) => row.sections[column.key]?.weightedScore ?? ""),
    row.totalPlain,
    row.totalAccuracy,
    row.totalWeighted,
  ]);
}

export function exportProgressToExcel(view: ProgressLevelView) {
  const worksheet = XLSX.utils.aoa_to_sheet([buildHeaderRow(view), ...buildDataRows(view)]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, view.level);
  XLSX.writeFile(workbook, `progress-${view.level}.xlsx`);
}

// The PDF report is rendered on the server (it embeds a Japanese font), so the
// client only downloads it.
export async function downloadProgressReport(level: string) {
  const response = await fetch(`/api/progress/report?level=${encodeURIComponent(level)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Gagal membuat report PDF.");
  }
  // Sesi habis → proxy me-redirect ke /login dan fetch mengikuti redirect itu,
  // jadi yang diterima HTML halaman login (status 200), bukan PDF.
  if (!response.headers.get("Content-Type")?.includes("application/pdf")) {
    throw new Error("Sesi kamu sudah berakhir. Silakan masuk lagi.");
  }

  const filename =
    response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
    `nihongofy-progress-${level}.pdf`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke setelah jeda: Safari/Firefox bisa membatalkan unduhan kalau URL
  // dicabut di tick yang sama dengan click().
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
