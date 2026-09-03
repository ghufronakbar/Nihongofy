"use client";

import { useEffect, useState, useTransition } from "react";
import { MailCheck, RefreshCw } from "lucide-react";
import { resendVerificationAction } from "../actions";
import { TurnstileWidget } from "./turnstile";
import { TURNSTILE_ACTIONS } from "../lib/turnstile-config";

export function VerifyEmailPanel({
  initialCooldownSeconds,
  initialMessage,
}: {
  initialCooldownSeconds: number;
  initialMessage: { ok: boolean; text: string } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [cooldownSeconds, setCooldownSeconds] = useState(initialCooldownSeconds);
  const [notice, setNotice] = useState(initialMessage);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  function resend() {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await resendVerificationAction({ turnstileToken });
        if (!result) return;
        setNotice({ ok: result.ok, text: result.message });
        if (result.retryAfterSeconds) setCooldownSeconds(result.retryAfterSeconds);
      } finally {
        setTurnstileToken(null);
        setTurnstileResetSignal((current) => current + 1);
      }
    });
  }

  return (
    <div className="grid gap-5">
      <div className="border-[3px] border-black bg-neo-paper p-4 shadow-neo-sm">
        <MailCheck className="size-7" aria-hidden="true" />
        <p className="mt-3 text-sm font-bold leading-6">
          Buka email terbaru dan tekan tombol konfirmasi. Link lama otomatis tidak berlaku setelah
          email baru dikirim.
        </p>
      </div>

      {notice ? (
        <p
          role={notice.ok ? "status" : "alert"}
          className={`border-[3px] border-black p-3 font-bold text-black shadow-neo-sm ${notice.ok ? "bg-neo-green" : "bg-neo-coral"}`}
        >
          {notice.text}
        </p>
      ) : null}

      <TurnstileWidget
        action={TURNSTILE_ACTIONS.resendVerification}
        resetSignal={turnstileResetSignal}
        onTokenChange={setTurnstileToken}
      />

      <button
        type="button"
        onClick={resend}
        disabled={isPending || cooldownSeconds > 0 || !turnstileToken}
        className="neo-button w-full bg-neo-yellow"
      >
        <RefreshCw className={`size-5 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
        {isPending
          ? "Mengirim..."
          : cooldownSeconds > 0
            ? `Kirim lagi dalam ${cooldownSeconds} detik`
            : "Kirim ulang email"}
      </button>
    </div>
  );
}
