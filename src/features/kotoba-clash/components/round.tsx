"use client";

import { Check, CheckCheck, Eye, Flag, LockKeyhole, Swords, Timer, X, Zap } from "lucide-react";
import { JapaneseText } from "@/components/japanese-text";
import { JapanesePassage } from "@/components/japanese-passage";
import { MONDAI_TYPE_TRANSLATIONS } from "@/constants/jlpt";
import { cn } from "@/lib/utils";
import type { ClashRoomSnapshot } from "../contracts";

function QuestionImage({ src, alt }: { src: string | null; alt: string }) {
  // Preserve source dimensions for diagrams and scanned question material.
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} className="mx-auto mt-4 max-h-[60dvh] max-w-full object-contain" /> : null;
}

export function ClashRound({ match, now, connected, pending, answer, review = false }: {
  match: NonNullable<ClashRoomSnapshot["match"]>; now: number; connected: boolean; pending: boolean; answer?: (choice: number) => void; review?: boolean;
}) {
  const phase = match.phase;
  const seconds = "endsAt" in phase ? Math.max(0, Math.ceil((phase.endsAt - now) / 1000)) : 0;
  if (phase.type === "COUNTDOWN") return <section className="clash-panel clash-countdown clash-round-enter" aria-label="Bersiap memulai pertandingan">
    <span className="relative mx-auto flex items-center justify-center gap-2 text-sm font-black"><Swords className="size-5" />{match.leaderboard.length} PEMAIN. SATU PODIUM.</span>
    <h2 className="relative mt-4 text-2xl font-black">Siapkan instingmu.</h2>
    <p key={seconds} className="clash-countdown-number relative my-5" aria-live="off">{seconds || "GO"}</p>
    <p className="relative text-sm font-semibold">{match.playing ? "Jawab tepat. Kejar waktu. Rebut posisi." : "Kamu menonton dari tepi arena."}</p>
    <div className="relative mt-5 flex justify-center gap-2" aria-hidden="true">{[3, 2, 1].map((number) => <span key={number} className={cn("size-3 border-2 border-neo-ink", seconds <= number ? "bg-neo-ink" : "bg-white")} />)}</div>
  </section>;
  const round = match.round;
  if (!round || phase.type === "FINISHED") return null;
  const revealed = phase.type === "REVEAL";
  const remaining = Math.max(0, phase.endsAt - now);
  const duration = revealed ? round.revealEndsAt - round.endsAt : round.endsAt - round.startsAt;
  const ratio = Math.min(1, remaining / Math.max(1, duration));
  const urgent = !revealed && seconds <= 5;
  const disabled = review || !connected || !match.playing || pending || match.ownAnswer !== null || revealed || now >= round.endsAt;
  const correct = revealed && match.ownAnswer?.choice === round.correctChoice;
  return <section key={round.id} className="clash-panel clash-round-enter overflow-hidden" aria-labelledby={`round-title-${round.id}`}>
    <div className={cn("flex items-center justify-between gap-3 p-4 sm:p-5", revealed ? "bg-neo-green" : "bg-neo-yellow")}>
      <div className="min-w-0"><p className="clash-label">{review ? "Review" : revealed ? "Ronde terbuka" : "Arena live"} / Soal {round.position} dari {match.questionCount}</p><h2 id={`round-title-${round.id}`} className="mt-1.5 text-lg font-black sm:text-xl">{MONDAI_TYPE_TRANSLATIONS[round.mondaiType]}</h2></div>
      {!review && <div className="shrink-0 text-center"><p className="clash-timer-number" data-urgent={urgent} aria-live="off">{seconds}<span className="ml-0.5 text-sm">s</span></p><p className="mt-1.5 text-[10px] font-extrabold">{revealed ? "SELANJUTNYA" : "TERSISA"}</p></div>}
    </div>
    {!review && <div className="clash-timer-track" role="progressbar" aria-label={revealed ? "Waktu pembahasan" : "Waktu menjawab tersisa"} aria-valuemin={0} aria-valuemax={Math.ceil(duration / 1000)} aria-valuenow={Math.min(seconds, Math.ceil(duration / 1000))} aria-valuetext={`${seconds} detik`}>
      <div className="clash-timer-fill" data-urgent={urgent} data-reveal={revealed} style={{ transform: `scaleX(${ratio})` }} />
    </div>}
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-7">
      {!review && <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-1" aria-label={`Progres pertandingan: soal ${round.position} dari ${match.questionCount}`}>{Array.from({ length: match.questionCount }, (_, index) => <span key={index} aria-hidden="true" className={cn("h-1.5 min-w-0 flex-1 border border-neo-ink", index + 1 < round.position ? "bg-neo-ink" : index + 1 === round.position ? "bg-neo-blue" : "bg-white")} />)}</div>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-extrabold"><Flag className="size-3" />{round.position}/{match.questionCount}</span>
      </div>}
      {!review && !match.playing && <p className="flex items-center gap-2 border-2 border-neo-ink bg-neo-paper p-3 text-xs font-bold"><Eye className="size-4 shrink-0" />Kursi penonton. Ikut tanding setelah match ini selesai.</p>}
      {revealed && !review && match.playing && <div className={cn("clash-reveal-enter flex items-start gap-3 border-2 border-neo-ink p-4", correct ? "bg-green-100" : "bg-orange-50")} role="status">
        {correct ? <CheckCheck className="size-6 shrink-0" /> : <Flag className="size-6 shrink-0" />}<div><p className="text-lg font-black">{correct ? "Tepat sasaran." : match.ownAnswer ? "Ronde ini belum milikmu." : "Waktunya habis."}</p><p className="mt-1 text-xs leading-5">{correct ? "Poin dan rekor streak sudah masuk papan peringkat." : "Lihat pembahasannya. Ronde berikutnya jadi kesempatan baru."}</p></div>
      </div>}
      {round.content.instruction && <p className="font-japanese text-sm leading-7 text-neo-ink/70"><JapaneseText text={round.content.instruction} /></p>}
      {round.content.context && <div className="rounded border-2 border-neo-ink bg-neo-paper p-4 sm:p-5"><JapanesePassage text={round.content.context.text ?? ""} /><QuestionImage src={round.content.context.image} alt="Materi bacaan soal" /></div>}
      <p className="font-japanese whitespace-pre-wrap text-xl leading-10 sm:text-2xl sm:leading-[1.8]"><JapaneseText text={round.content.text} /></p>
      <QuestionImage src={round.content.image} alt="Gambar pendukung soal" />
      <div className="grid gap-4 pb-1 sm:grid-cols-2">
        {round.content.choices.map((choice) => {
          const chosen = match.ownAnswer?.choice === choice.code;
          const right = revealed && choice.code === round.correctChoice;
          const wrong = revealed && chosen && !right;
          return <button key={choice.code} type="button" disabled={disabled} onClick={() => answer?.(choice.code)} aria-pressed={chosen} data-correct={right} data-wrong={wrong} className="clash-choice">
            <span className="clash-choice-code">{choice.code}</span><span className="min-w-0 flex-1 font-japanese whitespace-pre-wrap leading-8"><JapaneseText text={choice.text} /><QuestionImage src={choice.image} alt={`Gambar pilihan ${choice.code}`} />{right && <span className="block text-xs font-extrabold">Jawaban benar</span>}{chosen && !revealed && <span className="block text-xs">Pilihanmu</span>}</span>
            {right ? <Check className="size-5 shrink-0" aria-hidden="true" /> : wrong ? <X className="size-5 shrink-0" aria-hidden="true" /> : chosen ? <LockKeyhole className="size-4 shrink-0" aria-hidden="true" /> : null}
          </button>;
        })}
      </div>
      {!review && <div className={cn("flex items-start gap-3 border-t-2 border-neo-ink pt-4 text-xs leading-6", match.ownAnswer && !revealed && "text-neo-ink")} role="status">
        {revealed ? <CheckCheck className="mt-0.5 size-5 shrink-0" /> : match.ownAnswer ? <LockKeyhole className="mt-0.5 size-5 shrink-0" /> : <Timer className="mt-0.5 size-5 shrink-0" />}
        <p className="font-semibold">{revealed ? `Jawaban benar: ${round.correctChoice}.` : pending ? "Mengunci pilihanmu..." : match.ownAnswer ? "Jawaban terkunci. Menunggu pemain lain menyelesaikan ronde." : !match.playing ? "Semua pemain mendapat soal dan waktu yang sama." : seconds === 0 ? "Waktu habis. Hasil ronde sedang disiapkan..." : !connected ? "Koneksi terputus. Menyambungkan kembali sebelum kamu bisa menjawab." : "Cepat saja belum cukup. Pilih tepat, jawaban pertama tidak bisa diubah."}</p>
      </div>}
      {revealed && <div className="clash-reveal-enter rounded border-2 border-neo-ink bg-neo-paper p-4 sm:p-5"><h3 className="flex items-center gap-2 font-black"><Zap className="size-4" />Bedah ronde</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-8"><JapaneseText text={round.explanation?.trim() || "Pembahasan untuk soal ini belum tersedia."} /></p>{!review && <p className="mt-4 border-t border-neo-ink/20 pt-3 text-xs font-semibold">{round.position === match.questionCount ? "Garis finis di depan. Podium akhir muncul setelah pembahasan." : "Ambil napas. Ronde berikutnya dimulai otomatis."}</p>}</div>}
    </div>
  </section>;
}
