"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Copy, Flag, RotateCcw, Timer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ConfigSchema, EntrySchema, type RaceCommand, type RaceSnapshot } from "../contracts";
import { getRaceRoomAction, joinRaceRoomAction } from "../actions";
import { RaceBoard } from "./board";
import { useRaceRoom } from "./use-race-room";

const STATUS = { PLAYING: "Masih menebak", SOLVED: "Berhasil!", EXHAUSTED: "6 tebakan habis", TIMED_OUT: "Waktu habis" };
type SendCommand = (command: RaceCommand) => void;

function Settings({ state, disabled, send }: { state: RaceSnapshot; disabled: boolean; send: SendCommand }) {
  const form = useForm({ resolver: zodResolver(ConfigSchema), defaultValues: state.config });
  return <form className="race-panel p-5 sm:p-7" onSubmit={form.handleSubmit((config) => send({ type: "configure", roomId: state.roomId, requestId: crypto.randomUUID(), revision: state.revision, config }))}>
    <h2 className="text-xl font-black">Atur tantangannya.</h2>
    <fieldset disabled={disabled || !state.viewer.host} className="mt-5 grid gap-5 sm:grid-cols-2">
      <label className="race-field">Panjang kata<NativeSelect {...form.register("length", { setValueAs: (value: string) => Number(value) })}>
        <NativeSelectOption value={0}>Acak 3-7 kana</NativeSelectOption>{[3, 4, 5, 6, 7].map((length) => <NativeSelectOption key={length} value={length}>{length} kana · {state.stock[String(length)] ?? 0} target</NativeSelectOption>)}
      </NativeSelect></label>
      <label className="race-field">Jumlah ronde<NativeSelect {...form.register("rounds", { setValueAs: (value: string) => Number(value) })}>{[3, 5, 10].map((rounds) => <NativeSelectOption key={rounds} value={rounds}>{rounds} ronde</NativeSelectOption>)}</NativeSelect></label>
      <label className="race-field">Waktu<NativeSelect {...form.register("pace")}><NativeSelectOption value="normal">Normal · 90-150 detik</NativeSelectOption><NativeSelectOption value="relaxed">Santai · tambah 60 detik</NativeSelectOption></NativeSelect></label>
      <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" className="size-5 accent-emerald-700" {...form.register("category")} />Tampilkan petunjuk kategori</label>
    </fieldset>
    <p className="mt-5 text-xs leading-6 opacity-75">3-4 kana: 90 detik. 5 kana: 120 detik. 6-7 kana: 150 detik. Setiap perubahan pengaturan meminta semua pemain siap kembali.</p>
    {Object.keys(form.formState.errors).length > 0 && <p role="alert">Periksa pengaturan permainan.</p>}
    {state.viewer.host && <Button className="race-button mt-5" disabled={disabled || !form.formState.isDirty} type="submit">Simpan pengaturan</Button>}
  </form>;
}

export function RaceResults({ state }: { state: RaceSnapshot }) {
  if (!state.match || state.match.phase !== "FINISHED") return null;
  return <section className="space-y-6">
    <div className="race-panel race-accent p-6"><Flag className="mb-3 size-8" /><h2 className="text-3xl font-black">Balapan selesai.</h2><p className="mt-2 leading-7">Skor berasal dari ketepatan dan waktu tebakan yang diterima server. Tebakan yang ditolak tidak memakai kesempatan.</p></div>
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
  return <section className="race-panel p-5 sm:p-6"><h2 className="text-xl font-black">Papan balapan</h2><p className="mt-2 text-xs leading-5 opacity-70">Skor diperbarui saat reveal. Papan dan petunjuk setiap pemain bersifat pribadi.</p>
    <ol className="mt-4 divide-y-2 divide-current/15">{state.match?.players.map((player) => <li key={player.memberId} className="flex items-center gap-3 py-4">
      <span className="w-6 font-mono text-lg font-black">{player.rank}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{state.members.find((member) => member.id === player.memberId)?.nickname ?? "Pengguna dihapus"}{player.memberId === state.viewer.memberId ? " (kamu)" : ""}</p><p className="mt-1 text-xs opacity-75">{STATUS[player.status]} · {player.attempts}/6</p></div><span className="font-mono font-black tabular-nums">{player.score.toLocaleString("id-ID")}</span>
    </li>)}</ol>
  </section>;
}

