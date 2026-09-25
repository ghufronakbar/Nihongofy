"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FlashcardNoteTypeKind } from "@prisma/client";
import { CheckCircle2, Plus, Save, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FLASHCARD_NOTE_TYPES } from "@/features/flashcard/note-types";
import {
  createSystemNoteAction,
  deleteSystemNoteAction,
  updateSystemNoteAction,
} from "../actions";

type NoteDraft = { fields: string[]; tags: string; order: number };

function emptyDraft(kind: FlashcardNoteTypeKind, order: number): NoteDraft {
  return { fields: FLASHCARD_NOTE_TYPES[kind].fields.map(() => ""), tags: "", order };
}

function FieldInputs({
  kind,
  draft,
  onChange,
  disabled,
}: {
  kind: FlashcardNoteTypeKind;
  draft: NoteDraft;
  onChange: (next: NoteDraft) => void;
  disabled: boolean;
}) {
  const definition = FLASHCARD_NOTE_TYPES[kind];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {definition.fields.map((field, index) => (
        <label key={field.key} className="flex flex-col gap-1 last:sm:col-span-2">
          <span className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            {field.label}
            {field.required && <span className="ml-1 text-neo-coral">wajib</span>}
          </span>
          {field.multiline ? (
            <Textarea
              rows={2}
              disabled={disabled}
              value={draft.fields[index] ?? ""}
              onChange={(event) => {
                const fields = [...draft.fields];
                fields[index] = event.target.value;
                onChange({ ...draft, fields });
              }}
              className={field.japanese ? "font-japanese text-sm" : "text-sm"}
            />
          ) : (
            <Input
              disabled={disabled}
              value={draft.fields[index] ?? ""}
              onChange={(event) => {
                const fields = [...draft.fields];
                fields[index] = event.target.value;
                onChange({ ...draft, fields });
              }}
              className={field.japanese ? "font-japanese text-sm" : "text-sm"}
            />
          )}
        </label>
      ))}
    </div>
  );
}

export function NoteCreator({
  deckId,
  noteType,
  nextOrder,
}: {
  deckId: number;
  noteType: FlashcardNoteTypeKind;
  nextOrder: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [guid, setGuid] = useState("");
  const [draft, setDraft] = useState<NoteDraft>(() => emptyDraft(noteType, nextOrder));
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="neo-button self-start bg-neo-blue text-xs font-extrabold text-white"
      >
        <Plus className="size-4" />
        Tambah Note
      </button>
    );
  }

  return (
    <div className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
          Note baru
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid size-7 place-items-center border-2 border-neo-ink bg-white shadow-neo-sm"
          aria-label="Tutup"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
          guid
        </span>
        <Input
          value={guid}
          disabled={isPending}
          onChange={(event) => setGuid(event.target.value)}
          placeholder="mis. n4-vocab-0000"
          className="font-mono text-xs"
        />
        <span className="text-[11px] font-semibold text-foreground/60">
          Harus stabil dan unik dalam deck. Tidak dapat diubah setelah note dibuat.
        </span>
      </label>

      <FieldInputs kind={noteType} draft={draft} onChange={setDraft} disabled={isPending} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            Tag
          </span>
          <Input
            value={draft.tags}
            disabled={isPending}
            onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
            placeholder="dipisah koma"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            Urutan
          </span>
          <Input
            type="number"
            min={0}
            value={draft.order}
            disabled={isPending}
            onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })}
          />
        </label>
      </div>

      {notice && (
        <p className={`text-xs font-bold ${notice.ok ? "text-foreground/70" : "text-neo-coral"}`}>
          {notice.message}
        </p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setNotice(null);
          startTransition(async () => {
            const result = await createSystemNoteAction({
              deckId,
              guid,
              fields: draft.fields,
              tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
              order: draft.order,
            });
            setNotice({ ok: result.ok, message: result.message ?? "Tersimpan." });
            if (result.ok) {
              setGuid("");
              setDraft(emptyDraft(noteType, draft.order + 1));
              router.refresh();
            }
          });
        }}
        className="neo-button self-start bg-neo-blue text-xs font-extrabold text-white"
      >
        <Plus className="size-4" />
        {isPending ? "Menyimpan..." : "Simpan Note"}
      </button>
    </div>
  );
}

export function NoteRow({
  note,
  noteType,
}: {
  note: { id: number; guid: string; fields: string[]; tags: string[]; order: number };
  noteType: FlashcardNoteTypeKind;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NoteDraft>({
    fields: note.fields,
    tags: note.tags.join(", "),
    order: note.order,
  });
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const definition = FLASHCARD_NOTE_TYPES[noteType];
  const sortIndex = Math.max(
    0,
    definition.fields.findIndex((field) => field.isSortField),
  );

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center gap-3 border-b-2 border-neo-ink/15 px-4 py-2.5 last:border-b-0">
        <span className="font-mono text-[10px] text-foreground/50">{note.order}</span>
        <span className="font-japanese text-sm font-bold">
          {note.fields[sortIndex] || <span className="font-sans text-foreground/40">(kosong)</span>}
        </span>
        <span className="font-mono text-[10px] text-foreground/50">{note.guid}</span>
        {note.tags.length > 0 && (
          <span className="font-mono text-[10px] text-foreground/50">{note.tags.join(" · ")}</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-auto neo-button bg-white text-[11px] font-extrabold text-black"
        >
          Sunting
        </button>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 border-b-2 border-neo-ink/15 bg-neo-paper px-4 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-foreground/60">{note.guid}</span>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="grid size-7 place-items-center border-2 border-neo-ink bg-white shadow-neo-sm"
          aria-label="Tutup"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <FieldInputs kind={noteType} draft={draft} onChange={setDraft} disabled={isPending} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Tag"
          value={draft.tags}
          disabled={isPending}
          onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
          placeholder="tag, dipisah koma"
        />
        <Input
          aria-label="Urutan"
          type="number"
          min={0}
          value={draft.order}
          disabled={isPending}
          onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })}
        />
      </div>

      {notice && (
        <p className={`text-xs font-bold ${notice.ok ? "text-foreground/70" : "text-neo-coral"}`}>
          {notice.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setNotice(null);
            startTransition(async () => {
              const result = await updateSystemNoteAction({
                id: note.id,
                fields: draft.fields,
                tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
                order: draft.order,
              });
              setNotice({ ok: result.ok, message: result.message ?? "Tersimpan." });
              if (result.ok) {
                setEditing(false);
                router.refresh();
              }
            });
          }}
          className="neo-button bg-neo-blue text-[11px] font-extrabold text-white"
        >
          <Save className="size-3.5" />
          Simpan
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (
              !window.confirm(
                `Hapus note ${note.guid}?\n\nKoleksi user yang sudah menambahkan deck ini tidak terpengaruh — isinya sudah disalin.`,
              )
            )
              return;
            startTransition(async () => {
              const result = await deleteSystemNoteAction({ id: note.id });
              if (result.ok) router.refresh();
              else setNotice({ ok: false, message: result.message });
            });
          }}
          className="neo-button bg-white text-[11px] font-extrabold text-neo-coral"
        >
          <Trash2 className="size-3.5" />
          Hapus
        </button>
        {notice?.ok && <CheckCircle2 className="size-4 self-center stroke-[2.5] text-neo-blue" />}
      </div>
    </li>
  );
}
