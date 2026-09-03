"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/features/auth/components/password-input";
import { setPasswordAction } from "../actions";
import { SetPasswordSchema, type SetPasswordInput } from "../schemas";

const DEFAULT_VALUES: SetPasswordInput = {
  newPassword: "",
  confirmPassword: "",
};

export function SetPasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(SetPasswordSchema),
    defaultValues: DEFAULT_VALUES,
  });

  function onSubmit(values: SetPasswordInput) {
    setNotice(null);
    startTransition(async () => {
      const result = await setPasswordAction(values);
      setNotice(result);
      if (result.ok) {
        reset(DEFAULT_VALUES);
        router.replace("/profile/security");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={isPending} className="grid gap-5">
        <Field>
          <FieldLabel htmlFor="newPassword" className="font-extrabold">
            Password baru
          </FieldLabel>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.newPassword)}
            {...register("newPassword")}
          />
          <FieldDescription>Minimal 8 karakter dan maksimal 72 byte.</FieldDescription>
          <FieldError errors={[errors.newPassword]} className="font-semibold" />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword" className="font-extrabold">
            Konfirmasi password baru
          </FieldLabel>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
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
          {isPending ? "Membuat..." : "Buat password"}
        </button>
      </fieldset>
    </form>
  );
}
