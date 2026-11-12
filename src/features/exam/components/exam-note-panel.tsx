"use client";

import { useEffect, useRef } from "react";
import { Lock, NotebookPen, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { EXAM_NOTE_MAX_LENGTH } from "../note";

/**
 * Catatan untuk soal yang sedang dibuka. Hanya menampilkan tulisan user di
 * attempt ini (dari `ExamProvider`); catatan lama dan diskusi soal tetap tidak
 * tampil selama ujian karena dapat menyebut jawabannya.
 */
export function ExamNotePanel({
  questionOrder,
  note,
  open,
  focusSignal,
  onOpen,
  onClose,
  onChange,
}: {
  questionOrder: number;
  note: string;
  open: boolean;
  /** Bertambah setiap kali user meminta menulis (tombol atau shortcut N). */
  focusSignal: number;
  onOpen: () => void;
  onClose: () => void;
  onChange: (note: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fokus hanya saat diminta, bukan setiap pindah soal: pindah soal lewat
  // keyboard tidak boleh terjebak di dalam textarea.
  useEffect(() => {
    if (focusSignal > 0) textareaRef.current?.focus();
  }, [focusSignal]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 border-[3px] border-dashed border-neo-ink bg-white px-4 py-3 text-left text-neo-ink transition-colors hover:bg-neo-paper"
      >
        <span className="flex items-center gap-2 text-sm font-black">
          <NotebookPen className="size-4" aria-hidden="true" />
          Tulis catatan untuk soal ini
        </span>
        <span className="hidden border-2 border-neo-ink bg-neo-paper px-1.5 font-mono text-[11px] font-black sm:inline">
          N
        </span>
      </button>
    );
  }

  return (
    <section
      aria-label={`Catatan soal ${questionOrder}`}
      className="neo-surface space-y-3 border-[3px] border-neo-ink bg-white p-4 shadow-neo-sm sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-[11px] font-black uppercase text-black shadow-neo-sm">
            <NotebookPen className="size-3.5" aria-hidden="true" />
            Catatan Soal {questionOrder}
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-foreground/60">
            <Lock className="size-3" aria-hidden="true" />
            Hanya kamu
          </span>
        </div>
        {note === "" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup catatan"
            className="grid size-7 place-items-center border-2 border-neo-ink bg-white text-black hover:bg-neo-paper"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <Textarea
        ref={textareaRef}
        value={note}
        onChange={(event) => onChange(event.target.value)}
        // Esc mengembalikan fokus ke halaman supaya shortcut soal aktif lagi.
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
        maxLength={EXAM_NOTE_MAX_LENGTH}
        rows={3}
        aria-label={`Catatan soal ${questionOrder}`}
        placeholder="Mis. ragu antara pilihan 2 dan 3, belum hafal arti kata ini, ingin tanya pola kalimatnya..."
        className="min-h-24 rounded-lg border-[3px] border-neo-ink bg-white px-3 py-3 font-medium text-black shadow-neo-sm focus-visible:border-neo-ink focus-visible:shadow-neo focus-visible:ring-0 dark:bg-white"
      />

      <div className="flex items-start justify-between gap-3 font-mono text-[11px] font-bold text-foreground/60">
        <p>
          Tersimpan otomatis bersama jawaban. Saat sesi disubmit, catatan ini menjadi Catatan
          Belajar dan tampil di pembahasan soal setelah ujian selesai.
        </p>
        <span className="shrink-0 tabular-nums">
          {note.length}/{EXAM_NOTE_MAX_LENGTH}
        </span>
      </div>
    </section>
  );
}
