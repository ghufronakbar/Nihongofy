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
      aria-label="JLPT Exam, kembali ke beranda"
    >
      <span
        lang="ja"
        className="font-japanese grid size-10 place-items-center border-[3px] border-neo-ink bg-neo-yellow text-xl leading-none shadow-neo-sm transition-transform group-hover:-rotate-3"
        aria-hidden="true"
      >
        日
      </span>
      <span className="leading-none">
        <span className="block text-xl">JLPT Exam</span>
        <span className="mt-1 block font-mono text-[0.58rem] font-bold tracking-[0.15em] uppercase">
          日本語試験室
        </span>
      </span>
    </Link>
  );
}
