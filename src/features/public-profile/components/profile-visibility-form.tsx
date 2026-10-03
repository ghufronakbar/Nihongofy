"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Globe2, LockKeyhole, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { updateProfileVisibilityAction } from "../actions";
import { ProfileVisibilitySchema, type ProfileVisibilityInput } from "../schemas";

const OPTIONS = [
  {
    value: "PUBLIC",
    label: "Public",
    icon: Globe2,
    note: "Siapa pun, termasuk mesin pencari, dapat melihat statistik, jejak belajar, dan kontribusi diskusimu.",
  },
  {
    value: "PRIVATE",
    label: "Private",
    icon: LockKeyhole,
    note: "Orang lain hanya melihat avatar, nama, username, bio, dan target level dengan label \"Akun ini private\".",
  },
] as const;

export function ProfileVisibilityForm({
  visibility,
  username,
}: {
  visibility: ProfileVisibilityInput["profileVisibility"];
  username: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const { register, handleSubmit } = useForm<ProfileVisibilityInput>({
    resolver: zodResolver(ProfileVisibilitySchema),
    defaultValues: { profileVisibility: visibility },
  });

  function onSubmit(values: ProfileVisibilityInput) {
    setNotice(null);
    startTransition(async () => {
      setNotice(await updateProfileVisibilityAction(values));
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <fieldset disabled={isPending} className="contents">
        <legend className="sr-only">Visibility profil</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-4 border-[3px] border-black bg-white p-4 shadow-neo-sm has-[:checked]:bg-neo-yellow"
            >
              <input
                type="radio"
                value={option.value}
                className="mt-1 size-5 shrink-0 accent-black"
                {...register("profileVisibility")}
              />
              <span>
                <span className="flex items-center gap-2 font-black">
                  <option.icon className="size-4" aria-hidden="true" />
                  {option.label}
                </span>
                <span className="mt-1 block text-sm font-semibold text-foreground/65">{option.note}</span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-sm font-semibold text-foreground/65">
          Entri diskusi yang sudah kamu bagikan tetap publik di halaman soal, kata, dan pola —
          pengaturan ini hanya untuk halaman profil.{" "}
          <Link
            href={`/u/${username}`}
            className="inline-flex items-center gap-1 font-bold text-foreground underline decoration-2 decoration-neo-blue underline-offset-4"
          >
            Lihat profilmu
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </p>

        {notice ? (
          <p
            role={notice.ok ? "status" : "alert"}
            className={`border-[3px] border-black p-3 font-bold text-black shadow-neo-sm ${notice.ok ? "bg-neo-green" : "bg-neo-coral"}`}
          >
            {notice.message}
          </p>
        ) : null}

        <button type="submit" className="neo-button w-full bg-neo-blue sm:w-fit">
          <Save className="size-5" aria-hidden="true" />
          {isPending ? "Menyimpan..." : "Simpan visibility"}
        </button>
      </fieldset>
    </form>
  );
}
