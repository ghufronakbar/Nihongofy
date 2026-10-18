"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Plus, Ticket, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeSchema, CreateSchema, type RaceMode } from "../contracts";
import { createRaceRoomAction } from "../actions";
import { RaceSectionHeading } from "./ui";

const JoinCode = z.object({ code: CodeSchema });
const CreateEntrySchema = CreateSchema.omit({ requestId: true });
export function RaceEntry({ authenticated, displayName }: { authenticated: boolean; displayName?: string }) {
  const router = useRouter(); const [error, setError] = useState("");
  const request = useRef<{ nickname: string; requestId: string; mode: RaceMode } | null>(null);
  const create = useForm({ resolver: zodResolver(CreateEntrySchema), defaultValues: { nickname: displayName?.slice(0, 24) ?? "", mode: "multiplayer" } });
  const solo = useWatch({ control: create.control, name: "mode" }) === "solo";
  const join = useForm({ resolver: zodResolver(JoinCode), defaultValues: { code: "" } });
  return <div className="race-entry">
    <section className="race-panel overflow-hidden" aria-labelledby="race-create-title">
      <RaceSectionHeading icon={solo ? UserRound : Plus} label={solo ? "Tantang dirimu" : "Jadi host"} title={solo ? "Latihan sesukamu." : "Mulai balapanmu."} id="race-create-title" />
      <div className="p-5 sm:p-6">
      <form onSubmit={(event) => { void create.handleSubmit(async (values) => {
        setError(""); if (request.current?.nickname !== values.nickname || request.current.mode !== values.mode) request.current = { ...values, requestId: crypto.randomUUID() };
        try { const result = await createRaceRoomAction(request.current); if (result.ok) router.push(`/mini-games/kana-word-race/room/${result.data.code}`); else setError(result.message); }
        catch { setError("Koneksi gagal. Coba lagi dengan permintaan yang sama."); }
      })(event); }} className="space-y-4">
        <fieldset disabled={create.formState.isSubmitting}><legend className="mb-3 text-sm font-extrabold">Pilih cara main</legend><div className="race-modes">
          <label><input type="radio" value="multiplayer" {...create.register("mode")} /><Users className="size-5" /><span>Bersama teman</span></label>
          <label><input type="radio" value="solo" {...create.register("mode")} /><UserRound className="size-5" /><span>Main sendiri</span></label>
        </div></fieldset>
        <p className="text-sm leading-6">{solo ? "Satu pemain, enam tebakan, dan tantangan melawan waktu. Atur tingkat tantangan sebelum mulai." : "Buka room, tentukan panjang kata, lalu undang temanmu beradu tebakan."}</p>
        {authenticated ? <><label className="block text-sm font-bold" htmlFor="race-nickname">{solo ? "Nickname" : "Nickname dalam room"}</label>
        <Input id="race-nickname" className="race-input" placeholder="Nama andalanmu" autoComplete="nickname" maxLength={24} {...create.register("nickname")} aria-invalid={Boolean(create.formState.errors.nickname)} />
        {create.formState.errors.nickname && <p role="alert" className="text-sm">Gunakan 2-24 huruf, angka, spasi, titik, garis, atau underscore.</p>}
        <Button className="race-button w-full" disabled={create.formState.isSubmitting} type="submit">{create.formState.isSubmitting ? "Menyiapkan sesi..." : solo ? "Siapkan latihan solo" : "Buat Room"}<ArrowRight /></Button></> : <Link className="race-button w-full" href="/login?next=%2Fmini-games%2Fkana-word-race">{solo ? "Masuk untuk main solo" : "Masuk dan buat room"}<ArrowRight className="size-5" /></Link>}
      </form>
      {error && <p role="alert" className="mt-4 text-sm">{error}</p>}
      <p className="mt-4 text-xs leading-5 opacity-65">{solo ? "Mode solo memakai akun. Progres tetap tersimpan saat memuat ulang halaman." : "Host memakai akun. Temanmu boleh main sebagai guest."}</p>
      {authenticated && <p className="mt-2 text-xs leading-5 opacity-65">Sesi Kana Word Race lamamu akan ditutup ketika membuat yang baru.</p>}
      </div>
    </section>
    <section className="race-panel overflow-hidden" aria-labelledby="race-join-title">
      <RaceSectionHeading icon={Ticket} label="Punya undangan?" title="Masuk ke line-up." id="race-join-title" tone="paper" />
      <div className="p-5 sm:p-6"><form className="space-y-4" onSubmit={join.handleSubmit(({ code }) => router.push(`/mini-games/kana-word-race/room/${code}`))}>
        <label className="block text-sm font-bold" htmlFor="race-code">Kode room</label>
        <Input id="race-code" className="race-input race-code-input uppercase" placeholder="8 KARAKTER" maxLength={8} autoCapitalize="characters" autoCorrect="off" spellCheck={false} {...join.register("code")} aria-invalid={Boolean(join.formState.errors.code)} />
        {join.formState.errors.code && <p role="alert" className="text-sm">Periksa kode delapan karakter dari host.</p>}
        <Button className="race-button w-full" data-tone="blue" type="submit">Buka Room<ArrowRight className="size-5" /></Button>
      </form><p className="mt-4 text-xs leading-5 opacity-65">Tanpa akun juga bisa. Pilih nickname setelah membuka room.</p></div>
    </section>
  </div>;
}
