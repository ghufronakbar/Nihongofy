"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { importTestPackageAction, type ImportResult } from "../actions";

export function ImportTestPackageForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fixtureJson, setFixtureJson] = useState("");
  const [fileLabel, setFileLabel] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Ringkasan dibaca di client hanya untuk orientasi sebelum submit. Validasi
  // yang mengikat tetap dilakukan server dengan kontrak fixture yang asli.
  const preview = (() => {
    if (!fixtureJson.trim()) return null;
    try {
      const parsed = JSON.parse(fixtureJson);
      const items = Array.isArray(parsed?.testPackageItems) ? parsed.testPackageItems : [];
      const questions = items.reduce(
        (total: number, item: { questions?: unknown[] }) =>
          total + (Array.isArray(item.questions) ? item.questions.length : 0),
        0,
      );
      return {
        name: typeof parsed?.name === "string" ? parsed.name : "(tanpa nama)",
        level: typeof parsed?.jlptLevel === "string" ? parsed.jlptLevel : "?",
        items: items.length,
        questions,
        contexts: Array.isArray(parsed?.questionContexts) ? parsed.questionContexts.length : 0,
      };
    } catch {
      return null;
    }
  })();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const outcome = await importTestPackageAction({ fixtureJson, fileLabel, replaceExisting });
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="neo-surface flex flex-col gap-4 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            disabled={isPending}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFixtureJson(await file.text());
              setFileLabel(file.name);
              setResult(null);
            }}
            className="text-xs font-semibold file:mr-3 file:border-2 file:border-neo-ink file:bg-neo-yellow file:px-3 file:py-1.5 file:font-mono file:text-xs file:font-black file:shadow-neo-sm"
          />
          {fileLabel && (
            <span className="font-mono text-[11px] font-bold text-foreground/60">{fileLabel}</span>
          )}
        </div>

        <Textarea
          rows={14}
          spellCheck={false}
          value={fixtureJson}
          disabled={isPending}
          onChange={(event) => {
            setFixtureJson(event.target.value);
            setResult(null);
          }}
          placeholder="Pilih file JSON di atas, atau tempel isinya di sini."
          className="font-mono text-xs"
        />

        {preview && (
          <p className="font-mono text-[11px] font-bold text-foreground/70">
            {preview.name} · {preview.level} · {preview.items} mondai · {preview.questions} soal ·{" "}
            {preview.contexts} context
          </p>
        )}

        <label className="flex items-start gap-3">
          <Switch
            checked={replaceExisting}
            disabled={isPending}
            onCheckedChange={(checked: boolean) => setReplaceExisting(checked)}
          />
          <span className="text-xs font-semibold text-foreground/80">
            Ganti paket yang sudah ada dengan nama yang sama.
            <span className="block font-normal text-foreground/60">
              Tanpa ini, paket yang sudah cocok dilewati dan paket yang berbeda isinya ditolak.
              Penggantian tetap ditolak server bila paket itu sudah punya attempt.
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={isPending || !fixtureJson.trim()}
          className="neo-button self-start bg-neo-blue text-sm font-extrabold text-white disabled:opacity-50"
        >
          <Upload className="size-4" />
          {isPending ? "Mengimpor..." : "Validasi & Impor"}
        </button>
      </div>

      {result && (
        <div
          className={`neo-surface flex flex-col gap-2 border-[3px] border-neo-ink p-4 shadow-neo ${
            result.ok ? "bg-white" : "bg-neo-coral/10"
          }`}
        >
          <p className="flex items-start gap-2 text-sm font-black text-neo-ink">
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 stroke-[2.5] text-neo-blue" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4.5 shrink-0 stroke-[2.5] text-neo-coral" />
            )}
            {result.message}
          </p>
          {!result.ok && result.issues && (
            <ul className="flex flex-col gap-1 pl-7">
              {result.issues.map((issue) => (
                <li key={issue} className="font-mono text-[11px] font-semibold text-foreground/70">
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
