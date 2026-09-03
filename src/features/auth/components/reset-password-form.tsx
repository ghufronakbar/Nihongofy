"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { resetPasswordAction } from "../actions";
import { ResetPasswordSchema, type ResetPasswordInput } from "../schemas";
import { PasswordInput } from "./password-input";
import { TurnstileWidget } from "./turnstile";
import { TURNSTILE_ACTIONS } from "../lib/turnstile-config";

export function ResetPasswordForm({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "", turnstileToken: "" },
  });
  const turnstileToken = useWatch({ control, name: "turnstileToken" });

  function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await resetPasswordAction(values);
        if (result?.message) setFormError(result.message);
      } finally {
        setValue("turnstileToken", "");
        setTurnstileResetSignal((current) => current + 1);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={isPending}>
        <FieldGroup>
          <input type="hidden" {...register("token")} />
          <input type="hidden" {...register("turnstileToken")} />
          <Field>
            <FieldLabel htmlFor="password" className="font-extrabold">Password baru</FieldLabel>
            <PasswordInput id="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
            <FieldDescription>Minimal 8 karakter dan maksimal 72 byte.</FieldDescription>
            <FieldError errors={[errors.password]} className="font-semibold" />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword" className="font-extrabold">Konfirmasi password</FieldLabel>
            <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
            <FieldError errors={[errors.confirmPassword]} className="font-semibold" />
          </Field>
          <TurnstileWidget
            action={TURNSTILE_ACTIONS.resetPassword}
            resetSignal={turnstileResetSignal}
            onTokenChange={(turnstileValue) =>
              setValue("turnstileToken", turnstileValue ?? "", { shouldValidate: true })
            }
          />
          <FieldError errors={[errors.turnstileToken]} className="font-semibold" />
          {formError ? (
            <p role="alert" className="border-[3px] border-black bg-neo-coral p-3 font-bold text-black shadow-neo-sm">
              {formError}
            </p>
          ) : null}
          <button type="submit" disabled={isPending || !turnstileToken} className="neo-button w-full bg-neo-green">
            <KeyRound className="size-5" aria-hidden="true" />
            {isPending ? "Menyimpan..." : "Simpan password baru"}
          </button>
        </FieldGroup>
      </fieldset>
    </form>
  );
}
