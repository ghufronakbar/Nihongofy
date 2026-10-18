"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Copy, DoorClosed, Flag, Link2, RotateCcw, Swords, Ticket, UserMinus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { closeClashRoomAction, joinClashRoomAction } from "../actions";
import { ClashJoinSchema } from "../schemas";
import type { ClashRoomSnapshot } from "../contracts";
import type { ClashCatalogEntry } from "../server/catalog";
import { useClashRoom } from "./use-clash-room";
import { ClashLobby, type ClashStateResult } from "./lobby";
import { clashProfileNickname } from "../profile-nickname";
import { ClashAvatar, ClashButton, ClashFinish, ClashLeaderboard } from "./arena-ui";
import { ClashArena } from "./arena";

export function ClosedClashRoom({ kicked = false }: { kicked?: boolean }) {
  return <section className="clash-panel mx-auto max-w-2xl overflow-hidden text-center" aria-labelledby="closed-title">
    <div className="flex items-center justify-between border-b-[3px] border-neo-ink bg-neo-paper px-5 py-3"><span className="clash-label">{kicked ? "Akses room berakhir" : "Arena ditutup"}</span><Flag className="size-4" /></div>
    <div className="px-5 py-12 sm:px-10"><span className="mx-auto grid size-20 -rotate-6 place-items-center rounded border-[3px] border-neo-ink bg-neo-yellow shadow-neo"><DoorClosed className="size-10" /></span>
      {kicked ? <><UserMinus className="mx-auto mt-6 size-7" /><h1 id="closed-title" className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Kamu dikeluarkan<br />dari room.</h1><p role="alert" className="mx-auto mt-4 max-w-sm text-sm leading-7 text-neo-ink/70">Host telah mengeluarkanmu. Kamu bisa bergabung ke room lain atau membuat tantangan baru.</p></> : <><h1 id="closed-title" className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">Sampai jumpa di<br />arena berikutnya.</h1><p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-neo-ink/70">Room sudah ditutup atau kedaluwarsa. Buka tantangan baru dan ajak rivalmu kembali.</p></>}
      <Link href="/mini-games/kotoba-clash" className="clash-button mt-7" data-tone="yellow">Kembali ke Kotoba Clash<ArrowRight className="size-4" /></Link>
    </div>
  </section>;
}

