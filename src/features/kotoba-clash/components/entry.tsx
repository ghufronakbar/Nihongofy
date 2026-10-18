"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, DoorOpen, Plus, Ticket, UserRound, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClashButton } from "./arena-ui";
import { createClashRoomAction } from "../actions";
import { ClashCreateSchema, ClashRoomCodeSchema, type ClashMode } from "../schemas";
import { clashProfileNickname } from "../profile-nickname";

const CodeSchema = z.object({ code: ClashRoomCodeSchema });

export function ClashEntry({ authenticated, displayName }: { authenticated: boolean; displayName?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const createRequest = useRef<{ nickname: string; mode: ClashMode; id: string } | null>(null);
  const create = useForm({ resolver: zodResolver(ClashCreateSchema), defaultValues: { nickname: clashProfileNickname(displayName), mode: "multiplayer" } });
  const solo = useWatch({ control: create.control, name: "mode" }) === "solo";
  const join = useForm({ resolver: zodResolver(CodeSchema), defaultValues: { code: "" } });
  async function submitCreate(values: z.output<typeof ClashCreateSchema>) {
    setMessage("");
    try {
      if (createRequest.current?.nickname !== values.nickname || createRequest.current.mode !== values.mode) createRequest.current = { nickname: values.nickname, mode: values.mode, id: crypto.randomUUID() };
      const result = await createClashRoomAction({ ...values, requestId: createRequest.current.id });
      if (result.ok) router.push(`/mini-games/kotoba-clash/room/${result.data.code}`);
      else {
        if (result.code === "CLOSED" || result.code === "EXPIRED") createRequest.current = null;
        setMessage(result.message);
      }
    } catch { setMessage("Koneksi gagal. Coba lagi."); }
  }
  return (
    <div className="space-y-6">
      <section className="clash-panel overflow-hidden" aria-labelledby="create-title">
        <div className="clash-section-heading bg-neo-yellow"><span className="clash-section-icon bg-white">{solo ? <UserRound className="size-6" /> : <Plus className="size-6" />}</span><div><p className="clash-label">{solo ? "Tantang dirimu" : "Jadi host"}</p><h2 id="create-title" className="mt-1 text-2xl font-black">{solo ? "Latihan sesukamu." : "Buka arenamu."}</h2></div></div>
        <div className="p-5 sm:p-6">
          <form className="space-y-4" onSubmit={(event) => void create.handleSubmit(submitCreate)(event)}>
            <fieldset disabled={create.formState.isSubmitting}><legend className="mb-3 text-sm font-extrabold">Pilih cara main</legend><div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 border-2 border-neo-ink bg-neo-paper p-3 text-sm font-bold has-checked:bg-neo-yellow"><input type="radio" value="multiplayer" {...create.register("mode")} /><Users className="size-5 shrink-0" /><span>Bersama teman</span></label>
              <label className="flex cursor-pointer items-center gap-2 border-2 border-neo-ink bg-neo-paper p-3 text-sm font-bold has-checked:bg-neo-yellow"><input type="radio" value="solo" {...create.register("mode")} /><UserRound className="size-5 shrink-0" /><span>Main sendiri</span></label>
            </div></fieldset>
            <p className="text-sm leading-6">{solo ? "Latihan kuis JLPT melawan waktu. Pilih level dan tipe soal, lalu mulai tanpa menunggu pemain lain." : "Tentukan tantangannya, bagikan undangan, lalu ajak temanmu beradu cepat."}</p>
            {authenticated ? <><label htmlFor="host-nickname" className="block text-sm font-bold">{solo ? "Nickname" : "Nickname dalam room"}</label>
            <Input id="host-nickname" className="clash-input" placeholder="Nama andalanmu" autoComplete="nickname" defaultValue={clashProfileNickname(displayName)} maxLength={24} {...create.register("nickname")} aria-invalid={Boolean(create.formState.errors.nickname)} />
            {create.formState.errors.nickname && <p role="alert" className="text-sm">Gunakan 2-24 huruf, angka, spasi, titik, garis, atau underscore.</p>}
            <ClashButton type="submit" tone="yellow" className="w-full" disabled={create.formState.isSubmitting}>{create.formState.isSubmitting ? "Menyiapkan sesi..." : solo ? "Siapkan latihan solo" : "Buat Room"}<ArrowRight className="size-5" /></ClashButton></>
            : <Link href="/login?next=%2Fmini-games%2Fkotoba-clash" className="clash-button w-full" data-tone="yellow"><DoorOpen className="size-5" />{solo ? "Masuk untuk main solo" : "Masuk dan buat room"}</Link>}
          </form>
        {message && <p role="alert" className="mt-4 text-sm font-semibold">{message}</p>}
        <p className="mt-4 text-xs leading-5 text-neo-ink/60">{solo ? "Mode solo memakai akun. Progres tetap tersimpan saat memuat ulang halaman." : "Host memakai akun. Temanmu boleh main sebagai guest."}</p>
        {authenticated && <p className="mt-2 text-xs leading-5 text-neo-ink/60">Membuat sesi baru akan menutup sesi Kotoba Clash lamamu, termasuk pertandingan yang masih berjalan.</p>}
        </div>
      </section>
      <section className="clash-panel overflow-hidden" aria-labelledby="join-code-title">
        <div className="clash-section-heading bg-neo-paper"><span className="clash-section-icon"><Ticket className="size-6" /></span><div><p className="clash-label">Punya undangan?</p><h2 id="join-code-title" className="mt-1 text-2xl font-black">Masuk ke line-up.</h2></div></div>
        <div className="p-5 sm:p-6"><form className="space-y-4" onSubmit={join.handleSubmit(({ code }) => router.push(`/mini-games/kotoba-clash/room/${code}`))}>
          <label htmlFor="room-code" className="block text-sm font-bold">Kode room</label>
          <Input id="room-code" placeholder="8 KARAKTER" maxLength={8} autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="clash-input clash-code-input uppercase" {...join.register("code")} aria-invalid={Boolean(join.formState.errors.code)} />
          {join.formState.errors.code && <p role="alert" className="text-sm">Masukkan kode undangan 8 karakter yang valid.</p>}
          <ClashButton type="submit" tone="blue" className="w-full">Buka Room<ArrowRight className="size-5" /></ClashButton>
        </form>
        <p className="mt-4 text-xs leading-5 text-neo-ink/60">Tanpa akun juga bisa. Pilih nickname setelah membuka room.</p></div>
      </section>
    </div>
  );
}
