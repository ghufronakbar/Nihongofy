"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Copy, Flag, Link2, RotateCcw, Target, Ticket, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntrySchema, type RaceSnapshot } from "../contracts";
import { getRaceRoomAction, joinRaceRoomAction } from "../actions";
import { RaceBoard } from "./board";
import { useRaceRoom } from "./use-race-room";
import { RaceSectionHeading } from "./ui";
import { RaceLobby } from "./lobby";

const STATUS = { PLAYING: "Masih menebak", SOLVED: "Berhasil!", EXHAUSTED: "6 tebakan habis", TIMED_OUT: "Waktu habis" };

export function RaceResults({ state }: { state: RaceSnapshot }) {
  if (!state.match || state.match.phase !== "FINISHED") return null;
  return <section className="space-y-6">
    <div className="race-panel overflow-hidden"><RaceSectionHeading icon={Flag} label="Garis finis" title={state.config.mode === "solo" ? "Latihan selesai." : "Balapan selesai."} tone="green" /><p className="p-5 text-sm leading-7 sm:p-6">Skor berasal dari ketepatan dan waktu tebakan yang diterima server. Tebakan yang ditolak tidak memakai kesempatan.</p></div>
    <RaceLeaderboard state={state} />
    <h2 className="text-2xl font-black">Kata baru untuk dibawa pulang.</h2>
    <p className="text-sm opacity-75">Review ini menampilkan tebakanmu sendiri. Hasil tersimpan selama 7 hari.</p>
    <div className="grid gap-5 md:grid-cols-2">{state.match.review.map((round, index) => <article key={index} className="race-panel p-5">
      <p className="race-eyebrow">Ronde {index + 1}</p><h3 className="mt-2 text-3xl font-black" lang="ja">{round.kana}</h3>
      <Sources sources={round.sources} />
      <p className="mt-4 text-xs font-bold">Tebakanmu ({round.guesses.length}/6)</p>
      <ol className="mt-2 space-y-1">{round.guesses.map((guess) => <li key={guess.requestId} className="flex gap-1" aria-label={`${guess.kana}: ${guess.feedback.map((mark) => ({ correct: "tepat posisi", present: "posisi lain", absent: "tidak ada" })[mark]).join(", ")}`}>{Array.from(guess.kana).map((char, i) => <span key={i} className="race-review-char" data-mark={guess.feedback[i]} lang="ja" aria-hidden="true">{char}</span>)}</li>)}</ol>
      {!round.guesses.length && <p className="mt-2 text-sm">Tidak ada tebakan.</p>}
    </article>)}</div>
  </section>;
}

function Sources({ sources }: { sources: NonNullable<NonNullable<RaceSnapshot["match"]>["reveal"]>["sources"] }) {
  return <ul className="mt-3 space-y-2">{sources.map((source) => <li key={source.key} className="text-sm leading-6"><strong lang="ja">{source.word}</strong><span className="mx-2 text-xs opacity-60">{source.level}</span><p>{source.meaning}</p></li>)}</ul>;
}

function RaceLeaderboard({ state }: { state: RaceSnapshot }) {
  if (state.config.mode === "solo") {
    const player = state.match?.players.find((row) => row.memberId === state.viewer.memberId);
    return <section className="race-panel min-w-0 overflow-hidden"><RaceSectionHeading icon={Target} label="Tantang dirimu" title="Skor latihan" tone="paper" /><div className="space-y-5 p-5"><div><p className="race-eyebrow">Total skor</p><p className="mt-2 font-mono text-4xl font-black tabular-nums">{(player?.score ?? 0).toLocaleString("id-ID")}</p></div>{state.match?.phase === "FINISHED" ? <p className="text-sm font-bold">{state.match.review.filter((round) => round.guesses.some((guess) => guess.solved || guess.kana === round.kana)).length}/{state.match.count} kata berhasil ditebak</p> : <p className="text-sm font-bold">{STATUS[player?.status ?? "PLAYING"]} · {player?.attempts ?? 0}/6 tebakan</p>}<p className="border-t-2 border-neo-ink pt-4 text-xs leading-6 opacity-75">Skor diperbarui saat jawaban dibuka. Gunakan petunjuk posisi untuk menemukan kata berikutnya.</p></div></section>;
  }
  return <section className="race-panel min-w-0 overflow-hidden"><RaceSectionHeading icon={Trophy} label="Kejar podium" title="Papan balapan" tone="paper" />
    <ol className="divide-y-2 divide-neo-ink/20">{state.match?.players.map((player) => <li key={player.memberId} className="race-member flex items-center gap-3 px-5 py-4" data-self={player.memberId === state.viewer.memberId}>
      <span className="w-6 shrink-0 font-mono text-lg font-black">{player.rank}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{state.members.find((member) => member.id === player.memberId)?.nickname ?? "Pengguna dihapus"}{player.memberId === state.viewer.memberId ? " (kamu)" : ""}</p><p className="mt-1 text-xs opacity-75">{STATUS[player.status]} · {player.attempts}/6</p></div><span className="font-mono font-black tabular-nums">{player.score.toLocaleString("id-ID")}</span>
    </li>)}</ol><p className="border-t-2 border-neo-ink p-5 text-xs leading-5 opacity-70">Skor diperbarui saat reveal. Papan dan petunjuk setiap pemain bersifat pribadi.</p>
  </section>;
}

