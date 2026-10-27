"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Download, RotateCcw, Share2, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAnswerTime, formatQuizDate, formatQuizDuration, getQuizResults, QUIZ_LENGTH, type QuizSession } from "./engine";
import type { QuizImageKind } from "./image-export";

export function QuizResults({ session, quizUrl, onRetry }: { session: QuizSession; quizUrl: string; onRetry: () => void }) {
  const result = useMemo(() => getQuizResults(session), [session]);
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const [summary, setSummary] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const scriptLabel = session.script === "hiragana" ? "Hiragana" : "Katakana";

  useEffect(() => { title.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  useEffect(() => {
    let active = true;
    void import("./image-export").then(({ createQuizImage }) => createQuizImage(session, "summary", quizUrl)).then((file) => {
      if (active) setSummary(file);
    }).catch(() => {
      if (active) setExportError("Gambar belum berhasil disiapkan. Tekan unduh untuk mencoba lagi.");
    });
    return () => { active = false; };
  }, [session, quizUrl]);

  async function download(kind: QuizImageKind) {
    setExporting(true);
    setExportError("");
    setMessage("");
    try {
      const { createQuizImage, downloadQuizImage } = await import("./image-export");
      const file = kind === "summary" && summary ? summary : await createQuizImage(session, kind, quizUrl);
      if (kind === "summary") setSummary(file);
      downloadQuizImage(file);
      setMessage(kind === "full" ? "Laporan lengkap diunduh. Kirim gambarnya ke pengajarmu." : "Ringkasan diunduh. Gambarnya siap dibagikan.");
    } catch {
      setExportError("Gambar gagal diunduh. Coba lagi atau ambil screenshot hasil di bawah.");
    } finally {
      setExporting(false);
    }
  }

  async function share() {
    if (!summary) return;
    setMessage("");
    setExportError("");
    if (!navigator.canShare?.({ files: [summary] })) { await download("summary"); return; }
    try {
      await navigator.share({ title: `Hasil Quiz ${scriptLabel} — ${session.nickname}`, files: [summary] });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") return;
      await download("summary");
    }
  }

  const visibleRows = filter === "wrong" ? result.mistakes : result.rows;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="neo-kicker">46 / 46 selesai</span>
          <h1 ref={title} className="mt-4 text-4xl leading-tight sm:text-5xl" tabIndex={-1}>Hasil quiz kamu.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Simpan hasilnya, lalu bagikan ke pengajarmu.</p>
        </div>
        <Button onClick={onRetry} className="neo-button border-[3px] border-neo-ink bg-white font-extrabold text-neo-ink"><RotateCcw className="size-4" />Coba lagi</Button>
      </div>

      <article className="overflow-hidden rounded-lg border-[3px] border-neo-ink bg-white text-neo-ink shadow-neo-lg" aria-label="Ringkasan hasil quiz yang bisa di-screenshot">
        <header className="flex items-center justify-between gap-4 border-b-[3px] border-neo-ink bg-neo-blue px-5 py-4 sm:px-8">
          <span className="font-mono text-xs font-extrabold tracking-wider uppercase">Nihongofy / Kana lab</span>
          <span className="border-2 border-neo-ink bg-neo-yellow px-2 py-1 text-xs font-black uppercase">{scriptLabel}</span>
        </header>
        <div className="p-5 sm:p-8">
          <p className="text-xs font-black tracking-widest uppercase">Laporan belajar</p>
          <h2 className="mt-2 break-words text-3xl sm:text-4xl">{session.nickname}</h2>
          <p className="mt-2 text-xs text-slate-600 sm:text-sm">{session.finishedAt !== null ? formatQuizDate(session.finishedAt) : ""}</p>
          <div className="mt-7 flex items-center justify-between gap-3 border-y-2 border-neo-ink py-6">
            <div>
              <p className="font-black leading-none"><span className="text-7xl tracking-tighter sm:text-8xl">{result.correctCount}</span><span className="ml-1 text-3xl text-slate-500 sm:text-4xl">/ {QUIZ_LENGTH}</span></p>
              <p className="mt-3 font-mono text-[11px] font-bold tracking-wide uppercase">Jawaban benar</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black tracking-tighter sm:text-6xl">{result.accuracy}%</p>
              <p className="mt-2 font-mono text-[11px] font-bold uppercase">Akurasi</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 border-b-2 border-neo-ink py-5 sm:gap-6">
            {[
              ["Total waktu", formatQuizDuration(result.totalMs)],
              ["Rata-rata", formatAnswerTime(result.averageMs)],
              ["Perlu diulang", `${result.mistakes.length} kana`],
            ].map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase text-slate-600 sm:text-xs">{label}</dt><dd className="mt-1 font-mono text-base font-black tabular-nums sm:text-2xl">{value}</dd></div>)}
          </dl>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg">Peta 46 kana</h3>
            <div className="flex gap-3 text-[11px] font-semibold"><span className="flex items-center gap-1"><Check className="size-3.5" />Benar</span><span className="flex items-center gap-1"><X className="size-3.5 text-red-700" />Perlu diulang</span></div>
          </div>
          <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-10 sm:gap-2">
            {result.chart.map((row) => <div key={row.kanaKey} title={`${row.card.char}: jawaban ${row.selectedRomaji}, kunci ${row.card.romaji}, ${formatAnswerTime(row.elapsedMs)}`} className={cn("relative flex min-w-0 flex-col items-center rounded-sm border border-neo-ink px-0.5 pt-3 pb-1.5", row.correct ? "bg-emerald-100" : "bg-red-100")}>
              {row.correct ? <Check className="absolute top-0.5 right-0.5 size-2.5" aria-label="Benar" /> : <X className="absolute top-0.5 right-0.5 size-2.5 text-red-700" aria-label="Salah" />}
              <span lang="ja" className="font-japanese text-2xl leading-tight sm:text-3xl">{row.card.char}</span>
              <span className="mt-0.5 font-mono text-[10px] font-bold sm:text-[11px]">{row.card.romaji}</span>
            </div>)}
          </div>
          <p className="mt-5 border-t border-neo-ink/15 pt-3 font-mono text-[10px] font-bold tracking-wide uppercase">Nihongofy · Quiz 46 {scriptLabel}</p>
        </div>
      </article>

      <section aria-label="Simpan dan bagikan hasil">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Button className="neo-button h-auto border-[3px] border-neo-ink bg-neo-yellow font-extrabold whitespace-normal text-neo-ink" disabled={exporting} onClick={() => void download("full")}><Download className="size-4" />{exporting ? "Menyiapkan gambar…" : "Unduh laporan lengkap"}</Button>
          <Button className="neo-button h-auto border-[3px] border-neo-ink bg-white font-extrabold text-neo-ink" disabled={exporting} onClick={() => void download("summary")}><Download className="size-4" />Unduh ringkasan</Button>
          <Button className="neo-button h-auto border-[3px] border-neo-ink bg-neo-blue font-extrabold text-neo-ink" disabled={!summary || exporting} onClick={() => void share()}><Share2 className="size-4" />Bagikan</Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Laporan lengkap memuat seluruh jawaban dan waktunya. Hasil tersimpan sementara di tab ini; unduh sebelum menutupnya.</p>
        {message && <p role="status" className="mt-3 text-sm font-semibold">{message}</p>}
        {exportError && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{exportError}</p>}
      </section>

      <section className="border-y-2 border-neo-ink py-6" aria-labelledby="quiz-notes-title">
        <h2 id="quiz-notes-title" className="text-2xl">Catatan untuk latihan berikutnya</h2>
        {result.mistakes.length ? <>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.mistakes.length} kana perlu diulang. Ini jawaban yang tertukar:</p>
          <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {result.mistakes.map((row) => <li key={row.kanaKey} className="flex items-center gap-3 border-b border-neo-ink/15 pb-3">
              <span lang="ja" className="font-japanese text-4xl">{row.card.char}</span>
              <div className="min-w-0 flex-1 text-sm"><p><span className="text-muted-foreground">Jawabanmu </span><strong>{row.selectedRomaji}</strong><ArrowRight className="mx-1.5 inline size-3.5" aria-hidden="true" /><strong>{row.card.romaji}</strong><span className="ml-1 text-muted-foreground">(benar)</span></p><p className="mt-1 text-xs text-muted-foreground">{formatAnswerTime(row.elapsedMs)}</p></div>
            </li>)}
          </ul>
        </> : <p className="mt-3 flex items-start gap-2 text-sm leading-6"><Check className="mt-0.5 size-5 shrink-0" />Semua 46 kana terjawab benar. Pertahankan, lalu coba jenis kana lainnya!</p>}
        {result.slowestCorrect.length > 0 && <div className="mt-6">
          <h3 className="flex items-center gap-2 text-base"><Timer className="size-4" />Benar, dengan waktu paling lama</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Bisa menjadi bahan latihan kelancaran. Durasi tidak mengurangi nilai.</p>
          <ul className="mt-3 flex flex-wrap gap-3">{result.slowestCorrect.map((row) => <li key={row.kanaKey} className="flex items-center gap-2 rounded-lg border-2 border-neo-ink bg-card px-3 py-2"><span lang="ja" className="font-japanese text-2xl">{row.card.char}</span><span className="text-sm font-bold">{row.card.romaji}</span><span className="font-mono text-xs text-muted-foreground">{formatAnswerTime(row.elapsedMs)}</span></li>)}</ul>
        </div>}
      </section>

      <section aria-labelledby="quiz-detail-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="quiz-detail-title" className="text-2xl">Rincian jawaban</h2>
          <div className="flex gap-2" role="group" aria-label="Filter jawaban">
            <Button variant="outline" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={cn("min-h-10 border-2 border-neo-ink font-bold", filter === "all" && "bg-neo-yellow text-neo-ink hover:bg-neo-yellow")}>Semua (46)</Button>
            <Button variant="outline" aria-pressed={filter === "wrong"} onClick={() => setFilter("wrong")} className={cn("min-h-10 border-2 border-neo-ink font-bold", filter === "wrong" && "bg-neo-yellow text-neo-ink hover:bg-neo-yellow")}>Salah ({result.mistakes.length})</Button>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border-2 border-neo-ink bg-card">
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="sr-only">Jawaban siswa, kunci romaji, dan durasi untuk setiap kana dalam urutan soal.</caption>
            <thead className="border-b-2 border-neo-ink bg-neo-blue text-neo-ink"><tr>{["Kana", "Jawabanmu", "Kunci", "Waktu"].map((label) => <th scope="col" key={label} className="px-2 py-3 font-extrabold sm:px-4">{label}</th>)}</tr></thead>
            <tbody>{visibleRows.map((row) => <tr key={row.kanaKey} className={cn("border-b border-neo-ink/15 last:border-0", !row.correct && "bg-red-100 text-neo-ink")}>
              <th scope="row" className="px-2 py-2 sm:px-4"><span className="mr-1.5 font-mono text-[10px] font-normal opacity-60">{String(row.number).padStart(2, "0")}</span><span lang="ja" className="font-japanese text-2xl font-normal">{row.card.char}</span></th>
              <td className="px-2 py-2 font-bold sm:px-4"><span className="inline-flex items-center gap-1">{row.correct ? <Check className="size-3" aria-label="Benar" /> : <X className="size-3" aria-label="Salah" />}{row.selectedRomaji}</span></td>
              <td className="px-2 py-2 font-bold sm:px-4">{row.card.romaji}</td><td className="px-2 py-2 font-mono tabular-nums sm:px-4">{formatAnswerTime(row.elapsedMs)}</td>
            </tr>)}</tbody>
          </table>
          {visibleRows.length === 0 && <p className="p-6 text-center text-sm">Tidak ada jawaban salah. Semua kana sudah benar!</p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Waktu dihitung sampai jawaban dipilih, termasuk saat berpindah tab atau refresh. Jeda antarkartu tidak ikut dihitung.</p>
      </section>
      <Link className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4" href={`/kana/${session.script}`}>Belajar {scriptLabel} lagi<ArrowRight className="size-4" /></Link>
    </div>
  );
}
