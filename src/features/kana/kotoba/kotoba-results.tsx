"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Download, RotateCcw, Settings2, Share2, SkipForward, TimerOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAnswerTime, formatQuizDate, formatQuizDuration } from "../quiz/engine";
import { formatBabs, formatKotobaLength, getKotobaResults, groupKotobaRows, KOTOBA_WEAK_BAB_ACCURACY, kotobaFront, kotobaLengthLimit, type KotobaQuizSession } from "./engine";
import type { KotobaImageKind } from "./image-export";

export function KotobaResults({ session, quizUrl, onRetry, onRetryMistakes, onChangeSettings }: { session: KotobaQuizSession; quizUrl: string; onRetry: () => void; onRetryMistakes: (keys: string[]) => void; onChangeSettings: () => void }) {
  const result = useMemo(() => getKotobaResults(session), [session]);
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const title = useRef<HTMLHeadingElement>(null);
  const frontLabel = session.front === "kanji" ? "Depan kanji" : "Depan kana";
  const flipMode = session.mode === "flip";
  // Rincian dibagi per bab begitu hasil memuat lebih dari satu bab.
  const grouped = result.byBab.length > 1;
  const babStats = new Map(result.byBab.map((item) => [item.bab, item]));

  const [summary, setSummary] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [exportError, setExportError] = useState("");

  useEffect(() => { title.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  // Ringkasan disiapkan lebih dulu supaya "Bagikan" bisa memanggil navigator.share dalam gesture klik yang sama.
  useEffect(() => {
    let active = true;
    void import("./image-export").then(({ createKotobaImage }) => createKotobaImage(session, "summary", quizUrl)).then((file) => {
      if (active) setSummary(file);
    }).catch(() => {
      if (active) setExportError("Gambar belum berhasil disiapkan. Tekan unduh untuk mencoba lagi.");
    });
    return () => { active = false; };
  }, [session, quizUrl]);

  async function download(kind: KotobaImageKind) {
    setExporting(true);
    setExportError("");
    setMessage("");
    try {
      const { createKotobaImage, downloadKotobaImage } = await import("./image-export");
      const file = kind === "summary" && summary ? summary : await createKotobaImage(session, kind, quizUrl);
      if (kind === "summary") setSummary(file);
      downloadKotobaImage(file);
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
      await navigator.share({ title: `Hasil Tebak Kotoba — ${session.nickname}`, files: [summary] });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") return;
      await download("summary");
    }
  }

  const visibleRows = filter === "wrong" ? result.mistakes : result.rows;
  const stats = [
    ["Total waktu", formatQuizDuration(result.totalMs)],
    ["Rata-rata", formatAnswerTime(result.averageMs)],
    ["Salah", `${result.wrongCount} kata`],
    ...(flipMode ? [] : [["Dilewati", `${result.skippedCount} kata`]]),
    ...(session.timeLimit === null ? [] : [["Waktu habis", `${result.timedOutCount} kata`]]),
  ];
  const missLabel = (row: (typeof result.rows)[number]) => row.timedOut ? "Waktu habis" : flipMode ? "Kamu tandai salah" : row.selected ? `Jawabanmu: ${row.selected.meaning}` : "Dilewati";

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="neo-kicker">{result.total} / {result.total} selesai</span>
          <h1 ref={title} className="mt-4 text-4xl leading-tight outline-none sm:text-5xl" tabIndex={-1}>Hasil tebak kotoba.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Ulangi kata yang salah selagi masih ingat, atau main lagi dengan urutan baru.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={onRetry} className="neo-button border-[3px] border-neo-ink bg-white font-extrabold text-neo-ink"><RotateCcw className="size-4" />Main lagi</Button>
          <Button onClick={onChangeSettings} className="neo-button border-[3px] border-neo-ink bg-white font-extrabold text-neo-ink"><Settings2 className="size-4" />Ubah pengaturan</Button>
        </div>
      </div>

      <article className="overflow-hidden rounded-lg border-[3px] border-neo-ink bg-white text-neo-ink shadow-neo-lg" aria-label="Ringkasan hasil tebak kotoba yang bisa di-screenshot">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-neo-ink bg-neo-blue px-5 py-4 sm:px-8">
          <span className="font-mono text-xs font-extrabold tracking-wider uppercase">Nihongofy / Tebak kotoba</span>
          <span className="flex flex-wrap gap-2"><span className="border-2 border-neo-ink bg-neo-yellow px-2 py-1 text-xs font-black uppercase">{formatBabs(session.babs)}</span><span className="border-2 border-neo-ink bg-white px-2 py-1 text-xs font-black uppercase">{frontLabel}</span><span className="border-2 border-neo-ink bg-white px-2 py-1 text-xs font-black uppercase">{flipMode ? "Balik kartu" : "4 pilihan"}</span>{kotobaLengthLimit(session.length)?.perBab && <span className="border-2 border-neo-ink bg-white px-2 py-1 text-xs font-black uppercase">{formatKotobaLength(session.length)}</span>}{session.scope === "inti" && <span className="border-2 border-neo-ink bg-white px-2 py-1 text-xs font-black uppercase">Kata inti</span>}{session.timeLimit !== null && <span className="border-2 border-neo-ink bg-white px-2 py-1 text-xs font-black uppercase">Timer {session.timeLimit} dtk</span>}</span>
        </header>
        <div className="p-5 sm:p-8">
          <p className="text-xs font-black tracking-widest uppercase">Laporan belajar · Minna no Nihongo I</p>
          <h2 className="mt-2 break-words text-3xl sm:text-4xl">{session.nickname}</h2>
          <p className="mt-2 text-xs text-slate-600 sm:text-sm">{session.finishedAt !== null ? formatQuizDate(session.finishedAt) : ""}</p>
          <div className="mt-7 flex items-center justify-between gap-3 border-y-2 border-neo-ink py-6">
            <div>
              <p className="font-black leading-none"><span className="text-7xl tracking-tighter sm:text-8xl">{result.correctCount}</span><span className="ml-1 text-3xl text-slate-500 sm:text-4xl">/ {result.total}</span></p>
              <p className="mt-3 font-mono text-[11px] font-bold tracking-wide uppercase">{flipMode ? "Ditandai benar" : "Jawaban benar"}</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black tracking-tighter sm:text-6xl">{result.accuracy}%</p>
              <p className="mt-2 font-mono text-[11px] font-bold uppercase">Akurasi</p>
            </div>
          </div>
          <dl className={cn("grid grid-cols-2 gap-x-2 gap-y-4 border-b-2 border-neo-ink py-5 sm:gap-6", stats.length === 3 ? "sm:grid-cols-3" : stats.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-5")}>
            {stats.map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase text-slate-600 sm:text-xs">{label}</dt><dd className="mt-1 font-mono text-base font-black tabular-nums sm:text-2xl">{value}</dd></div>)}
          </dl>
          {grouped && <div className="mt-6">
            <h3 className="text-lg">Per bab</h3>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {result.byBab.map((item) => <li key={item.bab} className={cn("rounded-sm border border-neo-ink px-3 py-2", item.correct === item.total ? "bg-emerald-100" : item.accuracy < KOTOBA_WEAK_BAB_ACCURACY ? "bg-red-100" : "bg-white")}>
                <p className="flex items-baseline justify-between gap-2 font-mono text-[10px] font-bold uppercase"><span>Bab {item.bab}</span><span className="tabular-nums">{item.accuracy}%</span></p>
                <p className="mt-1 text-xl font-black tabular-nums">{item.correct}<span className="text-sm text-slate-500"> / {item.total}</span></p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-600">{item.mistakes.length ? `${item.mistakes.length} perlu diulang` : "Semua benar"}</p>
              </li>)}
            </ul>
            <p className="mt-2 text-[11px] leading-4 text-slate-600">Hijau: semua benar. Merah: akurasi di bawah {KOTOBA_WEAK_BAB_ACCURACY}%.</p>
          </div>}
          <p className="mt-5 border-t border-neo-ink/15 pt-3 font-mono text-[10px] font-bold tracking-wide uppercase">Nihongofy · Tebak kotoba {formatBabs(session.babs)}</p>
        </div>
      </article>

      <section aria-label="Simpan dan bagikan rapor">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Button className="neo-button h-auto border-[3px] border-neo-ink bg-neo-yellow font-extrabold whitespace-normal text-neo-ink" disabled={exporting} onClick={() => void download("full")}><Download className="size-4" />{exporting ? "Menyiapkan gambar…" : "Unduh laporan lengkap"}</Button>
          <Button className="neo-button h-auto border-[3px] border-neo-ink bg-white font-extrabold text-neo-ink" disabled={exporting} onClick={() => void download("summary")}><Download className="size-4" />Unduh ringkasan</Button>
          <Button className="neo-button h-auto border-[3px] border-neo-ink bg-neo-blue font-extrabold text-neo-ink" disabled={!summary || exporting} onClick={() => void share()}><Share2 className="size-4" />Bagikan</Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Gambar PNG dibuat di perangkatmu. Laporan lengkap memuat setiap kata, {session.mode === "flip" ? "penilaianmu" : "jawabanmu"}, dan waktunya; bila kata terlalu banyak untuk satu gambar, hanya kata yang perlu diulang yang dimuat. Hasil tersimpan sementara di tab ini; unduh sebelum menutupnya.</p>
        {message && <p role="status" className="mt-3 text-sm font-semibold">{message}</p>}
        {exportError && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{exportError}</p>}
      </section>

      <section className="border-y-2 border-neo-ink py-6" aria-labelledby="kotoba-notes-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="kotoba-notes-title" className="text-2xl">Kata yang perlu diulang</h2>
          {result.mistakes.length > 0 && <Button onClick={() => onRetryMistakes(result.mistakes.map((row) => row.key))} className="neo-button border-[3px] border-neo-ink bg-neo-yellow font-extrabold text-neo-ink">Ulangi {result.mistakes.length} kata ini<ArrowRight className="size-4" /></Button>}
        </div>
        {result.mistakes.length ? groupKotobaRows(result.mistakes).map((group) => <div key={group.bab} className={cn(grouped && "mt-6")}>
          {grouped && <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-neo-ink pb-2">
            <h3 className="text-lg">Bab {group.bab} <span className="text-sm font-semibold text-muted-foreground">· {group.rows.length} dari {babStats.get(group.bab)?.total ?? group.rows.length} kata</span></h3>
            {result.byBab.filter((item) => item.mistakes.length).length > 1 && <Button variant="outline" onClick={() => onRetryMistakes(group.rows.map((row) => row.key))} className="min-h-10 border-2 border-neo-ink text-xs font-bold">Ulangi Bab {group.bab}<ArrowRight className="size-3.5" /></Button>}
          </div>}
          <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {group.rows.map((row) => <li key={row.key} className="border-b border-neo-ink/15 pb-3">
              <p className="flex flex-wrap items-baseline gap-x-3"><span lang="ja" className="font-japanese text-3xl">{kotobaFront(row.entry, session.front)}</span>{row.entry.kanji && <span lang="ja" className="font-japanese text-base text-muted-foreground">{session.front === "kanji" ? row.entry.kana : row.entry.kanji}</span>}</p>
              <p className="mt-1 text-sm"><strong>{row.entry.meaning}</strong></p>
              <p className="mt-1 text-xs text-muted-foreground">{missLabel(row)}</p>
            </li>)}
          </ul>
        </div>) : <p className="mt-3 flex items-start gap-2 text-sm leading-6"><Check className="mt-0.5 size-5 shrink-0" />Semua kata {flipMode ? "ditandai" : "terjawab"} benar. Coba tampilan depan {session.front === "kana" ? "kanji" : "kana"} atau tambah bab lain!</p>}
      </section>

      <section aria-labelledby="kotoba-detail-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="kotoba-detail-title" className="text-2xl">Rincian jawaban</h2>
          <div className="flex gap-2" role="group" aria-label="Filter jawaban">
            <Button variant="outline" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={cn("min-h-10 border-2 border-neo-ink font-bold", filter === "all" && "bg-neo-yellow text-neo-ink hover:bg-neo-yellow")}>Semua ({result.rows.length})</Button>
            <Button variant="outline" aria-pressed={filter === "wrong"} onClick={() => setFilter("wrong")} className={cn("min-h-10 border-2 border-neo-ink font-bold", filter === "wrong" && "bg-neo-yellow text-neo-ink hover:bg-neo-yellow")}>Perlu diulang ({result.mistakes.length})</Button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border-2 border-neo-ink bg-card">
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="sr-only">{flipMode ? "Kata yang diuji, penilaian siswa sendiri, arti yang benar, dan durasi dalam urutan soal." : "Kata yang diuji, jawaban siswa, arti yang benar, dan durasi dalam urutan soal."}</caption>
            <thead className="border-b-2 border-neo-ink bg-neo-blue text-neo-ink"><tr>{["Kata", flipMode ? "Penilaianmu" : "Jawabanmu", "Arti", "Waktu"].map((label) => <th scope="col" key={label} className="px-2 py-3 font-extrabold sm:px-4">{label}</th>)}</tr></thead>
            {groupKotobaRows(visibleRows).map((group) => <tbody key={group.bab}>{grouped && <tr className="border-b-2 border-neo-ink bg-neo-yellow/40 text-neo-ink dark:text-foreground">
              <th scope="colgroup" colSpan={4} className="px-2 py-2 text-left font-extrabold sm:px-4">Bab {group.bab}<span className="ml-2 font-mono text-xs font-bold">{babStats.get(group.bab)?.correct} / {babStats.get(group.bab)?.total} benar · {babStats.get(group.bab)?.accuracy}%</span></th>
            </tr>}{group.rows.map((row) => <tr key={row.key} className={cn("border-b border-neo-ink/15 align-top last:border-0", !row.correct && "text-neo-ink", !row.correct && (row.timedOut ? "bg-orange-100" : row.skipped ? "bg-amber-100" : "bg-red-100"))}>
              <th scope="row" className="px-2 py-2 font-normal sm:px-4"><span className="mr-1.5 font-mono text-[10px] opacity-60">{String(row.number).padStart(2, "0")}</span><span lang="ja" className="font-japanese text-lg">{row.entry.kana}</span>{row.entry.kanji && <span lang="ja" className="font-japanese block text-xs opacity-70">{row.entry.kanji}</span>}</th>
              <td className="px-2 py-2 font-bold sm:px-4">{flipMode && !row.timedOut ? <span className="inline-flex items-start gap-1">{row.correct ? <Check className="mt-0.5 size-3 shrink-0" aria-hidden="true" /> : <X className="mt-0.5 size-3 shrink-0" aria-hidden="true" />}{row.correct ? "Benar" : "Salah"}</span> : row.selected ? <span className="inline-flex items-start gap-1">{row.correct ? <Check className="mt-0.5 size-3 shrink-0" aria-label="Benar" /> : <X className="mt-0.5 size-3 shrink-0" aria-label="Salah" />}{row.selected.meaning}</span> : <span className="inline-flex items-start gap-1 italic">{row.timedOut ? <TimerOff className="mt-0.5 size-3 shrink-0" aria-hidden="true" /> : <SkipForward className="mt-0.5 size-3 shrink-0" aria-hidden="true" />}{row.timedOut ? "Waktu habis" : "Dilewati"}</span>}</td>
              <td className="px-2 py-2 font-bold sm:px-4">{row.entry.meaning}</td><td className="px-2 py-2 font-mono whitespace-nowrap tabular-nums sm:px-4">{formatAnswerTime(row.elapsedMs)}</td>
            </tr>)}</tbody>)}
          </table>
          {visibleRows.length === 0 && <p className="p-6 text-center text-sm">Tidak ada kata yang salah atau dilewati. Semua sudah benar!</p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{flipMode ? "Waktu dihitung sejak kartu tampil sampai kartu dibalik. Waktu menilai benar/salah tidak ikut dihitung." : "Waktu dihitung sejak kartu tampil sampai arti dipilih atau kata dilewati. Waktu membaca bagian belakang kartu tidak ikut dihitung."}</p>
      </section>
      <Link className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4" href="/kana/quiz">Uji hafalan kana juga<ArrowRight className="size-4" /></Link>
    </div>
  );
}
