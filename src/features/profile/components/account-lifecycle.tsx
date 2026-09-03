"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/features/auth/components/password-input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  cancelAccountDeletionAction,
  requestAccountDeletionAction,
} from "../privacy-actions";
import {
  CancelAccountDeletionSchema,
  RequestAccountDeletionSchema,
  type CancelAccountDeletionInput,
  type RequestAccountDeletionInput,
} from "../schemas";

export function AccountLifecycle({
  scheduledForLabel,
  hasPassword,
  googleConnected,
  googleReauth,
  googleNotice,
}: {
  scheduledForLabel: string | null;
  hasPassword: boolean;
  googleConnected: boolean;
  googleReauth: string | null;
  googleNotice: string | null;
}) {
  return scheduledForLabel ? (
    <CancelDeletionForm
      scheduledForLabel={scheduledForLabel}
      hasPassword={hasPassword}
      googleConnected={googleConnected}
      googleReauthenticated={googleReauth === "cancel-deletion"}
      googleNotice={googleNotice}
    />
  ) : (
    <RequestDeletionForm
      hasPassword={hasPassword}
      googleConnected={googleConnected}
      googleReauthenticated={googleReauth === "request-deletion"}
      googleNotice={googleNotice}
    />
  );
}

function RequestDeletionForm({
  hasPassword,
  googleConnected,
  googleReauthenticated,
  googleNotice,
}: {
  hasPassword: boolean;
  googleConnected: boolean;
  googleReauthenticated: boolean;
  googleNotice: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestAccountDeletionInput>({
    resolver: zodResolver(RequestAccountDeletionSchema),
    defaultValues: { currentPassword: hasPassword ? "" : undefined, confirmation: "" },
  });

  function onSubmit(values: RequestAccountDeletionInput) {
    setNotice(null);
    startTransition(async () => {
      setNotice(await requestAccountDeletionAction(values));
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <div className="flex items-start gap-3 border-[3px] border-black bg-neo-yellow p-4 shadow-neo-sm">
        <AlertTriangle className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
        <p className="text-sm font-bold">
          Setelah dikonfirmasi, semua perangkat langsung logout. Akun dihapus permanen setelah masa
          tenggang 7 hari dan masih dapat dipulihkan dengan login lalu membatalkan jadwal.
        </p>
      </div>

      {hasPassword ? (
        <Field>
          <FieldLabel htmlFor="deleteCurrentPassword" className="font-extrabold">
            Password saat ini
          </FieldLabel>
          <PasswordInput
            id="deleteCurrentPassword"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            {...register("currentPassword")}
          />
          <FieldError errors={[errors.currentPassword]} className="font-semibold" />
        </Field>
      ) : googleConnected && !googleReauthenticated ? (
        <div className="grid gap-3">
          <p className="text-sm font-semibold text-foreground/70">
            Verifikasi ulang Google diperlukan sebelum akun dapat dijadwalkan untuk dihapus.
          </p>
          <a
            href="/api/auth/google/start?intent=request-deletion"
            className="neo-button w-full bg-white sm:w-fit"
          >
            Verifikasi dengan Google
          </a>
        </div>
      ) : !googleConnected ? (
        <p role="alert" className="border-[3px] border-black bg-neo-coral p-3 font-bold shadow-neo-sm">
          Akun tidak memiliki metode reauthentication yang tersedia.
        </p>
      ) : (
        <p role="status" className="border-[3px] border-black bg-neo-green p-3 font-bold shadow-neo-sm">
          Google berhasil diverifikasi. Konfirmasi penghapusan dalam lima menit.
        </p>
      )}

      {googleNotice ? (
        <p role="alert" className="border-[3px] border-black bg-neo-coral p-3 font-bold shadow-neo-sm">
          {googleNotice}
        </p>
      ) : null}

      <Field>
        <FieldLabel htmlFor="deleteConfirmation" className="font-extrabold">
          Ketik HAPUS AKUN
        </FieldLabel>
        <Input
          id="deleteConfirmation"
          autoComplete="off"
          className="neo-input"
          aria-invalid={Boolean(errors.confirmation)}
          {...register("confirmation")}
        />
        <FieldDescription>Tindakan permanen baru dijalankan setelah grace period berakhir.</FieldDescription>
        <FieldError errors={[errors.confirmation]} className="font-semibold" />
      </Field>

      {notice ? (
        <p role="alert" className="border-[3px] border-black bg-neo-coral p-3 font-bold shadow-neo-sm">
          {notice.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || (!hasPassword && !googleReauthenticated)}
        className="neo-button w-full bg-neo-coral sm:w-fit"
      >
        <Trash2 className="size-5" aria-hidden="true" />
        {isPending ? "Menjadwalkan..." : "Jadwalkan penghapusan akun"}
      </button>
    </form>
  );
}

function CancelDeletionForm({
  scheduledForLabel,
  hasPassword,
  googleConnected,
  googleReauthenticated,
  googleNotice,
}: {
  scheduledForLabel: string;
  hasPassword: boolean;
  googleConnected: boolean;
  googleReauthenticated: boolean;
  googleNotice: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelAccountDeletionInput>({
    resolver: zodResolver(CancelAccountDeletionSchema),
    defaultValues: { currentPassword: hasPassword ? "" : undefined },
  });

  function onSubmit(values: CancelAccountDeletionInput) {
    setNotice(null);
    startTransition(async () => {
      const result = await cancelAccountDeletionAction(values);
      setNotice(result);
      if (result.ok) {
        reset();
        router.replace("/profile/privacy");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <div className="border-[3px] border-black bg-neo-coral p-4 shadow-neo-sm">
        <p className="font-black">Akun dijadwalkan untuk dihapus</p>
        <p className="mt-1 text-sm font-semibold">Penghapusan permanen: {scheduledForLabel}</p>
      </div>

      {hasPassword ? (
        <Field>
          <FieldLabel htmlFor="cancelCurrentPassword" className="font-extrabold">
            Password saat ini
          </FieldLabel>
          <PasswordInput
            id="cancelCurrentPassword"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            {...register("currentPassword")}
          />
          <FieldError errors={[errors.currentPassword]} className="font-semibold" />
        </Field>
      ) : googleConnected && !googleReauthenticated ? (
        <div className="grid gap-3">
          <p className="text-sm font-semibold text-foreground/70">
            Verifikasi ulang Google diperlukan untuk membatalkan penghapusan akun.
          </p>
          <a
            href="/api/auth/google/start?intent=cancel-deletion"
            className="neo-button w-full bg-white sm:w-fit"
          >
            Verifikasi dengan Google
          </a>
        </div>
      ) : !googleConnected ? (
        <p role="alert" className="border-[3px] border-black bg-neo-coral p-3 font-bold shadow-neo-sm">
          Akun tidak memiliki metode reauthentication yang tersedia.
        </p>
      ) : (
        <p role="status" className="border-[3px] border-black bg-neo-green p-3 font-bold shadow-neo-sm">
          Google berhasil diverifikasi. Batalkan penghapusan dalam lima menit.
        </p>
      )}

      {googleNotice ? (
        <p role="alert" className="border-[3px] border-black bg-neo-coral p-3 font-bold shadow-neo-sm">
          {googleNotice}
        </p>
      ) : null}

      {notice ? (
        <p
          role={notice.ok ? "status" : "alert"}
          className={`border-[3px] border-black p-3 font-bold shadow-neo-sm ${notice.ok ? "bg-neo-green" : "bg-neo-coral"}`}
        >
          {notice.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || (!hasPassword && !googleReauthenticated)}
        className="neo-button w-full bg-neo-green sm:w-fit"
      >
        <RotateCcw className="size-5" aria-hidden="true" />
        {isPending ? "Membatalkan..." : "Batalkan penghapusan"}
      </button>
    </form>
  );
}
