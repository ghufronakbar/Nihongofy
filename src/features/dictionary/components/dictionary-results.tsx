"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DICTIONARY_SOURCE } from "@/constants/dictionary";
import type { DictionaryHit, DictionaryResponse } from "../types";

function Hit({ hit }: { hit: DictionaryHit }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "error">("idle");
  return <section className="border-b-2 border-border py-4 last:border-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {hit.reasons.length > 0 && <p className="mb-1 text-xs font-bold text-muted-foreground">Bentuk dasar · {hit.reasons.join(" → ")}</p>}
        <h3 lang="ja" className="font-japanese break-words text-2xl font-black leading-relaxed">{hit.word}</h3>
        {hit.reading !== hit.word && <p lang="ja" className="font-japanese text-base leading-7">{hit.reading}</p>}
      </div>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Salin ${hit.word}`} onClick={async () => {
        try { await navigator.clipboard.writeText(hit.word); setCopied("ok"); }
        catch { setCopied("error"); }
      }}>{copied === "ok" ? <Check className="size-4" /> : <Copy className="size-4" />}</Button>
    </div>
    {copied !== "idle" && <p role="status" className="mt-1 text-xs">{copied === "ok" ? "Kata disalin." : "Kata belum dapat disalin. Pilih teks dan gunakan Copy."}</p>}
    {hit.common && <span className="mt-2 inline-block border border-foreground bg-neo-green px-1.5 py-0.5 text-xs font-bold text-black">Umum</span>}
    {hit.formLabels.length > 0 && <p lang="en" className="mt-2 text-xs text-muted-foreground">{hit.formLabels.join(" · ")}</p>}
    <ol lang="en" className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
      {hit.senses.slice(0, expanded ? hit.senses.length : 3).map((sense, index) => <li key={index}>
        <p className="text-xs font-semibold text-muted-foreground">{sense.partsOfSpeech.join("; ")}</p>
        <p>{sense.glosses.join("; ")}</p>
        {sense.labels.length > 0 && <p className="mt-1 text-xs italic text-muted-foreground">{sense.labels.join(" · ")}</p>}
        {sense.notes.map((note, noteIndex) => <p key={noteIndex} className="mt-1 text-xs text-muted-foreground">{note}</p>)}
      </li>)}
    </ol>
    {hit.senses.length > 3 && <Button type="button" size="sm" variant="ghost" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
      {expanded ? "Ringkas arti" : `Lihat arti lainnya (${hit.senses.length - 3})`}
    </Button>}
    {hit.sensesTruncated && <p className="mt-2 text-xs text-muted-foreground">Sebagian arti diringkas karena batas tampilan.</p>}
  </section>;
}

function Failure({ response, retry }: { response: Extract<DictionaryResponse, { ok: false }>; retry: () => void }) {
  const [remaining, setRemaining] = useState(response.retryAfterSeconds ?? 0);
  useEffect(() => {
    if (!response.retryAfterSeconds) return;
    const ends = Date.now() + response.retryAfterSeconds * 1000;
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((ends - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [response.retryAfterSeconds]);
  return <div className="py-5">
    <p role="status" className="text-sm leading-relaxed">{response.message}</p>
    <Button type="button" variant="outline" size="sm" className="mt-3" disabled={remaining > 0 || response.code === "disabled"} onClick={retry}>
      <RotateCcw className="size-4" />{remaining > 0 ? `Coba lagi dalam ${remaining} detik` : "Coba lagi"}
    </Button>
  </div>;
}

export function DictionaryResults({ text, response, retry }: {
  text: string; response: DictionaryResponse | null; retry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const result = response?.ok ? response.result : null;
  return <>
    <div className="border-b-2 border-border pb-3">
      <p className="text-xs font-semibold text-muted-foreground">Pilihanmu</p>
      <p lang="ja" className="font-japanese mt-1 break-words text-lg font-bold">{text}</p>
      <p className="mt-2 text-xs text-muted-foreground">Definisi bahasa Inggris · kamus kata dan frasa</p>
    </div>
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {!response ? "Memuat kamus." : response.ok ? `${response.result.hits.length} hasil kamus tersedia.` : "Kamus belum dapat dimuat."}
    </div>
    {!response && <p className="flex items-center gap-2 py-6 text-sm"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />Memuat kamus…</p>}
    {response && !response.ok && <Failure response={response} retry={retry} />}
    {result && result.hits.length === 0 && <p className="py-5 text-sm leading-relaxed">Kata ini belum ditemukan di kamus. Coba pilih bentuk kata yang lebih lengkap atau lebih pendek.</p>}
    {result?.hits.slice(0, expanded ? 10 : 3).map((hit) => <Hit key={hit.id} hit={hit} />)}
    {result && result.hits.length > 3 && <Button type="button" variant="outline" size="sm" className="my-3 w-full" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
      {expanded ? "Ringkas hasil" : `Lihat hasil lainnya (${result.hits.length - 3})`}
    </Button>}
    {result?.truncated && <p className="mb-3 text-xs text-muted-foreground">Maksimal 10 hasil. Pilih kata lebih spesifik untuk mempersempit pencarian.</p>}
    <footer className="border-t-2 border-border pt-3 text-xs leading-5 text-muted-foreground">
      <a href={DICTIONARY_SOURCE.url} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2">{DICTIONARY_SOURCE.name}</a>
      {" · "}<a href={DICTIONARY_SOURCE.licence} target="_blank" rel="noreferrer" className="underline underline-offset-2">{DICTIONARY_SOURCE.licenceId}</a>
      {result && <details className="mt-1"><summary className="cursor-pointer">Rincian sumber</summary>
        <p className="mt-1 break-all">JMdict English penuh · {result.sourceDate}<br />Indeks: {result.version}</p>
        <p>Indeks turunan aplikasi dari <a className="underline" href={DICTIONARY_SOURCE.converter} target="_blank" rel="noreferrer">jmdict-simplified</a>.</p>
      </details>}
    </footer>
  </>;
}
