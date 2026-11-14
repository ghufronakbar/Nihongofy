"use client";

import { useState } from "react";
import { FileDown, KeyRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { PrintDocument } from "@/features/admin/test-package/schemas";

// Export lembar soal + lembar jawab, atau kunci jawaban sebagai dokumen terpisah
// (supaya tidak ikut tercetak bersama lembar peserta). Membuka halaman cetak di
// tab baru; dialog cetak browser muncul otomatis dan admin memilih "Simpan
// sebagai PDF". Tautan biasa (<a>), bukan next/link: tujuannya route handler.
export function ExportPdfPanel({ packageId, siteName }: { packageId: number; siteName: string }) {
  const [branding, setBranding] = useState(false);
  const hrefFor = (kind: PrintDocument) => {
    const params = new URLSearchParams();
    if (kind !== "questions") params.set("document", kind);
    if (branding) params.set("branding", "1");
    const query = params.toString();
    return `/admin/test-package/${packageId}/print${query ? `?${query}` : ""}`;
  };

  return (
    <section className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-4 shadow-neo">
      <div>
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Export PDF
        </h2>
        <p className="mt-1 text-sm font-semibold text-foreground/75">
          <span className="font-black">Lembar soal</span>: soal per sesi plus satu lembar jawab, ukuran
          A4. Pertanyaan yang hanya ada di audio 聴解 tidak ikut dicetak.{" "}
          <span className="font-black">Kunci jawaban</span>: lembar jawab yang sama dengan jawaban
          benar dihitamkan, sebagai file terpisah. Tab baru akan terbuka dengan dialog cetak; pilih{" "}
          <span className="font-black">Simpan sebagai PDF</span> (paling akurat di Chrome).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <Checkbox
            checked={branding}
            onCheckedChange={(checked) => setBranding(checked === true)}
          />
          <span>Sertakan branding {siteName} (nama dan domain situs)</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <a href={hrefFor("questions")} target="_blank" rel="noopener" className="neo-button">
            <FileDown className="size-4" />
            Lembar soal
          </a>
          <a
            href={hrefFor("answer-key")}
            target="_blank"
            rel="noopener"
            className="neo-button bg-white text-black"
          >
            <KeyRound className="size-4" />
            Kunci jawaban
          </a>
        </div>
      </div>
    </section>
  );
}
