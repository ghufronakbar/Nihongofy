"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { markupToPlainText, documentToPlainText } from "@/lib/japanese-plain-text";

export function CopyQuestionButton({
  contextText,
  questionOrder,
  questionText,
  choices,
}: {
  contextText?: string | null;
  questionOrder: number;
  questionText: string;
  choices: { codeAnswer: number; answerText: string }[];
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const parts: string[] = [];

    if (contextText) {
      parts.push(`[Bacaan]\n${documentToPlainText(contextText)}`);
    }
    if (questionText) {
      parts.push(`[Soal ${questionOrder}]\n${markupToPlainText(questionText)}`);
    }
    if (choices.length > 0) {
      const choiceLines = choices
        .map((choice) => `${choice.codeAnswer}. ${markupToPlainText(choice.answerText)}`)
        .join("\n");
      parts.push(`[Pilihan]\n${choiceLines}`);
    }

    void navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      className="neo-button size-10 min-h-10 bg-white p-0 text-black"
      onClick={handleCopy}
      aria-label="Salin soal untuk ditanyakan ke AI"
      title="Salin soal untuk ditanyakan ke AI"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}
