"use client";

import { useState } from "react";
import { NotebookPen, Plus } from "lucide-react";
import type { OwnNote } from "@/features/question-comment/queries";
import { CommentItem } from "@/features/question-comment/components/comment-item";
import { QuestionCommentForm } from "@/features/question-comment/components/question-comment-form";

/** Atribut penanda area yang mematikan pintasan keyboard reviewer. */
export const REVIEWER_KEYS_OFF = { "data-reviewer-keys": "off" } as const;

type Props = {
  vocabId: number;
  notes: OwnNote[];
  /** Tombol bagikan ke diskusi; mati bila diskusi publik tidak tersedia. */
  canShare: boolean;
  /** Dipanggil setelah catatan berubah supaya reviewer mengambil ulang catatan kata ini. */
  onChanged: () => void;
};

/**
 * Catatan pribadi user untuk satu kata, tampil di sisi belakang kartu seperti
 * field catatan di Anki. Berlaku di semua deck yang memuat kata ini.
 *
 * Semua aksi memakai `onChanged`, bukan refresh halaman: me-refresh halaman
 * belajar membangun ulang antrean dan mereset sesi.
 */
export function CardNotes({ vocabId, notes, canShare, onChanged }: Props) {
  const [adding, setAdding] = useState(false);

  return (
    <section
      {...REVIEWER_KEYS_OFF}
      aria-labelledby={`card-notes-${vocabId}`}
      className="rounded-lg border-[3px] border-neo-ink bg-card p-4 shadow-neo-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id={`card-notes-${vocabId}`}
          className="inline-flex items-center gap-1.5 text-sm font-black"
        >
          <NotebookPen className="size-4" aria-hidden /> Catatanku
          {notes.length > 0 ? (
            <span className="text-xs font-bold text-muted-foreground tabular-nums">
              ({notes.length})
            </span>
          ) : null}
        </h2>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-black underline underline-offset-4"
          >
            <Plus className="size-3.5" aria-hidden /> Tambah catatan
          </button>
        ) : null}
      </div>

      {notes.length === 0 && !adding ? (
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          Tulis jembatan keledai atau kata yang sering tertukar. Catatan ini tampil setiap kali
          kartu ini dibuka, di deck mana pun.
        </p>
      ) : null}

      {notes.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          {notes.map((note) => (
            <CommentItem key={note.id} comment={note} canShare={canShare} onChanged={onChanged} />
          ))}
        </div>
      ) : null}

      {adding ? (
        <div className="mt-3">
          <QuestionCommentForm
            target={{ type: "vocab", vocabId }}
            placeholder="Catatan untuk kata ini, mis. jembatan keledai..."
            onSaved={() => {
              setAdding(false);
              onChanged();
            }}
          />
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="mt-1 text-xs font-semibold text-muted-foreground hover:underline"
          >
            Batal
          </button>
        </div>
      ) : null}
    </section>
  );
}
