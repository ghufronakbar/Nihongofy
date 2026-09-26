"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, Eye, X } from "lucide-react";
import type { ReportStatus } from "@prisma/client";
import { REPORT_ADMIN_NOTE_MAX_LENGTH } from "@/features/report/constants";
import { setReportStatusAction } from "../actions";

const BUTTONS: {
  status: "IN_REVIEW" | "RESOLVED" | "REJECTED" | "DUPLICATE";
  label: string;
  className: string;
  icon: typeof Check;
}[] = [
  { status: "IN_REVIEW", label: "Tinjau", className: "bg-white text-black", icon: Eye },
  { status: "RESOLVED", label: "Selesai", className: "bg-neo-green text-black", icon: Check },
  { status: "REJECTED", label: "Tolak", className: "bg-neo-coral text-white", icon: X },
  { status: "DUPLICATE", label: "Duplikat", className: "bg-white text-black", icon: Copy },
];

export function ReportActions({
  reportId,
  status,
  adminNote,
}: {
  reportId: number;
  status: ReportStatus;
  adminNote: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(adminNote ?? "");

  function run(next: (typeof BUTTONS)[number]["status"]) {
    setError(null);
    startTransition(async () => {
      try {
        await setReportStatusAction({
          reportId,
          status: next,
          // Catatan internal ikut tersimpan bersama perubahan status supaya tidak
          // ada tombol simpan kedua yang mudah terlupa.
          adminNote: note.trim(),
        });
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Aksi gagal.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
        maxLength={REPORT_ADMIN_NOTE_MAX_LENGTH}
        rows={2}
        placeholder="Catatan internal (tidak pernah dikirim ke pelapor)"
        className="w-full border-2 border-neo-ink bg-white px-2.5 py-2 text-xs font-semibold shadow-neo-sm outline-none focus:bg-neo-paper"
      />
      <div className="flex flex-wrap gap-2">
        {BUTTONS.filter((button) => button.status !== status).map((button) => (
          <button
            key={button.status}
            type="button"
            disabled={isPending}
            onClick={() => run(button.status)}
            className={`neo-button text-[11px] font-extrabold ${button.className}`}
          >
            <button.icon className="size-3.5" />
            {button.label}
          </button>
        ))}
      </div>
      {error && <p className="text-[11px] font-bold text-neo-coral">{error}</p>}
    </div>
  );
}
