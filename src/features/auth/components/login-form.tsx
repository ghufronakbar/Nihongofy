"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema, type LoginInput } from "../schemas";
import { loginAction } from "../actions";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { LogIn, Mail } from "lucide-react";
import { PasswordInput } from "./password-input";
import Link from "next/link";
import { TurnstileWidget } from "./turnstile";
import { TURNSTILE_ACTIONS } from "../lib/turnstile-config";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      next: nextPath,
      turnstileToken: "",
    },
  });
  const turnstileToken = useWatch({ control, name: "turnstileToken" });

  function onSubmit(values: LoginInput) {
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await loginAction(values);
        if (result?.message) {
          setFormError(result.message);
        }
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
          <input type="hidden" defaultValue={nextPath} {...register("next")} />
          <input type="hidden" {...register("turnstileToken")} />
          <Field className="gap-2.5">
            <FieldLabel htmlFor="identifier" className="text-sm font-extrabold">
              Email atau username lama
            </FieldLabel>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-black/55"
                aria-hidden="true"
              />
              <Input
                id="identifier"
                autoComplete="username"
                inputMode="email"
                placeholder="nama@email.com"
                className="neo-input h-12 pl-12"
                aria-invalid={Boolean(errors.identifier)}
                {...register("identifier")}
              />
            </div>
            <FieldError errors={[errors.identifier]} className="font-semibold" />
          </Field>
          <Field className="gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="password" className="text-sm font-extrabold">
                Password
              </FieldLabel>
              <Link
                href="/forget-password"
                className="text-xs font-extrabold underline decoration-2 decoration-neo-yellow underline-offset-4"
              >
                Lupa password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="masukkan password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <FieldError errors={[errors.password]} className="font-semibold" />
          </Field>
          <TurnstileWidget
            action={TURNSTILE_ACTIONS.login}
            resetSignal={turnstileResetSignal}
            onTokenChange={(token) =>
              setValue("turnstileToken", token ?? "", { shouldValidate: true })
            }
          />
          <FieldError errors={[errors.turnstileToken]} className="font-semibold" />
          {formError && (
            <FieldError
              className="border-[3px] border-neo-ink bg-neo-coral p-3 font-bold text-black shadow-neo-sm"
              aria-live="polite"
            >
              {formError}
            </FieldError>
          )}
          <button
            type="submit"
            disabled={isPending || !turnstileToken}
            className="neo-button w-full bg-neo-blue py-3 text-base"
          >
            <LogIn className="size-5" aria-hidden="true" />
            {isPending ? "Memeriksa akun..." : "Masuk"}
          </button>
        </FieldGroup>
      </fieldset>
    </form>
  );
}
