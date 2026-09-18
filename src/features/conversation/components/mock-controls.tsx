"use client";

import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONVERSATION_MOCK_FAILURES, type ConversationMockFailure } from "../schemas";

// Panel penilaian tahap prototype (§11.1 butir 2). Mock yang selalu mulus akan
// menghasilkan penilaian yang terlalu optimistis, jadi setiap keadaan buruk
// harus dapat dipicu manual dan dinilai desainnya.
const LABELS: Record<ConversationMockFailure, string> = {
  none: "Normal",
  slow: "Lambat",
  timeout: "Timeout",
  provider_error: "Error provider",
  quota_exceeded: "Kuota habis",
  moderation_flagged: "Diblokir filter",
};

export function MockControls({
  value,
  onChange,
}: {
  value: ConversationMockFailure;
  onChange: (next: ConversationMockFailure) => void;
}) {
  return (
    <section
      aria-label="Kontrol simulasi"
      className="rounded-lg border-[3px] border-dashed border-neo-ink/50 bg-background p-4"
    >
      <p className="flex items-center gap-2 text-xs font-black tracking-wider uppercase">
        <FlaskConical className="size-4" aria-hidden="true" />
        Mode simulasi — balasan berasal dari skrip, bukan AI
      </p>
      <p className="mt-1 text-xs font-semibold text-foreground/60">
        Pilih keadaan yang ingin diuji sebelum mengirim pesan berikutnya.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {CONVERSATION_MOCK_FAILURES.map((failure) => (
          <button
            key={failure}
            type="button"
            onClick={() => onChange(failure)}
            aria-pressed={value === failure}
            className={cn(
              "min-h-9 rounded-md border-2 border-neo-ink px-3 text-xs font-bold",
              value === failure ? "bg-neo-ink text-white" : "bg-white text-neo-ink",
            )}
          >
            {LABELS[failure]}
          </button>
        ))}
      </div>
    </section>
  );
}
