"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ShareStatus = "idle" | "sharing" | "shared" | "copied" | "error";

const SHARE_TITLE = "Deck Anki SIM Gentsuki Jepang";
const SHARE_TEXT =
  "Deck Anki untuk mendampingi persiapan ujian SIM gentsuki Jepang.";

export function GentsukiShareActions({ pageUrl }: { pageUrl: string }) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  function showTemporaryStatus(nextStatus: ShareStatus) {
    setStatus(nextStatus);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 3200);
  }

  async function sharePage() {
    setStatus("sharing");

    try {
      if (navigator.share) {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: pageUrl });
        showTemporaryStatus("shared");
        return;
      }

      if (!navigator.clipboard) throw new Error("Clipboard API tidak tersedia");
      await navigator.clipboard.writeText(pageUrl);
      showTemporaryStatus("copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
      showTemporaryStatus("error");
    }
  }

  const isDone = status === "shared" || status === "copied";
  const label =
    status === "sharing"
      ? "Membuka pilihan..."
      : status === "shared"
        ? "Berhasil dibagikan"
        : status === "copied"
          ? "Tautan disalin"
          : "Bagikan halaman";

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={sharePage}
        disabled={status === "sharing"}
        className="neo-button bg-neo-yellow px-7 py-3.5 text-base"
      >
        {isDone ? (
          <Check className="size-5" strokeWidth={2.5} aria-hidden="true" />
        ) : status === "error" ? (
          <Copy className="size-5" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <Share2 className="size-5" strokeWidth={2.5} aria-hidden="true" />
        )}
        {label}
      </button>
      <p className="min-h-5 text-sm font-bold text-neo-ink/75" aria-live="polite">
        {status === "error"
          ? "Salin alamat halaman ini langsung dari bilah alamat browser."
          : "Di desktop tanpa menu share, tautan akan otomatis disalin."}
      </p>
    </div>
  );
}
