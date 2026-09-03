"use client";

import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Mail } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction } from "../actions";
import { ForgotPasswordSchema, type ForgotPasswordInput } from "../schemas";
import { TurnstileWidget } from "./turnstile";
import { TURNSTILE_ACTIONS } from "../lib/turnstile-config";

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: "", turnstileToken: "" },
  });
  const turnstileToken = useWatch({ control, name: "turnstileToken" });

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  function onSubmit(values: ForgotPasswordInput) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await forgotPasswordAction(values);
        if (!result) return;
        setNotice({ ok: result.ok, message: result.message });
        if (result.retryAfterSeconds) setCooldownSeconds(result.retryAfterSeconds);
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
          <input type="hidden" {...register("turnstileToken")} />
          <Field className="gap-2.5">
            <FieldLabel htmlFor="email" className="text-sm font-extrabold">Email akun</FieldLabel>
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
                    placeholder="nama@email.com"
                    className="neo-input h-12 pl-12"
                    aria-invalid={Boolean(errors.email)}
                    onChange={(event) => field.onChange(event.currentTarget.value.toLowerCase())}
                  />
                )}
              />
            </div>
            <FieldError errors={[errors.email]} className="font-semibold" />
          </Field>

          <TurnstileWidget
            action={TURNSTILE_ACTIONS.forgotPassword}
            resetSignal={turnstileResetSignal}
            onTokenChange={(token) =>
              setValue("turnstileToken", token ?? "", { shouldValidate: true })
            }
          />
          <FieldError errors={[errors.turnstileToken]} className="font-semibold" />

          {notice ? (
            <p
              role={notice.ok ? "status" : "alert"}
              className={`border-[3px] border-black p-3 font-bold text-black shadow-neo-sm ${notice.ok ? "bg-neo-green" : "bg-neo-coral"}`}
            >
              {notice.message}
            </p>
          ) : null}

          <button type="submit" disabled={isPending || cooldownSeconds > 0 || !turnstileToken} className="neo-button w-full bg-neo-yellow">
            <KeyRound className="size-5" aria-hidden="true" />
            {isPending
              ? "Mengirim..."
              : cooldownSeconds > 0
                ? `Coba lagi dalam ${cooldownSeconds} detik`
                : "Kirim tautan reset"}
          </button>
        </FieldGroup>
      </fieldset>
    </form>
  );
}