export function RaceRoom({ code, initial, initialError, displayName, results = false }: { code: string; initial: RaceSnapshot | null; initialError?: string | null; displayName?: string; results?: boolean }) {
  const room = useRaceRoom(initial, !results);
  const [error, setError] = useState(initialError ?? "");
  const [copied, setCopied] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const join = useForm({ resolver: zodResolver(EntrySchema), defaultValues: { nickname: displayName?.slice(0, 24) ?? "" } });
  const state = room.state;
  if (!state) return <div className="mx-auto max-w-lg space-y-6">
    <Link href="/mini-games/kana-word-race" className="inline-flex items-center gap-2 text-sm font-bold underline"><ArrowLeft className="size-4" />Kana Word Race</Link>
    <section className="race-panel p-6 sm:p-8"><p className="race-eyebrow">Room {code}</p><h1 className="mt-3 text-3xl font-black">Siap adu tebakan?</h1><p className="my-5 text-sm leading-6">Pakai nickname yang mudah dikenali temanmu. Guest bisa langsung bergabung.</p>
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
    </section>
  </div>;
  const connected = room.status === "online" && !state.closed;
  const disabled = !connected || room.pending;
  const match = state.match;
  const own = state.members.find((member) => member.id === state.viewer.memberId);
  const seconds = match ? Math.max(0, Math.ceil((match.endsAt - room.now) / 1000)) : 0;
  const command = (type: "start" | "rematch" | "close") => room.send(type === "start"
    ? { type, roomId: state.roomId, requestId: crypto.randomUUID(), revision: state.revision }
    : { type, roomId: state.roomId, requestId: crypto.randomUUID() });
  return <div className="space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4" href="/mini-games/kana-word-race"><ArrowLeft className="size-4" />Kana Word Race</Link><h1 className="mt-4 text-3xl font-black sm:text-4xl">{results ? "HASIL BALAPAN." : match ? "KEJAR KATANYA." : "KUMPULKAN TEMANMU."}</h1></div>
      <div className="race-panel px-4 py-3"><p className="race-eyebrow">Kode room</p><div className="mt-1 flex items-center gap-3"><strong className="font-mono text-xl tracking-widest">{code}</strong><button type="button" aria-label="Salin link undangan room" onClick={async () => {
        try { await navigator.clipboard.writeText(`${location.origin}/mini-games/kana-word-race/room/${code}`); setCopied(true); setTimeout(() => setCopied(false), 2500); }
        catch { setError("Salin alamat room dari bilah browser untuk mengundang teman."); }
      }}>{copied ? <Check className="size-5" /> : <Copy className="size-5" />}</button></div><span role="status" className="text-xs">{copied ? "Link disalin" : "Bagikan ke temanmu"}</span></div>
    </header>
    {!results && <div role="status" className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold"><span>{state.closed ? "Room ditutup. Hasil tetap tersedia selama retensi." : connected ? "Terhubung · progres tersinkron" : room.status === "closed" ? "Koneksi berakhir. Muat ulang untuk memeriksa akses." : "Menghubungkan kembali... Tebakan diterima akan dipulihkan."}</span>{!connected && !state.closed && <Button size="sm" variant="outline" onClick={() => { location.reload(); }}>Muat ulang</Button>}</div>}
    {(room.error || error) && <p role="alert" className="race-notice">{room.error || error}</p>}
    {!match && !state.closed && <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Settings key={state.revision} state={state} disabled={disabled} send={room.send} />
      <section className="race-panel p-5 sm:p-7"><h2 className="flex items-center gap-2 text-xl font-black"><Users className="size-5" />Pemain ({state.members.length}/20)</h2>
        <ul className="my-5 divide-y-2 divide-current/15">{state.members.map((member) => <li key={member.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate font-bold">{member.nickname}{member.id === state.viewer.memberId ? " (kamu)" : ""}</span><span className="shrink-0 text-xs">{room.online.includes(member.id) ? "● " : "○ "}{member.ready ? "Siap" : "Belum siap"}</span></li>)}</ul>
        <Button className="race-button w-full" disabled={disabled} onClick={() => room.send({ type: "ready", roomId: state.roomId, requestId: crypto.randomUUID(), revision: state.revision, ready: !own?.ready })}>{own?.ready ? "Batalkan siap" : "Saya siap"}</Button>
        {state.viewer.host && <Button className="race-button race-button-paper mt-3 w-full" disabled={disabled || state.members.length < 2 || state.members.some((member) => !member.ready)} onClick={() => command("start")}>Mulai Balapan</Button>}
        <p className="mt-4 text-xs leading-6 opacity-75">Minimal dua pemain dan semua harus siap. Setelah mulai, peserta baru menunggu hingga host kembali ke lobby.</p>
      </section>
    </div>}
    {match && match.phase !== "FINISHED" && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="race-panel min-w-0 p-3 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3 border-b-2 border-current/15 pb-4"><div><p className="race-eyebrow">Ronde {match.round + 1}/{match.count} · {match.length} kana</p><p className="mt-1 text-sm font-bold">{match.phase === "COUNTDOWN" ? "Bersiap..." : match.phase === "REVEAL" ? "Jawaban dibuka bersama" : STATUS[match.status ?? "PLAYING"]}</p></div><span className="flex items-center gap-2 font-mono text-2xl font-black tabular-nums" aria-label={`Sisa waktu ${seconds} detik`}><Timer className="size-5" />{seconds}s</span></div>
        {match.category && <p className="mb-5 text-center text-sm">Kategori: <strong>{match.category}</strong></p>}
        <RaceBoard key={`${match.id}:${match.round}`} match={match} enabled={connected && match.phase === "PLAYING" && match.status === "PLAYING" && seconds > 0} pending={room.pending} onGuess={(kana) => room.send({ type: "guess", roomId: state.roomId, requestId: crypto.randomUUID(), matchId: match.id, round: match.round, kana })} />
        {match.status === "SOLVED" && match.phase === "PLAYING" && <p role="status" className="race-notice mt-5">Tepat! Tunggu temanmu menyelesaikan tebakan mereka.</p>}
        {match.reveal && <section aria-live="polite" className="race-notice mt-5"><p className="race-eyebrow">Kata ronde ini</p><h2 className="mt-2 text-3xl font-black" lang="ja">{match.reveal.kana}</h2><Sources sources={match.reveal.sources} /></section>}
      </div><RaceLeaderboard state={state} />
    </div>}
    {match?.phase === "FINISHED" && <><RaceResults state={state} /><div className="flex flex-wrap gap-4">{state.viewer.host && !results && !state.closed && <Button className="race-button" disabled={disabled} onClick={() => command("rematch")}><RotateCcw className="size-4" />Kembali ke lobby</Button>}{!results && <Link className="race-button race-button-paper" href={`/mini-games/kana-word-race/room/${code}/results/${match.id}`}>Buka hasil tersimpan</Link>}{results && <Link className="race-button" href={`/mini-games/kana-word-race/room/${code}`}>Kembali ke room</Link>}</div></>}
    {state.viewer.host && !results && !state.closed && <div className="border-t-2 border-current/15 pt-5">{confirmClose ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm">Tutup room untuk semua pemain?</p><Button variant="destructive" disabled={disabled} onClick={() => command("close")}>Tutup sekarang</Button><Button variant="outline" onClick={() => setConfirmClose(false)}>Batal</Button></div> : <button className="text-xs font-bold underline underline-offset-4" type="button" onClick={() => setConfirmClose(true)}>Tutup room</button>}</div>}
  </div>;
}
