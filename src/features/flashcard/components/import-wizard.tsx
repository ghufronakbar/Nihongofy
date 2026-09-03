"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Upload } from "lucide-react";
import type { FlashcardNoteTypeKind } from "@prisma/client";
import { FLASHCARD_NOTE_TYPES, FLASHCARD_NOTE_TYPE_KINDS } from "../note-types";
import { parseAnkiText, type ParsedAnkiText } from "../lib/import/parse-text";
import {
  FLASHCARD_IMPORT_CHUNK_SIZE,
  IMPORT_MODES,
  mapRows,
  suggestMapping,
  validateMapping,
  type ColumnRole,
  type ImportMapping,
  type ImportMode,
} from "../lib/import/mapping";
import {
  createImportJobAction,
  finishImportJobAction,
  importChunkAction,
  type ImportStats,
} from "../import-actions";

/**
 * Seluruh parsing dan pemetaan berjalan di browser; server hanya menerima baris
 * yang sudah bersih, per batch. File 20 MB pun tidak pernah menyentuh limit body
 * Vercel, dan user bisa memperbaiki pemetaan sebelum satu baris masuk database.
 */

const MODE_LABELS: Record<ImportMode, { label: string; hint: string }> = {
  update: {
    label: "Perbarui yang sudah ada",
    hint: "Note yang cocok diperbarui isinya; jadwal belajarnya dipertahankan.",
  },
  ignoreDuplicates: {
    label: "Lewati duplikat",
    hint: "Note yang cocok tidak disentuh sama sekali.",
  },
  importAsNew: {
    label: "Impor semua sebagai baru",
    hint: "Tidak ada pencocokan; semua baris menjadi note baru.",
  },
};

const selectClass =
  "h-10 rounded-lg border-[3px] border-neo-ink bg-white px-2 text-sm font-bold text-black shadow-neo-sm outline-none";
const inputClass =
  "h-11 w-full rounded-lg border-[3px] border-neo-ink bg-white px-3 font-bold text-black shadow-neo-sm outline-none";

type Phase = "pick" | "configure" | "running" | "done";

