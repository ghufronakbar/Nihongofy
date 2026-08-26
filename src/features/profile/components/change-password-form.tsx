"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/features/auth/components/password-input";
import { changePasswordAction } from "../actions";
import { ChangePasswordSchema, type ChangePasswordInput } from "../schemas";

const DEFAULT_VALUES: ChangePasswordInput = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: DEFAULT_VALUES,
  });

  function onSubmit(values: ChangePasswordInput) {
    setNotice(null);
    startTransition(async () => {
      const result = await changePasswordAction(values);
      setNotice(result);
      if (result.ok) reset(DEFAULT_VALUES);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={isPending} className="grid gap-5">
        <Field>
          <FieldLabel htmlFor="currentPassword" className="font-extrabold">Password saat ini</FieldLabel>
          <PasswordInput id="currentPassword" autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} {...register("currentPassword")} />
          <FieldError errors={[errors.currentPassword]} className="font-semibold" />
        </Field>

        <Field>
          <FieldLabel htmlFor="newPassword" className="font-extrabold">Password baru</FieldLabel>
          <PasswordInput id="newPassword" autoComplete="new-password" aria-invalid={Boolean(errors.newPassword)} {...register("newPassword")} />
          <FieldDescription>Minimal 8 karakter dan maksimal 72 byte.</FieldDescription>
          <FieldError errors={[errors.newPassword]} className="font-semibold" />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword" className="font-extrabold">Konfirmasi password baru</FieldLabel>
          <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
          <FieldError errors={[errors.confirmPassword]} className="font-semibold" />
        </Field>

        {notice ? (
          <p
            role={notice.ok ? "status" : "alert"}
            className={`border-[3px] border-black p-3 font-bold text-black shadow-neo-sm ${notice.ok ? "bg-neo-green" : "bg-neo-coral"}`}
          >
            {notice.message}
          </p>
        ) : null}

        <button type="submit" className="neo-button w-full bg-neo-blue sm:w-fit">
          <KeyRound className="size-5" aria-hidden="true" />
          {isPending ? "Memperbarui..." : "Ganti password"}
        </button>
      </fieldset>
    </form>
  );
}
