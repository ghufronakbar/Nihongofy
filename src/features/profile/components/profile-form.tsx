"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Save, UserRound } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TimeZoneOption } from "@/lib/time-zone";
import { updateProfileAction } from "../actions";
import { UpdateProfileSchema, type UpdateProfileInput } from "../schemas";
import { AvatarUploader } from "./avatar-uploader";
import { TimeZoneCombobox } from "./time-zone-combobox";

export function ProfileForm({
  account,
  timeZoneOptions,
}: {
  account: {
    displayName: string;
    email: string | null;
    username: string | null;
    avatarUrl: string | null;
    avatarPublicId: string | null;
    timeZone: string;
  };
  timeZoneOptions: TimeZoneOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      avatarPublicId: account.avatarPublicId,
      timeZone: account.timeZone,
    },
  });
  const displayName = useWatch({ control, name: "displayName" });
  const avatarUrl = useWatch({ control, name: "avatarUrl" });
  const avatarPublicId = useWatch({ control, name: "avatarPublicId" });

  function onSubmit(values: UpdateProfileInput) {
    setNotice(null);
    startTransition(async () => {
      const result = await updateProfileAction(values);
      setNotice(result);
      if (result.ok) reset(result.values);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-7">
      <fieldset disabled={isPending} className="contents">
        <AvatarUploader
          value={avatarUrl ? { url: avatarUrl, publicId: avatarPublicId } : null}
          displayName={displayName}
          onChange={(value) => {
            setValue("avatarUrl", value?.url ?? null, { shouldDirty: true, shouldValidate: true });
            setValue("avatarPublicId", value?.publicId ?? null, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
        <FieldError errors={[errors.avatarUrl]} className="font-semibold" />
        <FieldError errors={[errors.avatarPublicId]} className="font-semibold" />

        <div className="grid gap-5 border-t-[3px] border-black pt-7">
          <Field>
            <FieldLabel htmlFor="displayName" className="font-extrabold">Nama tampilan</FieldLabel>
            <div className="relative">
              <UserRound className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-black/55" aria-hidden="true" />
              <Input id="displayName" className="neo-input pl-12" aria-invalid={Boolean(errors.displayName)} {...register("displayName")} />
            </div>
            <FieldDescription>Nama ini tampil di sidebar dan ringkasan belajar.</FieldDescription>
            <FieldError errors={[errors.displayName]} className="font-semibold" />
          </Field>

          <Field>
            <FieldLabel htmlFor="email" className="font-extrabold">Email</FieldLabel>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-black/55" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                value={account.email ?? "Akun legacy tanpa email"}
                readOnly
                aria-readonly="true"
                className="neo-input bg-muted pl-12"
              />
            </div>
            <FieldDescription>
              Email menjadi identitas tetap akun dan tidak dapat diubah dari profile.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="timeZone" className="font-extrabold">Timezone</FieldLabel>
            <Controller
              name="timeZone"
              control={control}
              render={({ field }) => (
                <TimeZoneCombobox
                  id="timeZone"
                  value={field.value}
                  options={timeZoneOptions}
                  invalid={Boolean(errors.timeZone)}
                  disabled={isPending}
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                />
              )}
            />
            <FieldDescription>
              Cari berdasarkan kota, nama IANA, atau offset UTC. Dipakai untuk batas harian SRS, filter tanggal, dan tampilan waktu.
            </FieldDescription>
            <FieldError errors={[errors.timeZone]} className="font-semibold" />
          </Field>

          {account.username ? (
            <Field>
              <FieldLabel htmlFor="legacyUsername" className="font-extrabold">Username lama</FieldLabel>
              <Input id="legacyUsername" value={account.username} readOnly disabled className="neo-input bg-muted" />
              <FieldDescription>Read-only untuk kompatibilitas akun lama.</FieldDescription>
            </Field>
          ) : null}
        </div>

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
          {isPending ? "Menyimpan..." : "Simpan profil"}
        </button>
      </fieldset>
    </form>
  );
}
