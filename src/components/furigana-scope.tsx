"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Wraps furigana-bearing content (JapaneseText/JapanesePassage render <ruby><rt>)
// and toggles the <rt> readings via a CSS descendant selector — no need to thread
// a visibility prop through the Server Component tree that renders the questions.
// Note: only affects text that HAS {kanji|reading} markup in the data; readings
// are not auto-generated. Exam/practice payloads have furigana stripped on the
// server (withoutFurigana), so this toggle only matters in review/read mode.
export function FuriganaScope({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOffIcon className="size-4" />
          ) : (
            <EyeIcon className="size-4" />
          )}
          {visible ? "Sembunyikan Furigana" : "Tampilkan Furigana"}
        </Button>
      </div>
      <div className={cn(!visible && "[&_rt]:hidden")}>{children}</div>
    </div>
  );
}
