"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Copy, DoorClosed, Flag, Link2, Play, RotateCcw, Settings2, Swords, Ticket, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { closeClashRoomAction, configureClashRoomAction, joinClashRoomAction, readyClashRoomAction, startClashMatchAction, participateClashRoomAction } from "../actions";
import { ClashJoinSchema } from "../schemas";
import type { ClashRoomSnapshot } from "../contracts";
import type { ClashCatalogEntry } from "../server/catalog";
import { useClashRoom } from "./use-clash-room";
import { ClashConfiguration } from "./configuration";
import { ClashAvatar, ClashButton, ClashFinish, ClashLeaderboard, ClashMemberList } from "./arena-ui";
import { ClashArena } from "./arena";

type StateResult = { ok: true; data: ClashRoomSnapshot } | { ok: false; code?: string; message: string };

export function ClosedClashRoom() {
  return <section className="clash-panel mx-auto max-w-2xl overflow-hidden text-center" aria-labelledby="closed-title">
    <div className="flex items-center justify-between border-b-[3px] border-neo-ink bg-neo-paper px-5 py-3"><span className="clash-label">Arena ditutup</span><Flag className="size-4" /></div>
    <div className="px-5 py-12 sm:px-10"><span className="mx-auto grid size-20 -rotate-6 place-items-center rounded border-[3px] border-neo-ink bg-neo-yellow shadow-neo"><DoorClosed className="size-10" /></span>
      <h1 id="closed-title" className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">Sampai jumpa di<br />arena berikutnya.</h1>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-neo-ink/70">Room sudah ditutup atau kedaluwarsa. Buka tantangan baru dan ajak rivalmu kembali.</p>
      <Link href="/mini-games/kotoba-clash" className="clash-button mt-7" data-tone="yellow">Kembali ke Kotoba Clash<ArrowRight className="size-4" /></Link>
    </div>
  </section>;
}

