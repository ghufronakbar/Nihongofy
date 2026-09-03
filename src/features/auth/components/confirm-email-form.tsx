"use client";

import { useState, useTransition } from "react";
import { BadgeCheck } from "lucide-react";
import { confirmEmailAction } from "../actions";
import { TurnstileWidget } from "./turnstile";
import { TURNSTILE_ACTIONS } from "../lib/turnstile-config";

export function ConfirmEmailForm({ token, label }: { token: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await confirmEmailAction({ token, turnstileToken });
        if (result?.message) setError(result.message);
      } finally {
        setTurnstileToken(null);
        setTurnstileResetSignal((current) => current + 1);
      }
    });
  }

  return (
    <div className="grid gap-4">
      {error ? (
        <p role="alert" className="border-[3px] border-black bg-neo-coral p-3 font-bold text-black shadow-neo-sm">
          {error}
        </p>
      ) : null}
      <TurnstileWidget
        action={TURNSTILE_ACTIONS.confirmEmail}
        resetSignal={turnstileResetSignal}
        onTokenChange={setTurnstileToken}
      />
      <button type="button" onClick={confirm} disabled={isPending || !turnstileToken} className="neo-button w-full bg-neo-green">
        <BadgeCheck className="size-5" aria-hidden="true" />
        {isPending ? "Mengonfirmasi..." : label}
      </button>
    </div>
  );
}
