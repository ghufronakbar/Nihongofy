import { JapanesePassage } from "@/components/japanese-passage";
import { JapaneseText } from "@/components/japanese-text";
import type { QuestionExplanationView } from "@/lib/question-explanation";
import { cn } from "@/lib/utils";

// Isi pembahasan tanpa pembungkus kartu: setiap halaman sudah punya kartunya
// sendiri (hasil ujian, mode baca, latihan cepat) dengan gaya yang berbeda.
//
// `summary` dan `detail` memakai JapanesePassage, bukan JapaneseText, karena
// keduanya boleh berisi beberapa paragraf — JapaneseText hanya untuk teks satu
// baris dan akan menggabungkan baris baru menjadi satu kalimat panjang.
export function QuestionExplanationBody({
  explanation,
  className,
}: {
  explanation: QuestionExplanationView;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <JapanesePassage text={explanation.summary} />

      {explanation.detail && <JapanesePassage text={explanation.detail} />}

      {explanation.translation && (
        <p>
          <span className="font-mono text-[10px] font-black uppercase opacity-70">Terjemahan: </span>
          {explanation.translation}
        </p>
      )}

      {explanation.choices.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {explanation.choices.map((choice) => (
            <li key={choice.codeAnswer} className="flex gap-2">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-black",
                  choice.isCorrect
                    ? "border-neo-ink bg-neo-yellow text-black"
                    : "border-foreground/30 opacity-70",
                )}
                aria-label={choice.isCorrect ? `Pilihan ${choice.codeAnswer}, kunci` : undefined}
              >
                {choice.codeAnswer}
              </span>
              <JapaneseText text={choice.reason} />
            </li>
          ))}
        </ul>
      )}

      {explanation.keyPoints.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          <span className="font-mono text-[10px] font-black uppercase opacity-70">Poin:</span>
          {explanation.keyPoints.map((point) => (
            <span key={point} className="rounded border border-foreground/30 px-1.5">
              <JapaneseText text={point} />
            </span>
          ))}
        </p>
      )}

      {explanation.answerKeyDoubt && (
        <p className="font-mono text-[10px] font-black uppercase opacity-70">
          Catatan: pembahasan ini menandai kemungkinan kekeliruan pada kunci jawaban resmi.
        </p>
      )}
    </div>
  );
}
