"use client";

import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, DoorClosed, Pencil, Play, Save, Settings2, Swords, UserMinus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { configureClashRoomAction, kickClashMemberAction, participateClashRoomAction, readyClashRoomAction, renameClashMemberAction, startClashMatchAction } from "../actions";
import { ClashConfigSchema, ClashRenameSchema, type ClashConfig } from "../schemas";
import type { ClashRoomSnapshot } from "../contracts";
import type { ClashCatalogEntry } from "../server/catalog";
import { ClashConfiguration, defaultClashConfig, hasClashConfigChanges } from "./configuration";
import { ClashButton, ClashMemberList } from "./arena-ui";

export type ClashStateResult = { ok: true; data: ClashRoomSnapshot } | { ok: false; code?: string; message: string };
type Run = (work: () => Promise<ClashStateResult>, successMessage?: string) => Promise<boolean>;

function ClashNicknameEditor({ roomId, nickname, busy, online, run }: {
  roomId: string; nickname: string; busy: boolean; online: boolean; run: Run;
}) {
  const id = useId();
  const form = useForm({ resolver: zodResolver(ClashRenameSchema), defaultValues: { roomId, nickname } });
  return <form className="mt-5 border-t-2 border-neo-ink/20 pt-4" onSubmit={form.handleSubmit(async (values) => {
    if (await run(() => renameClashMemberAction(values), "Nickname di room berhasil diubah.")) form.reset(values);
  })}>
    <label htmlFor={id} className="flex items-center gap-2 text-xs font-extrabold"><Pencil className="size-3.5" />Nickname kamu</label>
    <div className="mt-2 flex gap-2"><Input id={id} className="clash-input min-w-0 flex-1" autoComplete="nickname" defaultValue={nickname} maxLength={24} disabled={busy || !online} aria-invalid={Boolean(form.formState.errors.nickname)} {...form.register("nickname")} />
      <ClashButton type="submit" disabled={busy || !online || !form.formState.isDirty} aria-label="Simpan nickname"><Check className="size-4" /></ClashButton></div>
    {form.formState.errors.nickname && <p role="alert" className="mt-2 text-xs font-bold">Gunakan 2-24 huruf, angka, spasi, titik, garis, atau underscore.</p>}
    <p className="mt-2 text-xs leading-5 text-neo-ink/65">Bisa diubah sebelum tanding dan setelah selesai. Nama profil tetap.</p>
  </form>;
}

