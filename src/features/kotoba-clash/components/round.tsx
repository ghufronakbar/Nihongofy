"use client";

import { JapaneseText } from "@/components/japanese-text";
import { JapanesePassage } from "@/components/japanese-passage";
import { MONDAI_TYPE_TRANSLATIONS } from "@/constants/jlpt";
import { cn } from "@/lib/utils";
import type { ClashRoomSnapshot } from "../contracts";

function QuestionImage({ src, alt }: { src: string | null; alt: string }) {
  // Question images can have arbitrary dimensions; preserve readable source aspect ratio.
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} className="mx-auto mt-4 max-h-[60dvh] max-w-full object-contain" /> : null;
}

export function ClashRound({ match, now, connected, pending, answer, review = false }: {
  match: NonNullable<ClashRoomSnapshot["match"]>; now: number; connected: boolean; pending: boolean; answer?: (choice: number) => void; review?: boolean;
}) {
  const phase = match.phase;
  const seconds = "endsAt" in phase ? Math.max(0, Math.ceil((phase.endsAt - now) / 1000)) : 0;
  if (phase.type === "COUNTDOWN") return <section className="neo-surface grid min-h-72 place-content-center bg-neo-yellow p-8 text-center"><h2 className="text-2xl font-black">Bersiap!</h2><p className="mt-5 font-mono text-8xl font-black" aria-live="off">{seconds}</p><p className="mt-5">Soal pertama akan muncul bersama.</p></section>;
  const round = match.round;
  if (!round || phase.type === "FINISHED") return null;
  const revealed = phase.type === "REVEAL";
  const disabled = !connected || !match.playing || pending || match.ownAnswer !== null || revealed || now >= round.endsAt;
  return <section className="neo-surface overflow-hidden bg-white" aria-labelledby="round-title">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b-[3px] border-neo-ink bg-neo-yellow p-5">
      <div><p className="text-sm font-bold">Soal {round.position} / {match.questionCount}</p><h2 id="round-title" className="mt-1 text-xl font-black">{MONDAI_TYPE_TRANSLATIONS[round.mondaiType]}</h2></div>
      {!review && <p className="font-mono text-3xl font-black" aria-label={`${seconds} detik ${revealed ? "menuju soal berikutnya" : "tersisa"}`}>{seconds}s</p>}
    </div>
    <div className="space-y-6 p-5 sm:p-8">
      {!review && !match.playing && <p className="border-l-4 border-neo-blue pl-4 font-bold">Mode penonton. Anda dapat ikut setelah pertandingan selesai.</p>}
      {round.content.instruction && <p className="font-japanese text-sm leading-7"><JapaneseText text={round.content.instruction} /></p>}
      {round.content.context && <div className="border-2 border-neo-ink bg-background p-5"><JapanesePassage text={round.content.context.text ?? ""} /><QuestionImage src={round.content.context.image} alt="Materi bacaan soal" /></div>}
      <p className="font-japanese whitespace-pre-wrap text-xl leading-10"><JapaneseText text={round.content.text} /></p>
      <QuestionImage src={round.content.image} alt="Gambar pendukung soal" />
      <div className="grid gap-4 sm:grid-cols-2">
        {round.content.choices.map((choice) => <button key={choice.code} type="button" disabled={disabled} onClick={() => answer?.(choice.code)} aria-pressed={match.ownAnswer?.choice === choice.code}
          className={cn("flex min-h-20 items-start gap-4 border-[3px] border-neo-ink p-4 text-left font-bold transition-colors focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-neo-blue disabled:cursor-default", revealed && choice.code === round.correctChoice ? "bg-neo-green" : match.ownAnswer?.choice === choice.code ? "bg-neo-yellow" : "bg-white enabled:hover:bg-neo-blue/20")}>
          <span className="font-mono text-xl">{choice.code}</span><span className="min-w-0 font-japanese whitespace-pre-wrap leading-8"><JapaneseText text={choice.text} /><QuestionImage src={choice.image} alt={`Gambar pilihan ${choice.code}`} />{revealed && choice.code === round.correctChoice && <span className="block text-sm">Jawaban benar</span>}</span>
        </button>)}
      </div>
      <p aria-live="polite" className="text-sm font-bold">{revealed ? `Jawaban benar: ${round.correctChoice}.` : pending ? "Mengirim jawaban. Menunggu konfirmasi server..." : match.ownAnswer ? "Jawaban tersimpan. Tunggu waktu ronde berakhir." : seconds === 0 ? "Waktu habis. Menunggu reveal dari server..." : "Jawaban pertama bersifat final. Pemain lain tetap dapat menjawab sampai waktu habis."}</p>
      {revealed && <div className="border-t-2 border-neo-ink pt-5"><h3 className="font-black">Pembahasan</h3><p className="mt-3 whitespace-pre-wrap leading-8"><JapaneseText text={round.explanation?.trim() || "Pembahasan untuk soal ini belum tersedia."} /></p>{!review && <p className="mt-4 text-sm text-foreground/70">{round.position === match.questionCount ? "Hasil akhir muncul otomatis setelah reveal selesai." : "Ronde berikutnya berjalan otomatis setelah reveal selesai."}</p>}</div>}
    </div>
  </section>;
}
