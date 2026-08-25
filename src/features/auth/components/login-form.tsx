"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema, type LoginInput } from "../schemas";
import { loginAction } from "../actions";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { LockKeyhole, LogIn, UserRound } from "lucide-react";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { username: "", password: "", next: nextPath },
  });

  function onSubmit(values: LoginInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await loginAction(values);
      if (result?.message) {
        setFormError(result.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <input type="hidden" defaultValue={nextPath} {...register("next")} />
        <Field className="gap-2.5">
          <FieldLabel htmlFor="username" className="text-sm font-extrabold">
            Username
          </FieldLabel>
          <div className="relative">
            <UserRound className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-foreground/55" />
            <Input
              id="username"
              autoComplete="username"
              placeholder="username kamu"
              className="neo-input h-12 pl-12"
              aria-invalid={Boolean(errors.username)}
              {...register("username")}
            />
          </div>
          <FieldError errors={[errors.username]} className="font-semibold" />
        </Field>
        <Field className="gap-2.5">
          <FieldLabel htmlFor="password" className="text-sm font-extrabold">
            Password
          </FieldLabel>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-foreground/55" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="masukkan password"
              className="neo-input h-12 pl-12"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
          </div>
          <FieldError errors={[errors.password]} className="font-semibold" />
        </Field>
        {formError && (
          <FieldError className="border-[3px] border-neo-ink bg-neo-coral p-3 font-bold text-black shadow-neo-sm">
            {formError}
          </FieldError>
        )}
        <button type="submit" disabled={isPending} className="neo-button w-full bg-neo-blue py-3 text-base">
          <LogIn className="size-5" aria-hidden="true" />
          {isPending ? "Memeriksa akun..." : "Masuk"}
        </button>
      </FieldGroup>
    </form>
  );
}
