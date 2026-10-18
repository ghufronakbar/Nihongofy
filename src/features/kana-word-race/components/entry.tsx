"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Plus, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeSchema, EntrySchema } from "../contracts";
import { createRaceRoomAction } from "../actions";

const JoinCode = z.object({ code: CodeSchema });
export function RaceEntry({ authenticated, displayName }: { authenticated: boolean; displayName?: string }) {
  const router = useRouter(); const [error, setError] = useState("");
  const request = useRef<{ nickname: string; requestId: string } | null>(null);
  const create = useForm({ resolver: zodResolver(EntrySchema), defaultValues: { nickname: displayName?.slice(0, 24) ?? "" } });
  const join = useForm({ resolver: zodResolver(JoinCode), defaultValues: { code: "" } });
  return <div className="race-entry">
    <section className="race-panel p-6 sm:p-8">
      <Plus className="mb-4 size-7" /><h2 className="text-2xl font-black">Mulai balapanmu.</h2>
      <p className="mb-5 mt-2 text-sm leading-6">Buka room, tentukan panjang kata, lalu undang temanmu.</p>
      {authenticated ? <form onSubmit={(event) => { void create.handleSubmit(async (values) => {
        setError(""); if (request.current?.nickname !== values.nickname) request.current = { nickname: values.nickname, requestId: crypto.randomUUID() };
        try { const result = await createRaceRoomAction(request.current); if (result.ok) router.push(`/mini-games/kana-word-race/room/${result.data.code}`); else setError(result.message); }
        catch { setError("Koneksi gagal. Coba lagi dengan permintaan yang sama."); }
      })(event); }} className="space-y-4">
        <label className="block text-sm font-bold" htmlFor="race-nickname">Nickname dalam room</label>
        <Input id="race-nickname" className="race-input" autoComplete="nickname" maxLength={24} {...create.register("nickname")} aria-invalid={Boolean(create.formState.errors.nickname)} />
        {create.formState.errors.nickname && <p role="alert" className="text-sm">Gunakan 2-24 huruf, angka, spasi, titik, garis, atau underscore.</p>}
        <Button className="race-button w-full" disabled={create.formState.isSubmitting} type="submit">{create.formState.isSubmitting ? "Membuat room..." : "Buat Room"}<ArrowRight /></Button>
        <p className="text-xs leading-5 opacity-70">Room Kana Word Race lamamu akan ditutup ketika membuat yang baru.</p>
      </form> : <Link className="race-button w-full" href="/login?next=%2Fmini-games%2Fkana-word-race">Masuk dan buat room<ArrowRight className="size-4" /></Link>}
      {error && <p role="alert" className="mt-4 text-sm">{error}</p>}
    </section>
    <section className="race-panel p-6 sm:p-8">
      <Ticket className="mb-4 size-7" /><h2 className="text-2xl font-black">Punya undangan?</h2>
      <form className="mt-5 space-y-4" onSubmit={join.handleSubmit(({ code }) => router.push(`/mini-games/kana-word-race/room/${code}`))}>
        <label className="block text-sm font-bold" htmlFor="race-code">Kode room</label>
        <Input id="race-code" className="race-input uppercase" placeholder="8 KARAKTER" maxLength={8} autoCapitalize="characters" autoCorrect="off" spellCheck={false} {...join.register("code")} />
        {join.formState.errors.code && <p role="alert" className="text-sm">Periksa kode delapan karakter dari host.</p>}
        <Button className="race-button race-button-paper w-full" type="submit">Gabung Room<ArrowRight /></Button>
      </form><p className="mt-4 text-xs opacity-70">Peserta boleh memakai akun atau nickname guest.</p>
    </section>
  </div>;
}
