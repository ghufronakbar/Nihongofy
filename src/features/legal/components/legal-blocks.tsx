import Link from "next/link";
import { cn } from "@/lib/utils";
import { isLegalPlaceholder, LEGAL_FACTS } from "../constants";

// Blok penyusun isi dokumen hukum. Isi ditulis sebagai TSX di
// `src/features/legal/content/`, jadi komponen di sini sengaja kecil dan tanpa
// state: halaman di-prerender statis.

/** Isian dari `LEGAL_FACTS`. Placeholder ditandai mencolok supaya tidak terlewat saat ditinjau. */
export function LegalValue({ value }: { value: string }) {
  if (!isLegalPlaceholder(value)) return <>{value}</>;
  return (
    <mark className="border-2 border-neo-ink bg-neo-coral px-1 font-mono text-[0.85em] font-bold text-black">
      {value}
    </mark>
  );
}

export function ContactEmail() {
  const email = LEGAL_FACTS.contactEmail;
  if (isLegalPlaceholder(email)) return <LegalValue value={email} />;
  return (
    <a
      href={`mailto:${email}`}
      className="font-bold underline decoration-2 decoration-neo-blue underline-offset-4"
    >
      {email}
    </a>
  );
}

export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-bold underline decoration-2 decoration-neo-blue underline-offset-4"
    >
      {children}
    </Link>
  );
}

export function LegalP({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("leading-7 text-foreground/80", className)}>{children}</p>;
}

export function LegalH3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-2 text-lg font-black">{children}</h3>;
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="grid list-disc gap-2 pl-5 leading-7 text-foreground/80 marker:text-neo-ink">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalCallout({
  title,
  children,
  tone = "yellow",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "yellow" | "coral" | "blue";
}) {
  return (
    <div
      className={cn(
        "border-[3px] border-neo-ink p-4 shadow-neo-sm sm:p-5",
        tone === "yellow" && "bg-neo-yellow",
        tone === "coral" && "bg-neo-coral",
        tone === "blue" && "bg-neo-blue",
      )}
    >
      <p className="font-mono text-xs font-black tracking-widest text-black uppercase">{title}</p>
      <div className="mt-2 grid gap-2 leading-7 font-semibold text-black">{children}</div>
    </div>
  );
}

export function LegalTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    // Tabel boleh bergulir horizontal di dalam bingkainya sendiri; halaman tidak.
    <div className="overflow-x-auto border-[3px] border-neo-ink bg-white">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm leading-6">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-neo-ink text-white">
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-3 py-2 font-mono text-xs font-black tracking-wider uppercase">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t-2 border-neo-ink/20 align-top">
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row" className="px-3 py-2 font-bold">
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex} className="px-3 py-2 text-foreground/80">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="border border-neo-ink/30 bg-neo-paper px-1 font-mono text-[0.85em]">
      {children}
    </code>
  );
}
