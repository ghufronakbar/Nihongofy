"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismissDictionary } from "@/features/dictionary/components/dictionary-scope";

// Wraps furigana-bearing content (JapaneseText/JapanesePassage render <ruby><rt>)
// and toggles the <rt> readings via a CSS descendant selector — no need to thread
// a visibility prop through the Server Component tree that renders the questions.
// Note: only affects text that HAS {kanji|reading} markup in the data; readings
// are not auto-generated. Exam/practice payloads have furigana stripped on the
// server (withoutFurigana), so this toggle only matters in review/read mode.
export function FuriganaScope({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const dismissDictionary = useDismissDictionary();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          className="neo-button min-h-10 bg-white px-3 py-2 text-xs text-black"
          onClick={() => { dismissDictionary?.(); setVisible((v) => !v); }}
        >
          {visible ? (
            <EyeOffIcon className="size-4" />
          ) : (
            <EyeIcon className="size-4" />
          )}
          {visible ? "Sembunyikan Furigana" : "Tampilkan Furigana"}
        </button>
      </div>
      <div className={cn(!visible && "[&_rt]:hidden")}>{children}</div>
    </div>
  );
}