export function ClashLobby({ state, catalog, online, connected, busy, run, close }: {
  state: ClashRoomSnapshot; catalog: ClashCatalogEntry[]; online: string[]; connected: boolean; busy: boolean; run: Run; close: () => Promise<void>;
}) {
  const formId = useId();
  const form = useForm<ClashConfig>({ resolver: zodResolver(ClashConfigSchema), defaultValues: defaultClashConfig(state.config, catalog) });
  const draft: ClashConfig = {
    jlptLevel: useWatch({ control: form.control, name: "jlptLevel" }),
    mondaiTypes: useWatch({ control: form.control, name: "mondaiTypes" }),
    questionCount: useWatch({ control: form.control, name: "questionCount" }),
  };
  const dirty = hasClashConfigChanges(state.config, draft);
  const unsaved = state.viewer.isHost && dirty;
  const total = catalog.filter((row) => row.jlptLevel === draft.jlptLevel && draft.mondaiTypes?.includes(row.mondaiType)).reduce((sum, row) => sum + row.count, 0);
  const self = state.members.find((member) => member.id === state.viewer.memberId);
  const players = state.members.filter((member) => !member.spectating && online.includes(member.id));
  const readyCount = players.filter((member) => member.ready).length;
  const canStart = Boolean(state.config && players.length >= 2 && players.every((member) => member.ready));
  const [kickTarget, setKickTarget] = useState<ClashRoomSnapshot["members"][number] | null>(null);
  return <div className={cn("grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_21rem]", unsaved && "pb-24 lg:pb-0")}>
    <section className="clash-panel order-2 min-w-0 overflow-hidden lg:order-1">
      <div className="clash-section-heading bg-neo-yellow"><span className="clash-section-icon"><Settings2 className="size-6" /></span><div><p className="clash-label">{state.match ? "Tanding ulang" : "Atur tantangan"}</p><h2 className="mt-1 text-xl font-black">{state.match ? "Main lagi" : "Pengaturan pertandingan"}</h2></div></div>
      <div className="p-4 sm:p-6">
        {unsaved && <div role="alert" className="mb-6 flex gap-3 border-[3px] border-neo-ink bg-neo-yellow/40 p-4 shadow-neo-sm"><AlertTriangle className="size-5 shrink-0" /><div><p className="text-sm font-black">{state.config ? "Perubahan belum disimpan" : "Pengaturan belum disimpan"}</p><p className="mt-1 text-xs leading-6">{state.config ? "Room masih memakai pengaturan sebelumnya." : "Simpan tantanganmu agar pemain bisa ready."} Gunakan tombol Simpan pengaturan di panel pemain.</p></div></div>}
        {state.match && <p className="mb-6 text-sm leading-6">Room dan kode tetap sama. Sepakati pengaturan lalu ready kembali.</p>}
        <ClashConfiguration form={form} formId={formId} catalog={catalog} disabled={!state.viewer.isHost || busy || !connected} save={async (config) => {
          await run(() => configureClashRoomAction({ roomId: state.id, configRevision: state.configRevision, config }), "Pengaturan terbaru sudah dipakai. Semua pemain perlu ready kembali.");
        }} />
        {!state.viewer.isHost && <p className="mt-5 border-l-4 border-neo-blue pl-3 text-xs font-bold leading-6">Host mengatur pertandingan. Ready berarti menyetujui pengaturan tersimpan terbaru.</p>}
      </div>
    </section>
    <section className="clash-panel order-1 p-5 lg:sticky lg:top-28 lg:order-2 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto" aria-label="Lobby pemain">
      {state.viewer.isHost && <div className="mb-5 border-b-2 border-neo-ink pb-5">
        <div role="status" className="mb-3 flex items-start gap-2 text-xs leading-5 font-bold">{unsaved ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}<span>{unsaved ? "Belum disimpan. Simpan perubahan sebelum ready atau mulai." : "Pengaturan terbaru sudah dipakai."}</span></div>
        <ClashButton form={formId} type="submit" tone="yellow" className={cn("w-full", unsaved && "max-lg:fixed max-lg:right-5 max-lg:bottom-5 max-lg:left-5 max-lg:z-30 max-lg:w-auto")} disabled={busy || !connected || !dirty || total < draft.questionCount || !draft.mondaiTypes.length}><Save className="size-4" />{form.formState.isSubmitting ? "Menyimpan..." : "Simpan pengaturan"}</ClashButton>
      </div>}
      <ClashMemberList state={state} online={online} kick={state.viewer.isHost ? setKickTarget : undefined} disabled={busy || !connected} />
      {self && <ClashNicknameEditor key={self.nickname} roomId={state.id} nickname={self.nickname} busy={busy} online={connected} run={run} />}
      <div className="mt-5 border-t-2 border-neo-ink pt-5">
        <div className="mb-4 flex items-center justify-between text-xs font-bold"><span>Kesiapan pemain online</span><span className="font-mono">{readyCount}/{players.length}</span></div>
        <div className="space-y-3">
          {state.viewer.spectating && <ClashButton tone="yellow" className="w-full" disabled={busy || !connected} onClick={() => run(() => participateClashRoomAction({ roomId: state.id }))}><Swords className="size-4" />Ikut pertandingan berikutnya</ClashButton>}
          <ClashButton tone={self?.ready ? "white" : "green"} className="w-full" disabled={busy || !state.config || !connected || state.viewer.spectating || unsaved} onClick={() => run(() => readyClashRoomAction({ roomId: state.id, configRevision: state.configRevision, ready: !self?.ready }))}>{self?.ready ? <X className="size-4" /> : <Check className="size-5" />}{self?.ready ? "Batalkan ready" : "Saya Ready"}</ClashButton>
          {state.viewer.isHost && <ClashButton tone="blue" className="w-full" disabled={busy || !connected || !canStart || unsaved} onClick={() => run(() => startClashMatchAction({ roomId: state.id, configRevision: state.configRevision, requestId: crypto.randomUUID() }))}><Play className="size-4 fill-current" />Mulai pertandingan</ClashButton>}
        </div>
        <p className="mt-4 text-xs leading-6 text-neo-ink/65">{unsaved ? "Simpan perubahan dahulu, lalu ready dengan pengaturan terbaru." : !state.config ? "Tunggu host menyimpan pengaturan untuk membuka tombol ready." : players.length < 2 ? "Ajak minimal satu rival lagi agar pertandingan bisa dimulai." : !canStart ? "Tunggu semua pemain online ready, termasuk host." : "Semua siap. Host bisa memulai pertandingan."} Mengubah pengaturan mereset ready. Pemain offline tidak masuk roster saat Start.</p>
        {state.viewer.isHost && <div className="mt-5 border-t-2 border-neo-ink/15 pt-4"><ClashButton tone="coral" disabled={busy} className="w-full" onClick={close}><DoorClosed className="size-4" />Tutup Room</ClashButton></div>}
      </div>
    </section>
    <AlertDialog open={Boolean(kickTarget)} onOpenChange={(open) => { if (!open && !busy) setKickTarget(null); }}>
      <AlertDialogContent className="clash-ui rounded border-[3px] border-neo-ink bg-neo-paper p-6 text-neo-ink shadow-neo">
        <UserMinus className="size-8" /><AlertDialogTitle className="text-xl font-black">Keluarkan {kickTarget?.nickname}?</AlertDialogTitle>
        <AlertDialogDescription className="text-sm leading-6 text-neo-ink/75">Peserta akan diberi tahu dan tidak bisa masuk lagi ke room ini dengan sesi yang sama. Hasil pertandingan sebelumnya tetap tersimpan.</AlertDialogDescription>
        <div className="mt-2 flex flex-wrap justify-end gap-3"><ClashButton disabled={busy} onClick={() => setKickTarget(null)}>Batal</ClashButton><ClashButton tone="coral" disabled={busy || !connected} onClick={async () => {
          if (kickTarget && await run(() => kickClashMemberAction({ roomId: state.id, memberId: kickTarget.id }), "Peserta telah dikeluarkan dari room.")) setKickTarget(null);
        }}>{busy ? "Mengeluarkan..." : "Keluarkan"}</ClashButton></div>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
