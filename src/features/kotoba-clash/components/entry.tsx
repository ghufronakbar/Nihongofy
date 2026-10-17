"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, DoorOpen, Plus, Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClashButton } from "./arena-ui";
import { createClashRoomAction } from "../actions";
import { ClashCreateSchema, ClashRoomCodeSchema } from "../schemas";

const CodeSchema = z.object({ code: ClashRoomCodeSchema });

export function ClashEntry({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const create = useForm({ resolver: zodResolver(ClashCreateSchema), defaultValues: { nickname: "" } });
  const join = useForm({ resolver: zodResolver(CodeSchema), defaultValues: { code: "" } });
  return (
    <div className="space-y-6">
      <section className="clash-panel overflow-hidden" aria-labelledby="create-title">
        <div className="clash-section-heading bg-neo-yellow"><span className="clash-section-icon bg-white"><Plus className="size-6" /></span><div><p className="clash-label">Jadi host</p><h2 id="create-title" className="mt-1 text-2xl font-black">Buka arenamu.</h2></div></div>
        <div className="p-5 sm:p-6">
        {authenticated ? (
          <form className="space-y-4" onSubmit={create.handleSubmit(async (values) => {
            setMessage("");
            try {
              const result = await createClashRoomAction(values);
              if (result.ok) router.push(`/mini-games/kotoba-clash/room/${result.data.code}`);
              else setMessage(result.message);
            } catch { setMessage("Koneksi gagal. Coba lagi."); }
          })}>
            <label htmlFor="host-nickname" className="block text-sm font-bold">Nickname dalam room</label>
            <Input id="host-nickname" className="clash-input" placeholder="Nama andalanmu" autoComplete="nickname" maxLength={24} {...create.register("nickname")} aria-invalid={Boolean(create.formState.errors.nickname)} />
            {create.formState.errors.nickname && <p role="alert" className="text-sm">Gunakan 2-24 huruf, angka, spasi, titik, garis, atau underscore.</p>}
            <ClashButton type="submit" tone="yellow" className="w-full" disabled={create.formState.isSubmitting}>{create.formState.isSubmitting ? "Membuat room..." : "Buat Room"}<ArrowRight className="size-5" /></ClashButton>
          </form>
        ) : <><p className="text-sm leading-6">Tentukan tantangannya, bagikan undangan, lalu ajak temanmu beradu cepat.</p><Link href="/login?next=%2Fmini-games%2Fkotoba-clash" className="clash-button mt-5 w-full" data-tone="yellow"><DoorOpen className="size-5" />Masuk dan buat room</Link></>}
        {message && <p role="alert" className="mt-4 text-sm font-semibold">{message}</p>}
        <p className="mt-4 text-xs leading-5 text-neo-ink/60">Host memakai akun. Temanmu boleh main sebagai guest.</p>
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
