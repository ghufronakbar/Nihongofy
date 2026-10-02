"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { JapaneseText } from "@/components/japanese-text";
import { speakJapanese } from "@/features/study/lib/tts";
import { toPlainJapanese } from "@/lib/japanese-markup";
import type { BunpouExample } from "../types";

// Bagian pola (`__...__`) disorot, bukan digaris bawah: garis bawah di markup
// yang sama berarti 下線部 pada soal ujian. Sama dengan contoh di flashcard.
const PATTERN_HIGHLIGHT = "rounded-sm bg-neo-yellow/70 px-0.5 font-black text-black";

export function ExampleList({ examples }: { examples: BunpouExample[] }) {
  const [error, setError] = useState<string | null>(null);

  function play(example: BunpouExample) {
    const result = speakJapanese(toPlainJapanese(example.jp));
    setError(result.ok ? null : result.message);
  }

  return (
    <div>
      <ol className="space-y-5">
        {examples.map((example, index) => (
          <li key={example.jp} className="flex gap-3">
            <span className="mt-2 w-5 shrink-0 text-sm font-black tabular-nums text-muted-foreground">
              {index + 1}.
            </span>
            <div className="min-w-0 flex-1">
              <p lang="ja" className="font-japanese text-xl leading-loose font-bold">
                <JapaneseText text={example.jp} underlineClassName={PATTERN_HIGHLIGHT} />
              </p>
              <p className="mt-1 font-semibold">{example.id}</p>
              <p className="text-sm font-semibold text-muted-foreground" lang="en">
                {example.en}
              </p>
            </div>
            <button
              type="button"
              onClick={() => play(example)}
              className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-lg border-[3px] border-neo-ink bg-white text-black shadow-neo-sm"
              aria-label={`Putar suara contoh ${index + 1}`}
              title="Putar suara"
            >
              <Volume2 className="size-5" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      {error ? (
        <p role="status" className="mt-3 text-sm font-bold text-muted-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
