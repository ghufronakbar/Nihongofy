import type { UseFormRegisterReturn } from "react-hook-form";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Potongan UI bersama form tampilan dan form pengaturan deck. */

export const numberInput =
  "h-11 w-28 rounded-lg border-[3px] border-neo-ink bg-white px-3 text-right font-bold text-black shadow-neo-sm outline-none";
export const textInput =
  "h-11 w-full rounded-lg border-[3px] border-neo-ink bg-white px-3 font-bold text-black shadow-neo-sm outline-none sm:w-64";
const selectInput =
  "h-11 w-full rounded-lg border-[3px] border-neo-ink bg-white px-3 font-bold text-black shadow-neo-sm outline-none sm:w-72";

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="neo-surface p-5">
      <h2 className="text-lg font-black">{title}</h2>
      {note ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{note}</p> : null}
      <div className="mt-4 grid gap-5">{children}</div>
    </section>
  );
}

export function Row({
  label,
  hint,
  error,
  reset,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  reset: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
      <div>
        <span className="block font-extrabold">{label}</span>
        {hint ? <span className="block text-xs font-semibold text-muted-foreground">{hint}</span> : null}
        {error ? <span className="block text-xs font-bold text-neo-coral">{error}</span> : null}
      </div>
      <div className="flex items-center gap-2 sm:justify-self-end">
        {children}
        {reset}
      </div>
    </div>
  );
}

export function Select({
  registration,
  options,
}: {
  registration: UseFormRegisterReturn;
  options: { value: string; label: string }[];
}) {
  return (
    <select className={selectInput} {...registration}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Tombol ↺ seperti di Anki: hanya terlihat bila nilai berbeda dari bawaan. */
export function ResetButton({
  changed,
  defaultLabel,
  onReset,
}: {
  changed: boolean;
  defaultLabel: string;
  onReset: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onReset}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md border-2 border-neo-ink bg-white text-black",
        !changed && "invisible",
      )}
      aria-label="Kembalikan ke nilai bawaan"
      title={`Bawaan: ${defaultLabel}`}
      tabIndex={changed ? 0 : -1}
    >
      <RotateCcw className="size-4" aria-hidden />
    </button>
  );
}