export function ClashRoom({ code, initial, initialError, catalog, unavailable = false, kicked = false, privateSession = false, displayName }: {
  code: string; initial: ClashRoomSnapshot | null; initialError: string | null; catalog: ClashCatalogEntry[]; unavailable?: boolean; kicked?: boolean; privateSession?: boolean; displayName?: string;
}) {
  const live = useClashRoom(initial, kicked);
  const { state } = live;
  const [message, setMessage] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [terminal, setTerminal] = useState(unavailable);
  const [soloPrivate, setSoloPrivate] = useState(privateSession);
  const router = useRouter();
  const join = useForm({ resolver: zodResolver(ClashJoinSchema), defaultValues: { code, nickname: clashProfileNickname(displayName) } });
  const nickname = useWatch({ control: join.control, name: "nickname" });
  async function run(work: () => Promise<ClashStateResult>, successMessage?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await work();
      if (result.ok) { live.accept(result.data); if (successMessage) setMessage(successMessage); return true; }
      else if (result.code === "KICKED") live.setKicked(true);
      else if (result.code === "SOLO_PRIVATE") setSoloPrivate(true);
      else if (result.code && ["CLOSED", "EXPIRED"].includes(result.code)) {
        setTerminal(true);
        if (state) live.accept({ ...state, closed: true, serverNow: live.now });
      } else setMessage(result.message);
    } catch { setMessage("Koneksi gagal. Coba lagi; jawaban yang sudah tersimpan tetap aman."); }
    finally { setBusy(false); }
    return false;
  }
  async function copy(kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(kind === "code" ? code : new URL(`/mini-games/kotoba-clash/room/${code}`, window.location.origin).href);
      setMessage(kind === "code" ? "Kode room disalin." : "Link undangan disalin. Bagikan ke temanmu.");
    } catch { setMessage("Clipboard tidak tersedia. Salin alamat halaman ini untuk membagikan undangan."); }
  }

  if (live.kicked || terminal || state?.closed) return <div className="py-5 sm:py-10"><ClosedClashRoom kicked={live.kicked} /></div>;
  if (soloPrivate) return <section className="clash-panel mx-auto max-w-xl p-6 sm:p-10"><h1 className="text-3xl font-black">Sesi latihan pribadi</h1><p role="alert" className="mt-4 text-sm leading-7">Sesi solo hanya dapat diakses pemiliknya. Masuk dengan akun pemilik atau buat latihanmu sendiri.</p><Link href="/mini-games/kotoba-clash" className="clash-button mt-6" data-tone="yellow">Kembali ke Kotoba Clash<ArrowRight className="size-4" /></Link></section>;

  if (!state) return <div className="mx-auto grid max-w-4xl items-center gap-8 py-4 md:grid-cols-[0.8fr_1.2fr] md:gap-12 md:py-8">
    <div><Link href="/mini-games/kotoba-clash" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4"><ArrowLeft className="size-4" />Kotoba Clash</Link>
      <div className="mt-8 hidden md:block"><span className="clash-sticker"><Swords className="size-5" />TANTANGAN DITERIMA?</span><h1 className="mt-6 text-5xl leading-[1.05] font-black tracking-tight">Rivalmu<br />menunggu.</h1><p className="mt-5 max-w-xs text-sm leading-7 text-neo-ink/70">Satu nickname untuk masuk arena. Sisanya, biarkan jawabanmu yang bicara.</p></div>
    </div>
    <section className="clash-panel overflow-hidden" aria-labelledby="join-title">
      <div className="clash-section-heading bg-neo-yellow"><span className="clash-section-icon"><Ticket className="size-6" /></span><div><p className="clash-label">Tiket masuk arena</p><h2 id="join-title" className="mt-1 text-2xl font-black">Gabung room</h2></div></div>
      <div className="p-5 sm:p-7"><div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-neo-ink/30 pb-5"><div><p className="clash-label">Kode undangan</p><p className="mt-2 font-mono text-xl font-black tracking-[0.15em] sm:text-2xl">{code}</p></div><ClashAvatar nickname={nickname || "?"} large /></div>
        <form className="mt-6 space-y-4" onSubmit={join.handleSubmit(async (values) => { await run(() => joinClashRoomAction(values)); })}>
          <label htmlFor="guest-nickname" className="block text-sm font-extrabold">Nickname di arena</label>
          <Input id="guest-nickname" className="clash-input" placeholder="Nama yang akan mereka ingat" autoComplete="nickname" defaultValue={clashProfileNickname(displayName)} maxLength={24} {...join.register("nickname")} aria-invalid={Boolean(join.formState.errors.nickname)} />
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
  const solo = state.mode === "solo";
  const online = live.status === "online";
  const statusText = { connecting: "Menyambungkan...", online: "Terhubung", reconnecting: "Menyambungkan kembali...", replaced: "Room dibuka di tab lain", closed: "Koneksi ditutup" }[live.status];

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><Link href="/mini-games/kotoba-clash" className="inline-flex items-center gap-2 text-xs font-bold underline underline-offset-4"><ArrowLeft className="size-3.5" />Kotoba Clash</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-black tracking-tight sm:text-4xl">{solo ? active ? "Tantang dirimu." : state.match ? "Latihan sekali lagi?" : "Siapkan latihanmu." : active ? "Saatnya adu cepat." : state.match ? "Satu ronde lagi?" : "Ruang pemanasan."}</h1><span className="clash-tag font-mono tracking-wider">{solo ? "SOLO" : code}</span></div>
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-neo-ink/65" role="status"><span className="clash-status-dot" data-online={online} aria-hidden="true" />{statusText}{solo ? " / Sesi pribadi" : state.viewer.isHost ? " / Kamu host" : state.viewer.spectating ? " / Penonton" : ""}</p>
      </div>
      {!solo && <div className="flex flex-wrap gap-3"><ClashButton onClick={() => copy("code")}><Copy className="size-4" />Kode</ClashButton><ClashButton tone="blue" onClick={() => copy("link")}><Link2 className="size-4" />Link undangan</ClashButton></div>}
    </header>
    {(message || live.error) && <p className="rounded border-2 border-neo-ink bg-neo-yellow/30 p-4 text-sm font-semibold" role="status">{message ?? live.error}</p>}
    {!online && <div className="flex flex-wrap items-center gap-4 rounded border-2 border-neo-ink bg-white p-4"><p className="flex-1 text-xs leading-6">{live.status === "replaced" ? "Sesi aktif ada di tab lain. Sambungkan di sini untuk melanjutkan dari tab ini." : "Jawaban tersimpan tetap aman. Tunggu koneksi realtime sebelum melanjutkan."}</p><ClashButton onClick={live.reconnect}><RotateCcw className="size-4" />Sambungkan kembali</ClashButton>{live.status === "closed" && <ClashButton onClick={() => window.location.reload()}>Muat ulang sesi</ClashButton>}</div>}
    {active && state.match ? <ClashArena state={state} now={live.now} connected={online} pending={live.pendingRound === state.match.round?.id} online={live.online} answer={live.answer} /> : <>
      {state.match && <><div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_23rem]"><ClashFinish match={state.match} members={state.members} solo={solo} /><ClashLeaderboard match={state.match} members={state.members} viewerId={state.viewer.memberId} compact solo={solo} /></div><Link href={`/mini-games/kotoba-clash/room/${code}/results/${state.match.id}`} className="clash-button" data-tone="blue">Hasil & review semua soal<ArrowRight className="size-4" /></Link></>}
      <ClashLobby key={state.configRevision} state={state} catalog={catalog} online={live.online} connected={online} busy={busy} run={run} close={async () => {
        setBusy(true);
        try { const result = await closeClashRoomAction({ roomId: state.id }); if (result.ok) { live.accept({ ...state, closed: true, serverNow: live.now }); router.refresh(); } else setMessage(result.message); }
        catch { setMessage("Room belum dapat ditutup. Coba lagi."); }
        finally { setBusy(false); }
      }} />
    </>}
  </div>;
}