export function ImportWizard({ defaultDeckName }: { defaultDeckName: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("pick");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedAnkiText | null>(null);
  const [noteType, setNoteType] = useState<FlashcardNoteTypeKind>("VOCAB_JP");
  const [columns, setColumns] = useState<ColumnRole[]>([]);
  const [deckName, setDeckName] = useState(defaultDeckName);
  const [mode, setMode] = useState<ImportMode>("update");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportStats | null>(null);

  const definition = FLASHCARD_NOTE_TYPES[noteType];

  const mapping: ImportMapping = useMemo(
    () => ({ noteType, columns, deckName, extraTags: [] }),
    [columns, deckName, noteType],
  );

  const mappingErrors = useMemo(
    () => (parsed ? validateMapping(mapping) : []),
    [mapping, parsed],
  );

  const preview = useMemo(
    () => (parsed ? mapRows(parsed, mapping, 20) : null),
    [mapping, parsed],
  );

  async function onPickFile(file: File) {
    const text = await file.text();
    const result = parseAnkiText(text);

    if (result.rows.length === 0) {
      toast.error("File tidak berisi baris data.");
      return;
    }

    const initialNoteType = result.headers.notetype
      ? (FLASHCARD_NOTE_TYPE_KINDS.find(
          (kind) =>
            FLASHCARD_NOTE_TYPES[kind].label.toLowerCase() ===
            result.headers.notetype!.toLowerCase(),
        ) ?? "VOCAB_JP")
      : "VOCAB_JP";

    setFileName(file.name);
    setParsed(result);
    setNoteType(initialNoteType);
    setColumns(suggestMapping(result, initialNoteType));
    setDeckName(result.headers.deck ?? defaultDeckName);
    setPhase("configure");
  }

  function changeNoteType(next: FlashcardNoteTypeKind) {
    setNoteType(next);
    if (parsed) setColumns(suggestMapping(parsed, next));
  }

  function setColumnRole(index: number, role: ColumnRole) {
    setColumns((current) => current.map((item, at) => (at === index ? role : item)));
  }

  async function runImport() {
    if (!parsed) return;

    const mapped = mapRows(parsed, mapping);
    if (mapped.rows.length === 0) {
      toast.error("Tidak ada baris yang bisa diimpor.");
      return;
    }

    setPhase("running");
    setProgress(0);

    const job = await createImportJobAction({
      fileName,
      totalRows: mapped.rows.length,
    });
    if (!job.ok) {
      toast.error(job.message);
      setPhase("configure");
      return;
    }

    let stats: ImportStats | null = null;
    for (let start = 0; start < mapped.rows.length; start += FLASHCARD_IMPORT_CHUNK_SIZE) {
      const chunk = mapped.rows.slice(start, start + FLASHCARD_IMPORT_CHUNK_SIZE);
      const sent = await importChunkAction({
        jobId: job.data.jobId,
        noteType,
        mode,
        rows: chunk.map((row) => ({
          guid: row.guid,
          fields: row.fields,
          tags: row.tags,
          deckName: row.deckName,
          checksum: row.checksum,
        })),
      });

      if (!sent.ok) {
        toast.error(sent.message);
        setPhase("configure");
        return;
      }
      stats = sent.data;
      setProgress(Math.min(100, Math.round(((start + chunk.length) / mapped.rows.length) * 100)));
    }

    const finished = await finishImportJobAction({
      jobId: job.data.jobId,
      problemCount: mapped.problems.length,
    });

    setResult(finished.ok ? finished.data : stats);
    setPhase("done");
    router.refresh();
  }

  // --- Tampilan --------------------------------------------------------------

  if (phase === "pick") {
    return (
      <div className="neo-surface p-6">
        <h2 className="font-black">Pilih file</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          File teks atau CSV format Anki. Header <code>#separator</code>,{" "}
          <code>#columns</code>, <code>#deck</code>, <code>#tags</code>, dan{" "}
          <code>#guid column</code> dikenali otomatis.
        </p>

        <input
          ref={fileInput}
          type="file"
          accept=".csv,.txt,.tsv,text/plain,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onPickFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="neo-button mt-5 bg-neo-yellow"
        >
          <FileText className="size-4" aria-hidden /> Pilih file
        </button>
      </div>
    );
  }

  if (phase === "running") {
    return (
      <div className="neo-surface p-6 text-center">
        <Loader2 className="mx-auto size-8 animate-spin" aria-hidden />
        <p className="mt-4 font-black">Mengimpor… {progress}%</p>
        <div className="mt-3 h-4 overflow-hidden rounded border-[3px] border-neo-ink bg-white">
          <div className="h-full bg-neo-green transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="neo-surface p-6">
        <h2 className="text-xl font-black">Impor selesai</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Note baru", value: result.added },
            { label: "Diperbarui", value: result.updated },
            { label: "Dilewati", value: result.skipped },
            { label: "Kartu dibuat", value: result.cards },
          ].map((item) => (
            <div key={item.label} className="rounded border-[3px] border-neo-ink p-3 text-center">
              <dt className="text-xs font-black uppercase text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-2xl font-black tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
        <a href="/flashcard" className="neo-button mt-6 bg-neo-yellow">
          Lihat deck
        </a>
      </div>
    );
  }

  if (!parsed || !preview) return null;

  return (
    <div className="grid gap-5">
      <section className="neo-surface p-5">
        <h2 className="font-black">{fileName}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {parsed.rows.length} baris, {parsed.columnCount} kolom, separator{" "}
          <code>{parsed.headers.separator === "\t" ? "Tab" : parsed.headers.separator}</code>
        </p>
        {parsed.warnings.map((warning) => (
          <p key={warning} className="mt-2 flex gap-2 text-sm font-bold text-neo-coral">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> {warning}
          </p>
        ))}
      </section>

      <section className="neo-surface p-5">
        <h2 className="font-black">Tujuan</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5">
            <span className="font-extrabold">Note type</span>
            <select
              className={selectClass}
              value={noteType}
              onChange={(event) => changeNoteType(event.target.value as FlashcardNoteTypeKind)}
            >
              {FLASHCARD_NOTE_TYPE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {FLASHCARD_NOTE_TYPES[kind].label}
                </option>
              ))}
            </select>
            <span className="text-xs font-semibold text-muted-foreground">
              {definition.description}
            </span>
          </label>

          <label className="grid gap-1.5">
            <span className="font-extrabold">Deck tujuan</span>
            <input
              className={inputClass}
              value={deckName}
              onChange={(event) => setDeckName(event.target.value)}
              placeholder="Impor::Deck baru"
            />
            <span className="text-xs font-semibold text-muted-foreground">
              Pakai :: untuk subdeck. Diabaikan bila ada kolom deck.
            </span>
          </label>

          <fieldset className="grid gap-2">
            <legend className="font-extrabold">Duplikat</legend>
            {IMPORT_MODES.map((value) => (
              <label key={value} className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="mode"
                  className="mt-0.5 size-4 shrink-0 accent-black"
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                <span>
                  <span className="block font-bold">{MODE_LABELS[value].label}</span>
                  <span className="block text-xs font-semibold text-muted-foreground">
                    {MODE_LABELS[value].hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      <section className="neo-surface p-5">
        <h2 className="font-black">Pemetaan kolom</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Tentukan isi tiap kolom file. Field bertanda * wajib diisi.
        </p>

        <div className="mt-4 grid gap-3">
          {columns.map((role, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <span className="block font-extrabold">
                  Kolom {index + 1}
                  {parsed.headers.columns?.[index]
                    ? ` — ${parsed.headers.columns[index]}`
                    : ""}
                </span>
                <span className="block truncate text-xs font-semibold text-muted-foreground">
                  {parsed.rows[0]?.[index] || "(kosong)"}
                </span>
              </div>
              <select
                className={selectClass}
                value={role.kind === "field" ? `field:${role.fieldKey}` : role.kind}
                onChange={(event) => {
                  const value = event.target.value;
                  setColumnRole(
                    index,
                    value.startsWith("field:")
                      ? { kind: "field", fieldKey: value.slice(6) }
                      : ({ kind: value } as ColumnRole),
                  );
                }}
              >
                <option value="ignore">— Abaikan —</option>
                {definition.fields.map((field) => (
                  <option key={field.key} value={`field:${field.key}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </option>
                ))}
                <option value="tags">Tags</option>
                <option value="deck">Deck</option>
                <option value="guid">GUID</option>
              </select>
            </div>
          ))}
        </div>

        {mappingErrors.map((error) => (
          <p key={error} className="mt-3 flex gap-2 text-sm font-bold text-neo-coral">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> {error}
          </p>
        ))}
      </section>

      <section className="neo-surface p-5">
        <h2 className="font-black">Pratinjau</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {preview.rows.length} dari 20 baris pertama akan diimpor
          {preview.problems.length > 0 ? `, ${preview.problems.length} dilewati` : ""}.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b-[3px] border-neo-ink text-left">
                {definition.fields.map((field) => (
                  <th key={field.key} className="px-2 py-1 font-black">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 8).map((row, index) => (
                <tr key={index} className="border-b border-dashed border-neo-ink/40">
                  {row.fields.map((value, at) => (
                    <td key={at} className="max-w-40 truncate px-2 py-1 font-semibold">
                      {value || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {preview.problems.length > 0 ? (
          <p className="mt-3 text-xs font-bold text-neo-coral">
            Baris {preview.problems[0]!.rowIndex + 1}: {preview.problems[0]!.message}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void runImport()}
          disabled={mappingErrors.length > 0 || preview.rows.length === 0}
          className="neo-button bg-neo-yellow"
        >
          <Upload className="size-4" aria-hidden /> Impor {parsed.rows.length} baris
        </button>
        <button type="button" onClick={() => setPhase("pick")} className="neo-button bg-white">
          Ganti file
        </button>
      </div>
    </div>
  );
}
