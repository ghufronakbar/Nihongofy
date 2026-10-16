"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClashRoomAction } from "../actions";
import { ClashCreateSchema, ClashRoomCodeSchema } from "../schemas";

const CodeSchema = z.object({ code: ClashRoomCodeSchema });

export function ClashEntry({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const create = useForm({ resolver: zodResolver(ClashCreateSchema), defaultValues: { nickname: "" } });
  const join = useForm({ resolver: zodResolver(CodeSchema), defaultValues: { code: "" } });
  return (
    <div className="space-y-7">
      <section className="neo-surface bg-neo-yellow p-6 sm:p-8" aria-labelledby="create-title">
        <h2 id="create-title" className="text-2xl font-black">Mulai tantanganmu</h2>
        {authenticated ? (
          <form className="mt-5 space-y-4" onSubmit={create.handleSubmit(async (values) => {
            setMessage("");
            try {
              const result = await createClashRoomAction(values);
              if (result.ok) router.push(`/mini-games/kotoba-clash/room/${result.data.code}`);
              else setMessage(result.message);
            } catch { setMessage("Koneksi gagal. Coba lagi."); }
          })}>
            <label htmlFor="host-nickname" className="block text-sm font-bold">Nickname dalam room</label>
            <Input id="host-nickname" autoComplete="nickname" maxLength={24} {...create.register("nickname")} aria-invalid={Boolean(create.formState.errors.nickname)} />
            {create.formState.errors.nickname && <p role="alert" className="text-sm">Gunakan 2-24 huruf, angka, spasi, titik, garis, atau underscore.</p>}
            <Button type="submit" className="neo-button h-auto w-full bg-white py-3 text-neo-ink" disabled={create.formState.isSubmitting}>{create.formState.isSubmitting ? "Membuat room..." : "Buat Room"}</Button>
          </form>
        ) : <><p className="mt-3 leading-7">Masuk ke akun untuk menjadi host.</p><Link href="/login?next=%2Fmini-games%2Fkotoba-clash" className="neo-button mt-5 bg-white">Masuk dan buat room</Link></>}
        {message && <p role="alert" className="mt-4 text-sm font-semibold">{message}</p>}
      </section>
      <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="join-code-title">
        <h2 id="join-code-title" className="text-2xl font-black">Sudah punya undangan?</h2>
        <form className="mt-5 space-y-4" onSubmit={join.handleSubmit(({ code }) => router.push(`/mini-games/kotoba-clash/room/${code}`))}>
          <label htmlFor="room-code" className="block text-sm font-bold">Kode room</label>
          <Input id="room-code" placeholder="8 karakter" maxLength={8} autoCapitalize="characters" className="font-mono text-lg uppercase tracking-widest" {...join.register("code")} aria-invalid={Boolean(join.formState.errors.code)} />
          {join.formState.errors.code && <p role="alert" className="text-sm">Masukkan kode undangan 8 karakter yang valid.</p>}
          <Button type="submit" className="neo-button h-auto w-full bg-neo-blue py-3 text-neo-ink">Buka Room</Button>
        </form>
        <p className="mt-4 text-sm text-foreground/70">Guest juga boleh ikut. Nickname dipilih setelah membuka room.</p>
      </section>
    </div>
  );
}
