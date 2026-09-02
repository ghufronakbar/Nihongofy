import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-3 font-extrabold tracking-[-0.04em] text-neo-ink",
        className,
      )}
      aria-label="Tanoshii Japanese, kembali ke beranda"
    >
      <span
        lang="ja"
        className="font-japanese grid size-10 place-items-center border-[3px] border-neo-ink bg-neo-yellow text-xl leading-none shadow-neo-sm transition-transform group-hover:-rotate-3"
        aria-hidden="true"
      >
        楽
      </span>
      <span className="leading-none">
        <span className="block text-xl font-black">Tanoshii Japanese</span>
        <span className="mt-1 block font-mono text-[0.58rem] font-bold tracking-[0.15em] uppercase text-foreground/75">
          楽しい日本語
        </span>
      </span>
    </Link>
  );
}
