"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileProvider, TurnstileWidget } from "@/features/auth/components/turnstile";
import { TURNSTILE_ACTIONS } from "@/features/auth/lib/turnstile-config";
import { cn } from "@/lib/utils";
import { submitReportAction, type ReportFormContext } from "../actions";
import {
  REPORT_CATEGORY_LABELS,
  REPORT_MESSAGE_MAX_LENGTH,
  reportCategoriesFor,
  reportCategoryHint,
} from "../constants";
import { ReportFormSchema, type ReportFormValues, type ReportTarget } from "../schemas";

// Satu form dipakai dua tempat: dialog tombol "Laporkan" dan halaman /report.
// Bedanya hanya dari mana `context` datang — halaman menerimanya sebagai props
// dari server, dialog mengambilnya lewat action saat dibuka.

export function ReportForm({
  target,
  context,
  onSuccess,
  className,
}: {
  target: ReportTarget;
  context: ReportFormContext;
  onSuccess?: () => void;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(ReportFormSchema),
    defaultValues: {
      // Tanpa default: kategori menentukan ke antrean mana laporan ini masuk,
      // jadi biar pelapor yang memilihnya.
      category: undefined,
      message: "",
      replyEmail: "",
      useAccountEmail: false,
      turnstileToken: "",
    },
  });

  const category = useWatch({ control, name: "category" });
  const message = useWatch({ control, name: "message" });
  const turnstileToken = useWatch({ control, name: "turnstileToken" });
  const useAccountEmail = useWatch({ control, name: "useAccountEmail" });

  const categories = reportCategoriesFor(target.targetType);
  const submitBlocked = isPending || (context.requiresCaptcha && !turnstileToken);

  function onSubmit(values: ReportFormValues) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await submitReportAction({
          ...target,
          category: values.category,
          message: values.message,
          replyEmail: values.replyEmail,
          useAccountEmail: values.useAccountEmail,
          turnstileToken: values.turnstileToken,
          // Hanya path, tanpa query string: query dapat memuat parameter yang
          // bukan urusan laporan.
          pagePath: typeof window === "undefined" ? undefined : window.location.pathname,
        });
        setNotice(result);
        if (result.ok) {
          reset({
            category: undefined,
            message: "",
            replyEmail: "",
            useAccountEmail: false,
            turnstileToken: "",
          });
          onSuccess?.();
        }
      } finally {
        setValue("turnstileToken", "");
        setTurnstileResetSignal((current) => current + 1);
      }
    });
  }

  const body = (
    <form onSubmit={handleSubmit(onSubmit)} className={className} noValidate>
      <fieldset disabled={isPending}>
        <FieldGroup className="gap-4">
          <input type="hidden" {...register("turnstileToken")} />

          <Field className="gap-2">
            <FieldLabel className="text-sm font-extrabold">Jenis laporan</FieldLabel>
            <div className="grid gap-1.5">
              {categories.map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 border-2 border-neo-ink p-2.5 text-left transition-colors",
                    category === option ? "bg-neo-yellow" : "bg-white hover:bg-neo-paper",
                  )}
                >
                  <input
                    type="radio"
                    value={option}
                    checked={category === option}
                    onChange={() => setValue("category", option, { shouldValidate: true })}
                    className="mt-0.5 size-4 shrink-0 accent-neo-ink"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">
                      {REPORT_CATEGORY_LABELS[option]}
                    </span>
                    <span className="block text-xs font-semibold text-foreground/65">
                      {reportCategoryHint(target.targetType, option)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError errors={[errors.category]} className="font-semibold" />
          </Field>

          <Field className="gap-2">
            <FieldLabel htmlFor="report-message" className="text-sm font-extrabold">
              Ceritakan yang Anda temukan
            </FieldLabel>
            <Textarea
              id="report-message"
              rows={5}
              placeholder="Apa yang terjadi, dan apa yang Anda harapkan seharusnya terjadi?"
              className="neo-input"
              aria-invalid={Boolean(errors.message)}
              {...register("message")}
            />
            <p className="font-mono text-[11px] font-bold text-foreground/50">
              {(message ?? "").length}/{REPORT_MESSAGE_MAX_LENGTH}
            </p>
            <FieldError errors={[errors.message]} className="font-semibold" />
          </Field>

          {context.requiresCaptcha ? (
            <Field className="gap-2">
              <FieldLabel htmlFor="report-reply-email" className="text-sm font-extrabold">
                Email (opsional)
              </FieldLabel>
              <Input
                id="report-reply-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="nama@email.com"
                className="neo-input h-11"
                aria-invalid={Boolean(errors.replyEmail)}
                {...register("replyEmail")}
              />
              <p className="text-xs font-semibold text-foreground/65">
                Hanya dipakai bila kami perlu menjawab laporan ini. Tidak untuk apa pun yang lain,
                dan admin berhak tidak membalas.
              </p>
              <FieldError errors={[errors.replyEmail]} className="font-semibold" />
            </Field>
          ) : context.canBeContacted ? (
            <label className="flex items-start gap-2.5 text-sm font-semibold">
              <Checkbox
                checked={useAccountEmail}
                onCheckedChange={(checked) => setValue("useAccountEmail", checked === true)}
                className="mt-0.5"
              />
              <span>
                Boleh dibalas ke email akun saya. Admin berhak menjawab atau tidak.
              </span>
            </label>
          ) : null}

          {context.requiresCaptcha && (
            <>
              <TurnstileWidget
                action={TURNSTILE_ACTIONS.report}
                resetSignal={turnstileResetSignal}
                onTokenChange={(token) =>
                  setValue("turnstileToken", token ?? "", { shouldValidate: true })
                }
              />
              <FieldError errors={[errors.turnstileToken]} className="font-semibold" />
            </>
          )}

          {notice && (
            <p
              role={notice.ok ? "status" : "alert"}
              className={cn(
                "border-[3px] border-black p-3 text-sm font-bold text-black shadow-neo-sm",
                notice.ok ? "bg-neo-green" : "bg-neo-coral",
              )}
            >
              {notice.message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitBlocked}
            className="neo-button w-full bg-neo-yellow disabled:opacity-60"
          >
            <Send className="size-4" aria-hidden="true" />
            {isPending ? "Mengirim..." : "Kirim laporan"}
          </button>
        </FieldGroup>
      </fieldset>
    </form>
  );

  // Provider Turnstile dipasang di sini, bukan di layout: form ini muncul di
  // mana-mana (dialog soal, pembahasan, diskusi) dan tidak selalu berada di bawah
  // satu induk yang sama.
  if (!context.requiresCaptcha || !context.siteKey) return body;
  return <TurnstileProvider siteKey={context.siteKey}>{body}</TurnstileProvider>;
}
