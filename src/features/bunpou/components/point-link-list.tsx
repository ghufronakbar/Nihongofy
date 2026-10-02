import Link from "next/link";
import { JapaneseText } from "@/components/japanese-text";
import type { BunpouPointSummary } from "../types";

/** Daftar ringkas pola, untuk "pola terkait" dan kolom perbandingan. */
export function PointLinkList({ points }: { points: BunpouPointSummary[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {points.map((point) => (
        <li key={point.key}>
          <Link
            href={`/bunpou/${point.key}`}
            className="neo-surface neo-interactive flex h-full flex-col p-4"
          >
            <span className="flex items-center gap-2 text-xs font-black">
              <span className="rounded border-2 border-neo-ink bg-neo-yellow px-1.5 text-black">
                {point.level}
              </span>
              {point.senseLabel ? (
                <span className="tracking-wide text-neo-blue uppercase">{point.senseLabel}</span>
              ) : null}
            </span>
            <span lang="ja" className="font-japanese mt-1 text-lg leading-relaxed font-black">
              <JapaneseText text={point.title} />
            </span>
            <span className="text-sm font-semibold text-muted-foreground">{point.meaningId}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
