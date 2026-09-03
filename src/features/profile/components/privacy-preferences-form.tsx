"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { updatePrivacyPreferencesAction } from "../privacy-actions";
import {
  PrivacyPreferencesSchema,
  type PrivacyPreferencesInput,
} from "../schemas";

export function PrivacyPreferencesForm({
  preferences,
}: {
  preferences: PrivacyPreferencesInput;
}) {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const { register, handleSubmit } = useForm<PrivacyPreferencesInput>({
    resolver: zodResolver(PrivacyPreferencesSchema),
    defaultValues: preferences,
  });

  function onSubmit(values: PrivacyPreferencesInput) {
    setNotice(null);
    startTransition(async () => {
      setNotice(await updatePrivacyPreferencesAction(values));
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <fieldset disabled={isPending} className="contents">
        <label className="flex cursor-pointer items-start gap-4 border-[3px] border-black bg-white p-4 shadow-neo-sm">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-black"
            {...register("allowAudioStorage")}
          />
          <span>
            <span className="block font-black">Izinkan penyimpanan audio</span>
            <span className="mt-1 block text-sm font-semibold text-foreground/65">
              Audio dari fitur speaking hanya boleh disimpan jika pilihan ini aktif.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-4 border-[3px] border-black bg-white p-4 shadow-neo-sm">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-black"
            {...register("allowConversationStorage")}
          />
          <span>
            <span className="block font-black">Izinkan penyimpanan conversation</span>
            <span className="mt-1 block text-sm font-semibold text-foreground/65">
              Percakapan AI hanya boleh dipersistenkan jika pilihan ini aktif.
            </span>
          </span>
        </label>

        <p className="text-sm font-semibold text-foreground/65">
          Keduanya default nonaktif dan menjadi guard sebelum modul Conversation atau Speaking dibuka.
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
          {isPending ? "Menyimpan..." : "Simpan preferensi"}
        </button>
      </fieldset>
    </form>
  );
}
