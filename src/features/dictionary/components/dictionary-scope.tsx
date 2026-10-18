"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type Region = { enabled: boolean; key: string };
export type Coordinator = {
  preference: boolean;
  setPreference: (enabled: boolean) => void;
  register: (element: HTMLElement, region: Region) => () => void;
  dismiss: () => void;
  hint: string | null;
};
export const DictionaryContext = createContext<Coordinator | null>(null);
const RegionContext = createContext<Region>({ enabled: true, key: "" });
export function useDismissDictionary() {
  const coordinator = useContext(DictionaryContext);
  return coordinator?.dismiss;
}

/** Explicit region; without a boundary this is inert (e.g. community comments).
 * A nested region can deny lookup even when its parent is a reading surface. */
export function DictionaryScope({ children, enabled = true, contextKey = "content", showControl = true, className }: {
  children: React.ReactNode; enabled?: boolean; contextKey?: string; showControl?: boolean; className?: string;
}) {
  const coordinator = useContext(DictionaryContext);
  const parent = useContext(RegionContext);
  const ref = useRef<HTMLDivElement>(null);
  const allowed = parent.enabled && enabled;
  const key = `${parent.key}/${contextKey}`;
  const region = useMemo(() => ({ enabled: allowed, key }), [allowed, key]);
  const register = coordinator?.register;
  useEffect(() => {
    if (ref.current && register) return register(ref.current, region);
  }, [register, region]);
  if (!coordinator) return <>{children}</>;
  return <RegionContext.Provider value={region}>
    <div ref={ref} data-dictionary-region data-dictionary-context={key} data-dictionary-enabled={allowed && coordinator.preference ? "true" : "false"}
      tabIndex={-1} className={cn("min-w-0 outline-none", className)}>
      {allowed && showControl && <div data-dictionary-ignore data-reviewer-keys="off" className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">Blok kata Jepang untuk membuka kamus</span>
        <button type="button" aria-pressed={coordinator.preference}
          className={cn("neo-button min-h-10 px-3 py-2 text-xs text-black", coordinator.preference ? "bg-neo-green" : "bg-white")}
          title="Blok kata Jepang. Alt+K untuk masuk ke kamus, Escape untuk menutup."
          onClick={() => { coordinator.dismiss(); coordinator.setPreference(!coordinator.preference); }}>
          <BookOpen className="size-4" />Kamus seleksi: {coordinator.preference ? "aktif" : "nonaktif"}
        </button>
        {coordinator.hint && <p role="status" className="w-full text-right text-xs text-muted-foreground">{coordinator.hint}</p>}
      </div>}
      {children}
    </div>
  </RegionContext.Provider>;
}