export function RaceRoom({ code, initial, initialError, displayName, results = false }: { code: string; initial: RaceSnapshot | null; initialError?: string | null; displayName?: string; results?: boolean }) {
  const room = useRaceRoom(initial, !results);
  const [error, setError] = useState(initialError ?? "");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const join = useForm({ resolver: zodResolver(EntrySchema), defaultValues: { nickname: displayName?.slice(0, 24) ?? "" } });
  const state = room.state;
  if (!state) return <div className="mx-auto max-w-lg space-y-6">
    <Link href="/mini-games/kana-word-race" className="inline-flex items-center gap-2 text-sm font-bold underline"><ArrowLeft className="size-4" />Kana Word Race</Link>
    <section className="race-panel overflow-hidden"><RaceSectionHeading icon={Ticket} label={`Room ${code}`} title="Siap adu tebakan?" as="h1" /><div className="p-5 sm:p-6"><p className="mb-5 text-sm leading-6">Pakai nickname yang mudah dikenali temanmu. Guest bisa langsung bergabung.</p>
      {results ? <p role="alert">{error || "Masuk sebagai peserta pertandingan untuk melihat hasilnya."}</p> : <form className="space-y-4" onSubmit={join.handleSubmit(async ({ nickname }) => {
        setError("");
        try {
          const result = await joinRaceRoomAction({ code, nickname });
          if (!result.ok) { setError(result.message); return; }
          const snapshot = await getRaceRoomAction({ code });
          if (snapshot.ok) room.accept(snapshot.data); else setError(snapshot.message ?? "Room belum dapat dibuka. Coba lagi.");
        } catch { setError("Koneksi gagal. Coba bergabung lagi."); }
      })}>
        <label className="block text-sm font-bold" htmlFor="race-join-name">Nickname</label><Input className="race-input" id="race-join-name" autoComplete="nickname" maxLength={24} {...join.register("nickname")} />
        {join.formState.errors.nickname && <p role="alert" className="text-sm">Gunakan 2-24 huruf, angka, spasi, titik, garis, atau underscore.</p>}
        {error && <p role="alert" className="text-sm">{error}</p>}<Button className="race-button w-full" disabled={join.formState.isSubmitting} type="submit">{join.formState.isSubmitting ? "Bergabung..." : "Gabung Room"}</Button>
      </form>}
    </div></section>
  </div>;
  const connected = room.status === "online" && !state.closed;
  const disabled = !connected || room.pending;
  const match = state.match;
  const solo = state.config.mode === "solo";
  const seconds = match ? Math.max(0, Math.ceil((match.endsAt - room.now) / 1000)) : 0;
  const command = (type: "start" | "rematch" | "close") => room.send(type === "start"
    ? { type, roomId: state.roomId, requestId: crypto.randomUUID(), revision: state.revision }
    : { type, roomId: state.roomId, requestId: crypto.randomUUID() });
  async function copyInvitation(target: "code" | "link") {
    try {
      await navigator.clipboard.writeText(target === "code" ? code : `${location.origin}/mini-games/kana-word-race/room/${code}`);
      setCopied(target); setTimeout(() => setCopied(null), 2500);
    } catch { setError("Salin kode atau alamat room dari bilah browser untuk mengundang teman."); }
  }
  return <div className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-5"><div className="min-w-0"><Link className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4" href="/mini-games/kana-word-race"><ArrowLeft className="size-4" />Kana Word Race</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{results ? (solo ? "Hasil latihan." : "Hasil balapan.") : match ? "Kejar katanya." : solo ? "Tantang dirimu." : "Kumpulkan temanmu."}</h1>{solo ? <span className="race-tag">SOLO</span> : <span className="race-tag font-mono" aria-label={`Kode room ${code}`}>{code}</span>}</div></div>
      {!solo && !state.closed && <div className="flex flex-wrap gap-3"><Button className="race-button race-button-paper" aria-label={copied === "code" ? "Kode disalin" : "Salin kode room"} onClick={() => void copyInvitation("code")}>{copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}{copied === "code" ? "Kode disalin" : "Kode"}</Button><Button className="race-button" data-tone="blue" aria-label={copied === "link" ? "Link disalin" : "Salin link undangan room"} onClick={() => void copyInvitation("link")}>{copied === "link" ? <Check className="size-4" /> : <Link2 className="size-4" />}{copied === "link" ? "Link disalin" : "Link undangan"}</Button></div>}
    </header>
    {!results && <div role="status" className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold"><span className="inline-flex items-center gap-2"><span className="race-status-dot" data-online={connected} />{state.closed ? "Sesi ditutup. Hasil tetap tersedia selama retensi." : connected ? `Terhubung / ${solo ? "Latihan solo" : state.viewer.host ? "Kamu host" : "Progres tersinkron"}` : room.status === "closed" ? "Koneksi berakhir. Muat ulang untuk memeriksa akses." : "Menghubungkan kembali... Tebakan diterima akan dipulihkan."}</span>{!connected && !state.closed && <Button className="race-button race-button-paper" onClick={() => { location.reload(); }}>Muat ulang</Button>}</div>}
    {(room.error || error) && <p role="alert" className="race-notice">{room.error || error}</p>}
    {!match && !state.closed && <RaceLobby state={state} disabled={disabled} online={room.online} send={room.send} />}
    {match && match.phase !== "FINISHED" && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="race-panel min-w-0 p-3 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3 border-b-[3px] border-neo-ink pb-4"><div><p className="race-eyebrow">Ronde {match.round + 1}/{match.count} · {match.length} kana</p><p className="mt-1 text-sm font-extrabold">{match.phase === "COUNTDOWN" ? "Bersiap..." : match.phase === "REVEAL" ? (solo ? "Jawaban dibuka" : "Jawaban dibuka bersama") : STATUS[match.status ?? "PLAYING"]}</p></div><span className="race-timer" data-urgent={seconds <= 10 && match.phase === "PLAYING"} aria-label={`Sisa waktu ${seconds} detik`}><Timer className="size-5" />{seconds}s</span></div>
        {match.category && <p className="mb-5 text-center text-sm">Kategori: <strong>{match.category}</strong></p>}
        <RaceBoard key={`${match.id}:${match.round}`} match={match} enabled={connected && match.phase === "PLAYING" && match.status === "PLAYING" && seconds > 0} pending={room.pending} onGuess={(kana) => room.send({ type: "guess", roomId: state.roomId, requestId: crypto.randomUUID(), matchId: match.id, round: match.round, kana })} />
        {!solo && match.status === "SOLVED" && match.phase === "PLAYING" && <p role="status" className="race-notice mt-5">Tepat! Tunggu temanmu menyelesaikan tebakan mereka.</p>}
        {match.reveal && <section aria-live="polite" className="race-notice mt-5"><p className="race-eyebrow">Kata ronde ini</p><h2 className="mt-2 text-3xl font-black" lang="ja">{match.reveal.kana}</h2><Sources sources={match.reveal.sources} /></section>}
      </div><RaceLeaderboard state={state} />
    </div>}
    {match?.phase === "FINISHED" && <><RaceResults state={state} /><div className="flex flex-wrap gap-4">{state.viewer.host && !results && !state.closed && <Button className="race-button" disabled={disabled} onClick={() => command("rematch")}><RotateCcw className="size-4" />{solo ? "Latihan lagi" : "Kembali ke lobby"}</Button>}{!results && <Link className="race-button race-button-paper" href={`/mini-games/kana-word-race/room/${code}/results/${match.id}`}>Buka hasil tersimpan</Link>}{results && <Link className="race-button" href={`/mini-games/kana-word-race/room/${code}`}>{solo ? "Kembali ke sesi" : "Kembali ke room"}</Link>}</div></>}
    {state.viewer.host && !results && !state.closed && <div className="border-t-2 border-current/15 pt-5">{confirmClose ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm">{solo ? "Akhiri sesi latihan ini?" : "Tutup room untuk semua pemain?"}</p><Button className="race-button" data-tone="coral" disabled={disabled} onClick={() => command("close")}>Tutup sekarang</Button><Button className="race-button race-button-paper" onClick={() => setConfirmClose(false)}>Batal</Button></div> : <button className="text-xs font-bold underline underline-offset-4" type="button" onClick={() => setConfirmClose(true)}>{solo ? "Akhiri sesi" : "Tutup room"}</button>}</div>}
  </div>;
}
