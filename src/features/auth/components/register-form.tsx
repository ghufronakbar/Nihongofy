"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, UserPlus, UserRound } from "lucide-react";
import { registerAction } from "../actions";
import { RegisterSchema, type RegisterInput } from "../schemas";
import { PasswordInput } from "./password-input";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
      next: nextPath,
    },
  });

  function onSubmit(values: RegisterInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await registerAction(values);
      if (result?.message) setFormError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={isPending}>
        <FieldGroup>
          <input type="hidden" defaultValue={nextPath} {...register("next")} />
          <Field className="gap-2.5">
            <FieldLabel htmlFor="displayName" className="text-sm font-extrabold">
              Nama tampilan
            </FieldLabel>
            <div className="relative">
              <UserRound className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-black/55" aria-hidden="true" />
              <Input
                id="displayName"
                autoComplete="name"
                placeholder="Nama kamu"
                className="neo-input h-12 pl-12"
                aria-invalid={Boolean(errors.displayName)}
                {...register("displayName")}
              />
            </div>
            <FieldError errors={[errors.displayName]} className="font-semibold" />
          </Field>

          <Field className="gap-2.5">
            <FieldLabel htmlFor="email" className="text-sm font-extrabold">
              Email
            </FieldLabel>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-black/55" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nama@email.com"
                className="neo-input h-12 pl-12"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
            </div>
            <FieldError errors={[errors.email]} className="font-semibold" />
          </Field>

          <Field className="gap-2.5">
            <FieldLabel htmlFor="password" className="text-sm font-extrabold">
              Password
            </FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <FieldDescription className="font-medium text-foreground/65">
              Gunakan 8-72 karakter yang mudah kamu ingat dan sulit ditebak.
            </FieldDescription>
            <FieldError errors={[errors.password]} className="font-semibold" />
          </Field>

          <Field className="gap-2.5">
            <FieldLabel htmlFor="confirmPassword" className="text-sm font-extrabold">
              Konfirmasi password
            </FieldLabel>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Ulangi password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register("confirmPassword")}
            />
            <FieldError errors={[errors.confirmPassword]} className="font-semibold" />
          </Field>

          {formError && (
            <FieldError className="border-[3px] border-neo-ink bg-neo-coral p-3 font-bold text-black shadow-neo-sm" aria-live="polite">
              {formError}
            </FieldError>
          )}

          <button type="submit" disabled={isPending} className="neo-button w-full bg-neo-green py-3 text-base">
            <UserPlus className="size-5" aria-hidden="true" />
            {isPending ? "Membuat akun..." : "Buat akun"}
          </button>
        </FieldGroup>
      </fieldset>
    </form>
  );
}
