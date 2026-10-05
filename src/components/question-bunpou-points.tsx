import Link from "next/link";
import { JapaneseText } from "@/components/japanese-text";
import type { QuestionBunpouPointView } from "@/lib/question-bunpou-links";
import { cn } from "@/lib/utils";

// "Pola yang diuji" di bawah pembahasan soal. Tanpa pembungkus kartu, sama
// seperti QuestionExplanationBody: tiap halaman menaruhnya di kartu pembahasannya
// sendiri. Hanya boleh dirender di tempat pembahasan juga boleh tampil.
export function QuestionBunpouPoints({
  points,
  className,
}: {
  points: QuestionBunpouPointView[];
  className?: string;
}) {
  if (points.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-mono text-[10px] font-black uppercase opacity-70">Pola yang diuji:</span>
      <ul className="flex flex-wrap gap-1.5">
        {points.map((point) => (
          <li key={point.key}>
            <Link
              href={`/bunpou/${point.key}`}
              className="flex items-center gap-1.5 rounded border-2 border-neo-ink bg-background px-2 py-1 text-foreground shadow-neo-sm transition-transform hover:-translate-y-0.5"
            >
              <span className="rounded border border-neo-ink bg-neo-yellow px-1 font-mono text-[10px] font-black text-black">
                {point.level}
              </span>
              <span lang="ja" className="font-japanese font-black">
                <JapaneseText text={point.title} />
              </span>
              <span className="text-[11px] font-semibold opacity-70">{point.meaningId}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
