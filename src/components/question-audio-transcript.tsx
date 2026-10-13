"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuestionAudioTranscript({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const transcriptId = useId();

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-controls={transcriptId}
        aria-expanded={visible}
        onClick={() => setVisible((current) => !current)}
        className="border-2 border-neo-ink bg-white font-bold shadow-neo-sm hover:bg-neo-blue/15"
      >
        {visible ? (
          <EyeOffIcon className="size-4" aria-hidden="true" />
        ) : (
          <EyeIcon className="size-4" aria-hidden="true" />
        )}
        {visible ? "Sembunyikan transkrip" : "Tampilkan transkrip"}
      </Button>

      {visible && (
        <div
          id={transcriptId}
          className="mt-3 rounded-lg border-2 border-neo-ink bg-[#e9f2ff] p-4 text-neo-ink shadow-neo-sm"
        >
          <span className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/65">
            Transkrip audio
          </span>
          <div
            lang="ja"
            className="mt-2 whitespace-pre-wrap font-japanese text-sm font-medium leading-7"
          >
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
