"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, SpellCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestTurnFeedbackAction } from "../actions";

type Correction = { original: string; corrected: string; reason: string; severity: string };

const SEVERITY_CLASSES: Record<string, string> = {
  info: "bg-white",
  minor: "bg-neo-yellow",
  major: "bg-neo-coral text-white",
};

// Koreksi diminta per giliran, bukan otomatis: menghemat sekitar separuh biaya
// dan tidak memotong alur latihan (keputusan terbuka #5).
export function TurnFeedback({ turnId }: { turnId: number }) {
  const [corrections, setCorrections] = useState<Correction[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (summary !== null) {
    return (
      <div className="mt-3 rounded-md border-2 border-neo-ink bg-background p-3 text-left">
        <p className="text-xs font-black tracking-wider uppercase text-foreground/60">Koreksi</p>
        <p className="mt-1 text-sm font-bold">{summary}</p>

        {corrections && corrections.length > 0 && (
          <ul className="mt-2 space-y-2">
            {corrections.map((item, index) => (
              <li
                key={`${item.original}-${index}`}
                className={cn(
                  "rounded border-2 border-neo-ink p-2 text-sm",
                  SEVERITY_CLASSES[item.severity] ?? "bg-white",
                )}
              >
                <p lang="ja" className="font-japanese font-bold">
                  <span className="line-through opacity-60">{item.original}</span>
                  {" → "}
                  <span>{item.corrected}</span>
                </p>
                <p className="mt-1 text-xs font-semibold">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}

        {corrections && corrections.length === 0 && (
          <p className="mt-2 flex items-center gap-2 text-sm font-bold">
            <Check className="size-4" aria-hidden="true" />
            Tidak ada yang perlu diperbaiki.
          </p>
        )}

        <p className="mt-2 text-xs font-semibold text-foreground/55">
          Ini masukan latihan, bukan penilaian resmi JLPT.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await requestTurnFeedbackAction({ turnId });
            if (result.ok) {
              setCorrections(result.corrections);
              setSummary(result.summary);
            } else {
              setError(result.message);
            }
          })
        }
        className="flex min-h-9 items-center gap-2 rounded-md border-2 border-neo-ink bg-background px-3 text-xs font-bold disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <SpellCheck className="size-4" aria-hidden="true" />
        )}
        Periksa kalimatku
      </button>

      {error && (
        <p role="alert" className="mt-2 flex items-center gap-2 text-xs font-bold text-neo-coral">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
