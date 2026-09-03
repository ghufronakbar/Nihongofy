"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link2Off } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/features/auth/components/password-input";
import { disconnectGoogleAction } from "../actions";
import {
  DisconnectGoogleSchema,
  type DisconnectGoogleInput,
} from "../schemas";

export function GoogleAccountPanel({
  connectedEmail,
  hasPassword,
  enabled,
}: {
  connectedEmail: string | null;
  hasPassword: boolean;
  enabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DisconnectGoogleInput>({
    resolver: zodResolver(DisconnectGoogleSchema),
    defaultValues: { currentPassword: "" },
  });

  function disconnect(values: DisconnectGoogleInput) {
    setNotice(null);
    startTransition(async () => {
      const result = await disconnectGoogleAction(values);
      setNotice(result);
      if (result.ok) {
        reset();
        router.refresh();
      }
    });
  }

  if (!connectedEmail) {
    return (
      <div className="grid gap-4">
        <p className="font-semibold text-foreground/70">
          Belum ada Google account yang terhubung. Google harus memakai email yang sama dengan akun ini.
        </p>
        {enabled ? (
          <a
            href="/api/auth/google/start?intent=link"
            className="neo-button w-full bg-white sm:w-fit"
          >
            Hubungkan Google account
          </a>
        ) : (
          <p role="status" className="border-[3px] border-black bg-neo-yellow p-3 font-bold shadow-neo-sm">
            Google OAuth belum dikonfigurasi pada environment ini.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="border-[3px] border-black bg-neo-green p-4 shadow-neo-sm">
        <p className="font-black">Terhubung dengan Google</p>
        <p className="mt-1 break-all text-sm font-semibold">{connectedEmail}</p>
      </div>

      {hasPassword ? (
        <form onSubmit={handleSubmit(disconnect)} noValidate className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="disconnectGooglePassword" className="font-extrabold">
              Password saat ini
            </FieldLabel>
            <PasswordInput
              id="disconnectGooglePassword"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.currentPassword)}
              {...register("currentPassword")}
            />
            <FieldError errors={[errors.currentPassword]} className="font-semibold" />
          </Field>
          {notice ? (
            <p
              role={notice.ok ? "status" : "alert"}
              className={`border-[3px] border-black p-3 font-bold shadow-neo-sm ${notice.ok ? "bg-neo-green" : "bg-neo-coral"}`}
            >
              {notice.message}
            </p>
          ) : null}
          <button type="submit" disabled={isPending} className="neo-button w-full bg-neo-coral sm:w-fit">
            <Link2Off className="size-5" aria-hidden="true" />
            {isPending ? "Memutuskan..." : "Putuskan Google"}
          </button>
        </form>
      ) : (
        <p className="text-sm font-semibold text-foreground/70">
          Buat password terlebih dahulu sebelum memutuskan Google agar akun tidak terkunci.
        </p>
      )}
    </div>
  );
}
