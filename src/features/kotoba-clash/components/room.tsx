"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Crown, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { closeClashRoomAction, configureClashRoomAction, joinClashRoomAction, readyClashRoomAction, startClashMatchAction, participateClashRoomAction } from "../actions";
import { ClashJoinSchema } from "../schemas";
import type { ClashRoomSnapshot } from "../contracts";
import type { ClashCatalogEntry } from "../server/catalog";
import { useClashRoom } from "./use-clash-room";
import { ClashConfiguration } from "./configuration";
import { ClashRound } from "./round";

type StateResult = { ok: true; data: ClashRoomSnapshot } | { ok: false; message: string };

export function ClashRoom({ code, initial, initialError, catalog }: {
  code: string; initial: ClashRoomSnapshot | null; initialError: string | null; catalog: ClashCatalogEntry[];
}) {
  const live = useClashRoom(initial);
  const { state } = live;
  const [message, setMessage] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const join = useForm({ resolver: zodResolver(ClashJoinSchema), defaultValues: { code, nickname: "" } });
  async function run(work: () => Promise<StateResult>) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await work();
      if (result.ok) live.accept(result.data);
      else setMessage(result.message);
    } catch { setMessage("Koneksi gagal. Coba lagi; jawaban yang sudah tersimpan tetap aman."); }
    finally { setBusy(false); }
  }
  async function copy(kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(kind === "code" ? code : new URL(`/mini-games/kotoba-clash/room/${code}`, window.location.origin).href);
      setMessage(kind === "code" ? "Kode room disalin." : "Link undangan disalin. Bagikan ke temanmu.");
    } catch { setMessage("Clipboard tidak tersedia. Salin alamat halaman ini untuk membagikan undangan."); }
  }

  if (!state) return <div className="mx-auto max-w-lg py-8">
    <Link href="/mini-games/kotoba-clash" className="text-sm font-bold underline">Tentang Kotoba Clash</Link>
    <section className="neo-surface mt-6 bg-neo-yellow p-7">
      <h1 className="text-3xl font-black">Gabung room</h1><p className="mt-3 font-mono text-2xl font-bold tracking-widest">{code}</p>
      <form className="mt-6 space-y-4" onSubmit={join.handleSubmit((values) => run(() => joinClashRoomAction(values)))}>
        <label htmlFor="guest-nickname" className="block font-bold">Nickname</label>
        <Input id="guest-nickname" autoComplete="nickname" maxLength={24} {...join.register("nickname")} aria-invalid={Boolean(join.formState.errors.nickname)} />
        {join.formState.errors.nickname && <p role="alert" className="text-sm">Gunakan 2-24 huruf, angka, spasi, titik, garis, atau underscore.</p>}
        <Button type="submit" disabled={busy} className="neo-button h-auto w-full bg-white py-3 text-neo-ink">{busy ? "Bergabung..." : "Gabung Room"}</Button>
      </form>
      <p className="mt-5 text-sm leading-6">Nickname terlihat oleh peserta room. Jika pertandingan sudah dimulai, Anda masuk sebagai penonton.</p>
      <p className="mt-3 text-sm leading-6">Guest memakai cookie penting selama 7 hari untuk kembali ke room. Detail pertandingan disimpan hingga 7 hari setelah selesai. <Link className="underline" href="/privacy">Kebijakan privasi</Link>.</p>
      {message && <p role="alert" className="mt-5 font-bold">{message}</p>}
    </section>
  </div>;

  const active = state.match && state.match.phase.type !== "FINISHED";
  const players = state.members.filter((member) => !member.spectating);
  const connectedPlayers = players.filter((member) => live.online.includes(member.id));
  const self = state.members.find((member) => member.id === state.viewer.memberId);
  const online = live.status === "online";
  const canStart = Boolean(state.config && connectedPlayers.length >= 2 && connectedPlayers.every((member) => member.ready));
  const statusText = { connecting: "Menyambungkan...", online: "Terhubung", reconnecting: "Menyambungkan kembali...", replaced: "Room dibuka di tab lain", closed: "Koneksi ditutup" }[live.status];

  return <div className="space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div><Link href="/mini-games/kotoba-clash" className="text-sm font-bold underline">Kotoba Clash</Link><h1 className="mt-3 text-3xl font-black sm:text-4xl">ROOM <span className="font-mono tracking-wide">{code}</span></h1><p className="mt-2 text-sm" role="status">{statusText}{state.viewer.isHost ? " / Anda host" : ""}</p></div>
      <div className="flex flex-wrap gap-3"><Button variant="outline" className="neo-button h-auto bg-white py-2 text-neo-ink" onClick={() => copy("code")}><Copy />Kode</Button><Button className="neo-button h-auto bg-neo-blue py-2 text-neo-ink" onClick={() => copy("link")}><Copy />Link undangan</Button></div>
    </header>
    {(message || live.error) && <p className="border-2 border-neo-ink bg-neo-yellow/30 p-4 font-semibold" role="status">{message ?? live.error}</p>}
    {!online && !state.closed && <div className="flex flex-wrap items-center gap-4 border-l-4 border-neo-coral pl-4"><p className="text-sm">Jawaban dapat dikirim setelah koneksi realtime tersambung.</p><Button variant="outline" onClick={live.reconnect}>Sambungkan kembali</Button>{live.status === "closed" && <Button variant="outline" onClick={() => window.location.reload()}>Muat ulang sesi</Button>}</div>}
    {state.closed ? <section className="neo-surface bg-white p-8"><h2 className="text-2xl font-black">Room sudah ditutup atau kedaluwarsa.</h2><Link href="/mini-games/kotoba-clash" className="neo-button mt-6 bg-neo-yellow">Kembali ke Kotoba Clash</Link></section> : <>
      {active && state.match && <ClashRound match={state.match} now={live.now} connected={online} pending={live.pendingRound === state.match.round?.id} answer={live.answer} />}
      {state.match && <section className="neo-surface overflow-hidden bg-white" aria-labelledby="leaderboard-title">
        <div className="bg-neo-green p-5"><h2 id="leaderboard-title" className="text-2xl font-black">{active ? "Peringkat sementara" : "Hasil pertandingan"}</h2><p className="mt-2 text-sm">{active ? "Poin ronde aktif baru terbuka saat reveal." : `Pemenang: ${state.match.leaderboard.filter((player) => player.rank === 1).map((player) => player.nickname).join(", ")}. Selamat!`}</p>{!active && <Link href={`/mini-games/kotoba-clash/room/${code}/results/${state.match.id}`} className="mt-3 inline-block text-sm font-bold underline">Lihat hasil dan review semua soal</Link>}</div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b-2 border-neo-ink"><th className="p-4">Rank</th><th className="p-4">Pemain</th><th className="p-4">Poin</th><th className="p-4">Benar</th><th className="p-4">Streak terbaik</th></tr></thead><tbody>{state.match.leaderboard.map((player) => <tr key={player.playerId} className={cn(player.memberId === state.viewer.memberId && "bg-neo-yellow/25")}><td className="p-4 font-mono font-bold">#{player.rank}</td><td className="p-4 font-bold">{player.nickname}{player.memberId === state.viewer.memberId ? " (Anda)" : ""}</td><td className="p-4 font-mono font-black">{player.score.toLocaleString("id-ID")}</td><td className="p-4">{player.correctCount}</td><td className="p-4">{player.bestStreak}</td></tr>)}</tbody></table></div>
      </section>}
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
        {!active && <section className="neo-surface bg-white p-5 sm:p-8"><h2 className="mb-6 flex items-center gap-3 text-2xl font-black"><Swords />{state.match ? "Main lagi" : "Pengaturan pertandingan"}</h2>{state.match && <p className="mb-6 text-sm leading-7">Link room tetap sama. Periksa pengaturan dan ready kembali untuk pertandingan baru.</p>}
          <ClashConfiguration key={state.configRevision} config={state.config} catalog={catalog} disabled={!state.viewer.isHost || busy} save={(config) => run(() => configureClashRoomAction({ roomId: state.id, configRevision: state.configRevision, config }))} />
          {!state.viewer.isHost && <p className="mt-5 text-sm font-bold">Host mengatur pertandingan. Ready berarti menyetujui pengaturan tersimpan terbaru.</p>}
        </section>}
        <section className={cn("neo-surface bg-white p-5 sm:p-6", active && "lg:col-span-2")} aria-labelledby="members-title">
          <h2 id="members-title" className="text-xl font-black">Peserta / {players.length} pemain</h2>
          <ul className={cn("mt-5 space-y-4", active && "sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0 lg:grid-cols-4")}>
            {state.members.map((member) => <li key={member.id} className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-bold break-words">{member.isHost && <Crown className="size-4 shrink-0" aria-label="Host" />}{member.nickname}{member.id === state.viewer.memberId ? " (Anda)" : ""}</p><p className="mt-1 text-xs text-foreground/70">{live.online.includes(member.id) ? "Terhubung" : "Offline"}{member.spectating ? " / Penonton" : member.ready ? " / Ready" : " / Belum ready"}</p></div></li>)}
          </ul>
          {!active && <div className="mt-7 space-y-4 border-t-2 border-neo-ink pt-5">
            {state.viewer.spectating && <Button className="neo-button h-auto w-full bg-neo-yellow py-3 text-neo-ink" disabled={busy || !online} onClick={() => run(() => participateClashRoomAction({ roomId: state.id }))}>Ikut pertandingan berikutnya</Button>}
            <Button className={cn("neo-button h-auto w-full py-3 text-neo-ink", self?.ready ? "bg-white" : "bg-neo-green")} disabled={busy || !state.config || !online || state.viewer.spectating} onClick={() => run(() => readyClashRoomAction({ roomId: state.id, configRevision: state.configRevision, ready: !self?.ready }))}>{self?.ready ? "Batalkan ready" : "Saya Ready"}</Button>
            {state.viewer.isHost && <Button className="neo-button h-auto w-full bg-neo-blue py-3 text-neo-ink" disabled={busy || !online || !canStart} onClick={() => run(() => startClashMatchAction({ roomId: state.id, configRevision: state.configRevision, requestId: crypto.randomUUID() }))}>Mulai pertandingan</Button>}
            <p className="text-xs leading-6 text-foreground/65">Minimal 2 pemain terhubung, termasuk host. Pemain offline tidak masuk roster saat Start. Mengubah pengaturan akan mereset ready semua pemain.</p>
            {state.viewer.isHost && <Button variant="outline" disabled={busy} className="w-full" onClick={async () => {
              setBusy(true);
              try { const result = await closeClashRoomAction({ roomId: state.id }); if (result.ok) router.push("/mini-games/kotoba-clash"); else setMessage(result.message); }
              catch { setMessage("Room belum dapat ditutup. Coba lagi."); }
              finally { setBusy(false); }
            }}>Tutup room</Button>}
          </div>}
        </section>
      </div>
    </>}
  </div>;
}
