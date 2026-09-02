"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Save, UserRound } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "../actions";
import { UpdateProfileSchema, type UpdateProfileInput } from "../schemas";
import { AvatarUploader } from "./avatar-uploader";

export function ProfileForm({
  account,
}: {
  account: {
    displayName: string;
    email: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
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
      email: account.email?.toLowerCase() ?? "",
      avatarUrl: account.avatarUrl,
    },
  });
  const displayName = useWatch({ control, name: "displayName" });
  const avatarUrl = useWatch({ control, name: "avatarUrl" });

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
          value={avatarUrl}
          displayName={displayName}
          onChange={(value) => setValue("avatarUrl", value, { shouldDirty: true, shouldValidate: true })}
        />
        <FieldError errors={[errors.avatarUrl]} className="font-semibold" />

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
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="neo-input pl-12"
                    aria-invalid={Boolean(errors.email)}
                    onChange={(event) => field.onChange(event.currentTarget.value.toLowerCase())}
                  />
                )}
              />
            </div>
            <FieldDescription>
              Email dinormalisasi ke huruf kecil; alias dengan tanda + tidak didukung.
            </FieldDescription>
            <FieldError errors={[errors.email]} className="font-semibold" />
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
