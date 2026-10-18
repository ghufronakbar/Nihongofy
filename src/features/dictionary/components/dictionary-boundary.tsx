import { FEATURES } from "@/constants";
import manifest from "../../../../assets/dictionary/manifest.json";
import { DictionaryProvider } from "./dictionary-provider";
import { DictionaryScope } from "./dictionary-scope";

/** Server-only composition: no flags, env, or manifest enter the client graph. */
export function DictionaryBoundary({ children, contextKey, scope = true, className }: {
  children: React.ReactNode; contextKey: string; scope?: boolean; className?: string;
}) {
  if (!FEATURES.dictionary) return <>{children}</>;
  return <DictionaryProvider version={manifest.version} contextKey={contextKey}>
    {scope ? <DictionaryScope contextKey={contextKey} className={className}>{children}</DictionaryScope> : children}
  </DictionaryProvider>;
}