export function ClashRoom({ code, initial, initialError, catalog, unavailable = false }: {
  code: string; initial: ClashRoomSnapshot | null; initialError: string | null; catalog: ClashCatalogEntry[]; unavailable?: boolean;
}) {
  const live = useClashRoom(initial);
  const { state } = live;
  const [message, setMessage] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [terminal, setTerminal] = useState(unavailable);
  const router = useRouter();
  const join = useForm({ resolver: zodResolver(ClashJoinSchema), defaultValues: { code, nickname: "" } });
  const nickname = useWatch({ control: join.control, name: "nickname" });
  async function run(work: () => Promise<StateResult>) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await work();
      if (result.ok) live.accept(result.data);
      else if (result.code && ["CLOSED", "EXPIRED"].includes(result.code)) {
        setTerminal(true);
        if (state) live.accept({ ...state, closed: true, serverNow: live.now });
      } else setMessage(result.message);
    } catch { setMessage("Koneksi gagal. Coba lagi; jawaban yang sudah tersimpan tetap aman."); }
    finally { setBusy(false); }
  }
  async function copy(kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(kind === "code" ? code : new URL(`/mini-games/kotoba-clash/room/${code}`, window.location.origin).href);
      setMessage(kind === "code" ? "Kode room disalin." : "Link undangan disalin. Bagikan ke temanmu.");
    } catch { setMessage("Clipboard tidak tersedia. Salin alamat halaman ini untuk membagikan undangan."); }
  }

  if (terminal || state?.closed) return <div className="py-5 sm:py-10"><ClosedClashRoom /></div>;

  if (!state) return <div className="mx-auto grid max-w-4xl items-center gap-8 py-4 md:grid-cols-[0.8fr_1.2fr] md:gap-12 md:py-8">
    <div><Link href="/mini-games/kotoba-clash" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4"><ArrowLeft className="size-4" />Kotoba Clash</Link>
      <div className="mt-8 hidden md:block"><span className="clash-sticker"><Swords className="size-5" />TANTANGAN DITERIMA?</span><h1 className="mt-6 text-5xl leading-[1.05] font-black tracking-tight">Rivalmu<br />menunggu.</h1><p className="mt-5 max-w-xs text-sm leading-7 text-neo-ink/70">Satu nickname untuk masuk arena. Sisanya, biarkan jawabanmu yang bicara.</p></div>
    </div>
    <section className="clash-panel overflow-hidden" aria-labelledby="join-title">
      <div className="clash-section-heading bg-neo-yellow"><span className="clash-section-icon"><Ticket className="size-6" /></span><div><p className="clash-label">Tiket masuk arena</p><h2 id="join-title" className="mt-1 text-2xl font-black">Gabung room</h2></div></div>
      <div className="p-5 sm:p-7"><div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-neo-ink/30 pb-5"><div><p className="clash-label">Kode undangan</p><p className="mt-2 font-mono text-xl font-black tracking-[0.15em] sm:text-2xl">{code}</p></div><ClashAvatar nickname={nickname || "?"} large /></div>
        <form className="mt-6 space-y-4" onSubmit={join.handleSubmit((values) => run(() => joinClashRoomAction(values)))}>
          <label htmlFor="guest-nickname" className="block text-sm font-extrabold">Nickname di arena</label>
          <Input id="guest-nickname" className="clash-input" placeholder="Nama yang akan mereka ingat" autoComplete="nickname" maxLength={24} {...join.register("nickname")} aria-invalid={Boolean(join.formState.errors.nickname)} />
          {join.formState.errors.nickname && <p role="alert" className="text-sm">Gunakan 2-24 huruf, angka, spasi, titik, garis, atau underscore.</p>}
          <ClashButton type="submit" tone="yellow" disabled={busy} className="w-full">{busy ? "Bergabung..." : "Gabung Room"}<ArrowRight className="size-5" /></ClashButton>
        </form>
        <p className="mt-5 text-xs leading-6 text-neo-ink/70">Nickname terlihat oleh peserta. Jika pertandingan sudah dimulai, kamu masuk sebagai penonton dan bisa ikut match berikutnya.</p>
        <details className="mt-4 border-t-2 border-neo-ink/15 pt-4 text-xs leading-6 text-neo-ink/65"><summary className="cursor-pointer font-bold">Tentang sesi guest & privasi</summary><p className="mt-2">Guest memakai cookie penting selama 7 hari untuk kembali ke room. Detail pertandingan disimpan hingga 7 hari setelah selesai. <Link className="font-bold underline" href="/privacy">Kebijakan privasi</Link>.</p></details>
        {message && <p role="alert" className="mt-5 border-2 border-neo-ink bg-orange-50 p-3 text-sm font-bold">{message}</p>}
      </div>
    </section>
  </div>;

  const active = Boolean(state.match && state.match.phase.type !== "FINISHED");
  const players = state.members.filter((member) => !member.spectating);
  const connectedPlayers = players.filter((member) => live.online.includes(member.id));
  const self = state.members.find((member) => member.id === state.viewer.memberId);
  const online = live.status === "online";
  const canStart = Boolean(state.config && connectedPlayers.length >= 2 && connectedPlayers.every((member) => member.ready));
  const readyCount = connectedPlayers.filter((member) => member.ready).length;
  const statusText = { connecting: "Menyambungkan...", online: "Terhubung", reconnecting: "Menyambungkan kembali...", replaced: "Room dibuka di tab lain", closed: "Koneksi ditutup" }[live.status];

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><Link href="/mini-games/kotoba-clash" className="inline-flex items-center gap-2 text-xs font-bold underline underline-offset-4"><ArrowLeft className="size-3.5" />Kotoba Clash</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-black tracking-tight sm:text-4xl">{active ? "Saatnya adu cepat." : state.match ? "Satu ronde lagi?" : "Ruang pemanasan."}</h1><span className="clash-tag font-mono tracking-wider">{code}</span></div>
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-neo-ink/65" role="status"><span className="clash-status-dot" data-online={online} aria-hidden="true" />{statusText}{state.viewer.isHost ? " / Kamu host" : state.viewer.spectating ? " / Penonton" : ""}</p>
      </div>
      <div className="flex flex-wrap gap-3"><ClashButton onClick={() => copy("code")}><Copy className="size-4" />Kode</ClashButton><ClashButton tone="blue" onClick={() => copy("link")}><Link2 className="size-4" />Link undangan</ClashButton></div>
    </header>
    {(message || live.error) && <p className="rounded border-2 border-neo-ink bg-neo-yellow/30 p-4 text-sm font-semibold" role="status">{message ?? live.error}</p>}
    {!online && <div className="flex flex-wrap items-center gap-4 rounded border-2 border-neo-ink bg-white p-4"><p className="flex-1 text-xs leading-6">{live.status === "replaced" ? "Sesi aktif ada di tab lain. Sambungkan di sini untuk melanjutkan dari tab ini." : "Jawaban tersimpan tetap aman. Tunggu koneksi realtime sebelum melanjutkan."}</p><ClashButton onClick={live.reconnect}><RotateCcw className="size-4" />Sambungkan kembali</ClashButton>{live.status === "closed" && <ClashButton onClick={() => window.location.reload()}>Muat ulang sesi</ClashButton>}</div>}
    {active && state.match ? <ClashArena state={state} now={live.now} connected={online} pending={live.pendingRound === state.match.round?.id} online={live.online} answer={live.answer} /> : <>
      {state.match && <><div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_23rem]"><ClashFinish match={state.match} members={state.members} /><ClashLeaderboard match={state.match} members={state.members} viewerId={state.viewer.memberId} compact /></div><Link href={`/mini-games/kotoba-clash/room/${code}/results/${state.match.id}`} className="clash-button" data-tone="blue">Hasil & review semua soal<ArrowRight className="size-4" /></Link></>}
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="clash-panel order-2 min-w-0 overflow-hidden lg:order-1"><div className="clash-section-heading bg-neo-yellow"><span className="clash-section-icon"><Settings2 className="size-6" /></span><div><p className="clash-label">{state.match ? "Tanding ulang" : "Atur tantangan"}</p><h2 className="mt-1 text-xl font-black">{state.match ? "Main lagi" : "Pengaturan pertandingan"}</h2></div></div>
          <div className="p-4 sm:p-6">{state.match && <p className="mb-6 text-sm leading-6">Room dan kode tetap sama. Sepakati pengaturan lalu ready kembali.</p>}
            <ClashConfiguration key={state.configRevision} config={state.config} catalog={catalog} disabled={!state.viewer.isHost || busy} save={(config) => run(() => configureClashRoomAction({ roomId: state.id, configRevision: state.configRevision, config }))} />
            {!state.viewer.isHost && <p className="mt-5 border-l-4 border-neo-blue pl-3 text-xs font-bold leading-6">Host mengatur pertandingan. Ready berarti menyetujui pengaturan tersimpan terbaru.</p>}
          </div>
        </section>
        <section className="clash-panel order-1 p-5 lg:sticky lg:top-28 lg:order-2" aria-label="Lobby pemain"><ClashMemberList state={state} online={live.online} />
          <div className="mt-6 border-t-2 border-neo-ink pt-5">
            <div className="mb-4 flex items-center justify-between text-xs font-bold"><span>Kesiapan pemain online</span><span className="font-mono">{readyCount}/{connectedPlayers.length}</span></div>
            <div className="space-y-3">
              {state.viewer.spectating && <ClashButton tone="yellow" className="w-full" disabled={busy || !online} onClick={() => run(() => participateClashRoomAction({ roomId: state.id }))}><Swords className="size-4" />Ikut pertandingan berikutnya</ClashButton>}
              <ClashButton tone={self?.ready ? "white" : "green"} className="w-full" disabled={busy || !state.config || !online || state.viewer.spectating} onClick={() => run(() => readyClashRoomAction({ roomId: state.id, configRevision: state.configRevision, ready: !self?.ready }))}>{self?.ready ? <X className="size-4" /> : <Check className="size-5" />}{self?.ready ? "Batalkan ready" : "Saya Ready"}</ClashButton>
              {state.viewer.isHost && <ClashButton tone="blue" className="w-full" disabled={busy || !online || !canStart} onClick={() => run(() => startClashMatchAction({ roomId: state.id, configRevision: state.configRevision, requestId: crypto.randomUUID() }))}><Play className="size-4 fill-current" />Mulai pertandingan</ClashButton>}
            </div>
            <p className="mt-4 text-xs leading-6 text-neo-ink/65">{!state.config ? "Simpan pengaturan untuk membuka tombol ready." : connectedPlayers.length < 2 ? "Ajak minimal satu rival lagi agar pertandingan bisa dimulai." : !canStart ? "Tunggu semua pemain online ready, termasuk host." : "Semua siap. Host bisa memulai pertandingan."} Mengubah pengaturan mereset ready. Pemain offline tidak masuk roster saat Start.</p>
            {state.viewer.isHost && <div className="mt-5 border-t-2 border-neo-ink/15 pt-4"><ClashButton tone="coral" disabled={busy} className="w-full" onClick={async () => {
              setBusy(true);
              try { const result = await closeClashRoomAction({ roomId: state.id }); if (result.ok) { live.accept({ ...state, closed: true, serverNow: live.now }); router.refresh(); } else setMessage(result.message); }
              catch { setMessage("Room belum dapat ditutup. Coba lagi."); }
              finally { setBusy(false); }
            }}><DoorClosed className="size-4" />Tutup Room</ClashButton></div>}
          </div>
        </section>
      </div>
    </>}
  </div>;
}
