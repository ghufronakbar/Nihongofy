"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { REPORT_REPLY_MAX_LENGTH } from "@/features/report/constants";
import { replyToReportAction } from "../actions";

/**
 * Balasan email opsional. Hanya dirender bila pelapor meninggalkan alamat dan
 * belum pernah dibalas — admin berhak menjawab atau tidak, dan tidak ada balasan
 * kedua.
 */
export function ReportReplyForm({ reportId }: { reportId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await replyToReportAction({ reportId, replyMessage: message.trim() });
        setOpen(false);
        setMessage("");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Balasan gagal dikirim.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="neo-button bg-neo-blue text-[11px] font-extrabold text-black"
      >
        <Mail className="size-3.5" />
        Balas via email
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-2 border-neo-ink bg-neo-paper p-3">
      <p className="font-mono text-[10px] font-black uppercase text-foreground/60">
        Email ini hanya memuat kategori, tanggal, dan teks di bawah — isi laporan tidak dikutip.
      </p>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.currentTarget.value)}
        maxLength={REPORT_REPLY_MAX_LENGTH}
        rows={4}
        placeholder="Jawaban untuk pelapor..."
        className="w-full border-2 border-neo-ink bg-white px-2.5 py-2 text-xs font-semibold shadow-neo-sm outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isPending || message.trim().length === 0}
          onClick={submit}
          className="neo-button bg-neo-green text-[11px] font-extrabold text-black disabled:opacity-60"
        >
          <Mail className="size-3.5" />
          {isPending ? "Mengirim..." : "Kirim balasan"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="neo-button bg-white text-[11px] font-extrabold text-black"
        >
          Batal
        </button>
      </div>
      {error && <p className="text-[11px] font-bold text-neo-coral">{error}</p>}
    </div>
  );
}
