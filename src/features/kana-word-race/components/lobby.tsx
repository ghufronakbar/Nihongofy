"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Play, Save, Settings2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ConfigSchema, type RaceCommand, type RaceSnapshot } from "../contracts";
import { RaceSectionHeading } from "./ui";

type SendCommand = (command: RaceCommand) => void;

function Settings({ state, disabled, send }: { state: RaceSnapshot; disabled: boolean; send: SendCommand }) {
  const form = useForm({ resolver: zodResolver(ConfigSchema), defaultValues: state.config });
  return <form className="race-panel min-w-0 overflow-hidden" onSubmit={form.handleSubmit((config) => send({ type: "configure", roomId: state.roomId, requestId: crypto.randomUUID(), revision: state.revision, config }))}>
    <RaceSectionHeading icon={Settings2} label="Atur tantangan" title={state.config.mode === "solo" ? "Pengaturan latihan" : "Pengaturan balapan"} />
    <div className="p-5 sm:p-6">
    <fieldset disabled={disabled || !state.viewer.host} className="grid gap-6 sm:grid-cols-2 disabled:opacity-70">
      <label className="race-field">Panjang kata<NativeSelect {...form.register("length", { setValueAs: (value: string) => Number(value) })}>
        <NativeSelectOption value={0}>Acak 3-7 kana</NativeSelectOption>{[3, 4, 5, 6, 7].map((length) => <NativeSelectOption key={length} value={length}>{length} kana · {state.stock[String(length)] ?? 0} target</NativeSelectOption>)}
      </NativeSelect></label>
      <label className="race-field">Jumlah ronde<NativeSelect {...form.register("rounds", { setValueAs: (value: string) => Number(value) })}>{[3, 5, 10].map((rounds) => <NativeSelectOption key={rounds} value={rounds}>{rounds} ronde</NativeSelectOption>)}</NativeSelect></label>
      <label className="race-field">Waktu<NativeSelect {...form.register("pace")}><NativeSelectOption value="normal">Normal · 90-150 detik</NativeSelectOption><NativeSelectOption value="relaxed">Santai · tambah 60 detik</NativeSelectOption></NativeSelect></label>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-extrabold"><Controller name="category" control={form.control} render={({ field }) => <Checkbox className="race-check" checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} name={field.name} />} />Tampilkan petunjuk kategori</label>
    </fieldset>
    <p className="mt-5 text-xs leading-6 opacity-75">3-4 kana: 90 detik. 5 kana: 120 detik. 6-7 kana: 150 detik. {state.config.mode === "solo" ? "Simpan perubahan sebelum mulai latihan." : "Setiap perubahan pengaturan meminta semua pemain siap kembali."}</p>
    {Object.keys(form.formState.errors).length > 0 && <p role="alert">Periksa pengaturan permainan.</p>}
    {state.viewer.host && <Button className="race-button mt-5 w-full sm:w-auto" disabled={disabled || !form.formState.isDirty} type="submit"><Save className="size-4" />Simpan pengaturan</Button>}
    </div>
  </form>;
}

export function RaceLobby({ state, disabled, online, send }: {
  state: RaceSnapshot; disabled: boolean; online: string[]; send: SendCommand;
}) {
  const own = state.members.find((member) => member.id === state.viewer.memberId);
  const solo = state.config.mode === "solo";
  return <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <Settings key={`${state.config.mode}:${state.revision}`} state={state} disabled={disabled} send={send} />
      <section className="race-panel min-w-0 p-5 lg:sticky lg:top-28"><div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-black">{solo ? <UserRound className="size-5 shrink-0" /> : <Users className="size-5 shrink-0" />}{solo ? "Sesi solo" : "Line-up pemain"}</h2><span className="race-tag font-mono">{solo ? "1 pemain" : `${state.members.length}/20`}</span></div>
        <ul className="my-5 divide-y-2 divide-neo-ink/20">{state.members.map((member) => <li key={member.id} className="race-member flex items-center gap-3 py-4 text-sm"><span className="race-avatar" aria-hidden="true">{Array.from(member.nickname)[0]?.toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate font-extrabold" title={member.nickname}>{member.nickname}{member.id === state.viewer.memberId ? " (kamu)" : ""}</p><p className="mt-1 flex items-center gap-2 text-xs opacity-70"><span className="race-status-dot" data-online={online.includes(member.id)} />{online.includes(member.id) ? "Terhubung" : "Offline"}{!solo && ` / ${member.ready ? "Siap" : "Belum siap"}`}</p></div></li>)}</ul>
        <div className="border-t-2 border-neo-ink pt-5">{solo ? <><Button className="race-button w-full" data-tone="blue" disabled={disabled || !state.viewer.host} onClick={() => send({ type: "start", roomId: state.roomId, requestId: crypto.randomUUID(), revision: state.revision })}><Play className="size-4 fill-current" />Mulai latihan</Button><p className="mt-4 text-xs leading-6 opacity-75">Enam tebakan per kata. Jawaban dibuka saat kata tertebak, kesempatan habis, atau waktu berakhir. Sesi ini hanya untukmu.</p></> : <><p className="mb-4 flex items-center justify-between text-xs font-bold"><span>Kesiapan pemain</span><span className="font-mono">{state.members.filter((member) => member.ready).length}/{state.members.length}</span></p>
        <Button className="race-button w-full" data-tone="green" disabled={disabled} onClick={() => send({ type: "ready", roomId: state.roomId, requestId: crypto.randomUUID(), revision: state.revision, ready: !own?.ready })}><Check className="size-4" />{own?.ready ? "Batalkan siap" : "Saya siap"}</Button>
        {state.viewer.host && <Button className="race-button mt-3 w-full" data-tone="blue" disabled={disabled || state.members.length < 2 || state.members.some((member) => !member.ready)} onClick={() => send({ type: "start", roomId: state.roomId, requestId: crypto.randomUUID(), revision: state.revision })}><Play className="size-4 fill-current" />Mulai Balapan</Button>}
        <p className="mt-4 text-xs leading-6 opacity-75">Minimal dua pemain dan semua harus siap. Setelah mulai, peserta baru menunggu hingga host kembali ke lobby.</p></>}
        </div>
      </section>
    </div>;
}
