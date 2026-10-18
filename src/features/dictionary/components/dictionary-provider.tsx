"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { DICTIONARY_LIMITS, DICTIONARY_PREFERENCE_EVENT, DICTIONARY_PREFERENCE_KEY } from "@/constants/dictionary";
import { lookupDictionaryAction } from "../actions";
import { cachedDictionaryResult, cacheDictionaryResult } from "../client-cache";
import { readDictionarySelection, sameDictionarySelection, selectedBaseText, type DictionarySelection } from "../selection";
import type { DictionaryResponse } from "../types";
import { DictionaryResults } from "./dictionary-results";
import { DictionaryContext, type Region, type Coordinator } from "./dictionary-scope";

let memoryPreference = true;
function preferenceSnapshot() {
  try { return window.localStorage.getItem(DICTIONARY_PREFERENCE_KEY) !== "false"; }
  catch { return memoryPreference; }
}
function subscribePreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(DICTIONARY_PREFERENCE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DICTIONARY_PREFERENCE_EVENT, callback);
  };
}
function setPreference(value: boolean) {
  memoryPreference = value;
  try { window.localStorage.setItem(DICTIONARY_PREFERENCE_KEY, String(value)); } catch { /* Browser preference remains usable in memory. */ }
  window.dispatchEvent(new Event(DICTIONARY_PREFERENCE_EVENT));
}

type Popup = {
  selection: DictionarySelection;
  context: string;
  providerKey: string;
  mode: "desktop" | "action" | "drawer";
  response: DictionaryResponse | null;
};

function insideDictionary(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement;
  return !!element?.closest("[data-dictionary-popup]");
}

function clearSelectionIn(element: HTMLElement) {
  const selection = window.getSelection();
  if (selection && ((selection.anchorNode && element.contains(selection.anchorNode)) ||
    (selection.focusNode && element.contains(selection.focusNode)))) selection.removeAllRanges();
}

export function DictionaryProvider({ children, version, contextKey }: {
  children: React.ReactNode; version: string; contextKey: string;
}) {
  const preference = useSyncExternalStore(subscribePreference, preferenceSnapshot, () => true);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const active = useRef<Popup | null>(null);
  const dismissed = useRef<DictionarySelection | null>(null);
  const sequence = useRef(0);
  const regions = useRef(new Map<HTMLElement, Region>());
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusTarget = useRef<HTMLButtonElement>(null);

  const publish = useCallback((value: Popup | null) => { active.current = value; setPopup(value); }, []);
  const close = useCallback((manual = true) => {
    if (manual && active.current) dismissed.current = active.current.selection;
    sequence.current++;
    clearTimeout(debounce.current);
    publish(null);
  }, [publish]);
  const register = useCallback((element: HTMLElement, region: Region) => {
    regions.current.set(element, region);
    return () => {
      regions.current.delete(element);
      // Reveal, next/undo and route changes must not reuse a native selection
      // made in the previous context, even when React reuses the text node.
      clearSelectionIn(element);
      if (active.current?.selection.region === element) close(false);
    };
  }, [close]);
  const sourceIsCurrent = useCallback((value: Popup) => {
    const region = regions.current.get(value.selection.region);
    return region?.enabled && region.key === value.context && value.selection.region.isConnected &&
      value.selection.region.dataset.dictionaryEnabled === "true" && value.selection.block.isConnected &&
      selectedBaseText(value.selection.range) === value.selection.text;
  }, []);

  const load = useCallback(async (value: Popup, retry = false) => {
    const request = ++sequence.current;
    const cached = !retry && cachedDictionaryResult(version, value.selection.query);
    if (cached) { publish({ ...value, response: { ok: true, result: cached } }); return; }
    publish({ ...value, response: null });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let response: DictionaryResponse;
    try {
      response = await Promise.race([
        lookupDictionaryAction(value.selection.query),
        new Promise<DictionaryResponse>((resolve) => {
          timer = setTimeout(() => resolve({ ok: false, code: "unavailable", message: "Kamus belum dapat dimuat. Coba lagi." }), DICTIONARY_LIMITS.timeoutMs + 2_000);
        }),
      ]);
    } catch { response = { ok: false, code: "unavailable", message: "Kamus belum dapat dimuat. Coba lagi." }; }
    finally { clearTimeout(timer); }
    if (sequence.current !== request || !sourceIsCurrent(value) || !active.current || active.current.providerKey !== value.providerKey) return;
    if (response.ok) cacheDictionaryResult(response.result);
    publish({ ...value, response });
  }, [publish, sourceIsCurrent, version]);

  useEffect(() => {
    if (!preference) return;
    let dragging = false;
    let touch = false;
    const read = () => {
      const selection = window.getSelection();
      if (active.current?.mode === "drawer" || insideDictionary(selection?.anchorNode ?? null) || insideDictionary(document.activeElement)) return;
      const next = readDictionarySelection(selection);
      if (!next || next === "too-long") {
        if (next !== "too-long") dismissed.current = null;
        setHint(next === "too-long" ? "Pilih satu kata atau frasa pendek (maksimal 40 karakter)." : null);
        if (active.current) close(false);
        return;
      }
      const region = regions.current.get(next.region);
      if (!region?.enabled) return;
      setHint(null);
      if (sameDictionarySelection(next, dismissed.current) || sameDictionarySelection(next, active.current?.selection ?? null)) return;
      if (active.current) close(false);
      const value: Popup = { selection: next, context: region.key, providerKey: contextKey,
        mode: touch || window.matchMedia("(pointer: coarse), (max-width: 767px)").matches ? "action" : "desktop", response: null };
      publish(value);
      if (value.mode === "desktop") void load(value);
    };
    const schedule = () => {
      clearTimeout(debounce.current);
      // Invalidate an earlier request immediately, before the debounce expires.
      const selection = window.getSelection();
      if (!insideDictionary(selection?.anchorNode ?? null) && !insideDictionary(document.activeElement) && active.current?.mode !== "drawer") {
        const next = readDictionarySelection(selection);
        if (active.current && (typeof next !== "object" || !sameDictionarySelection(next, active.current.selection))) close(false);
      }
      if (!dragging) debounce.current = setTimeout(read, DICTIONARY_LIMITS.selectionDelayMs);
    };
    const pointerDown = (event: PointerEvent) => {
      if (insideDictionary(event.target instanceof Node ? event.target : null)) return;
      touch = event.pointerType === "touch";
      dragging = event.button === 0;
      if (active.current) close();
      const target = event.target instanceof Element ? event.target : null;
      const region = target?.closest<HTMLElement>("[data-dictionary-region]");
      if (region && regions.current.get(region)?.enabled && !target?.closest(
        'button,a,input,textarea,select,[role="button"],[role="textbox"],[data-dictionary-ignore],[contenteditable]:not([contenteditable="false"])',
      )) dismissed.current = null;
    };
    const pointerUp = () => { dragging = false; schedule(); };
    const keyDown = (event: KeyboardEvent) => {
      if (!active.current) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); close();
      } else if (event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault(); event.stopImmediatePropagation();
        if (active.current.mode === "action") void load({ ...active.current, mode: "drawer" });
        else focusTarget.current?.focus();
      }
    };
    const scroll = (event: Event) => {
      if (active.current && !insideDictionary(event.target instanceof Node ? event.target : null)) close();
      clearTimeout(debounce.current);
    };
    const resize = () => close();
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointerup", pointerUp);
    document.addEventListener("pointercancel", pointerUp);
    document.addEventListener("keydown", keyDown, true);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      close(false); dismissed.current = null;
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("pointercancel", pointerUp);
      document.removeEventListener("keydown", keyDown, true);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, [close, contextKey, load, preference, publish]);

  // Removing a transcript/source, changing furigana, or replacing text closes
  // its popup. A timer elsewhere on the page can update without closing it.
  useEffect(() => {
    if (!popup) return;
    const observer = new MutationObserver(() => {
      if (!sourceIsCurrent(popup)) { close(false); return; }
      const rects = [...popup.selection.range.getClientRects()];
      if (!rects.some((rect) => Math.abs(rect.x - popup.selection.rect.x) < 1 && Math.abs(rect.y - popup.selection.rect.y) < 1 && Math.abs(rect.height - popup.selection.rect.height) < 1)) close(false);
    });
    observer.observe(popup.selection.region, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "data-dictionary-enabled", "data-dictionary-context"] });
    return () => observer.disconnect();
  }, [close, popup, sourceIsCurrent]);

  const coordinator = useMemo<Coordinator>(() => ({ preference, setPreference, register, dismiss: close, hint }), [preference, register, close, hint]);
  const shown = preference && popup?.providerKey === contextKey ? popup : null;
  const container = shown?.selection.region.closest<HTMLElement>('[role="dialog"]') ?? undefined;
  const content = shown && <DictionaryResults key={shown.selection.query} text={shown.selection.text} response={shown.response} retry={() => void load(shown, true)} />;
  const closeButton = <Button ref={focusTarget} type="button" variant="ghost" size="icon-sm" aria-label="Tutup kamus" onClick={() => close()}><X className="size-4" /></Button>;

  return <DictionaryContext.Provider value={coordinator}>
    {children}
    {shown?.mode === "action" && createPortal(<button type="button" data-dictionary-popup data-dictionary-ignore data-dictionary-active="true"
      className="neo-button fixed z-[80] bg-neo-green px-3 py-2 text-sm text-black" aria-haspopup="dialog" aria-keyshortcuts="Alt+K"
      style={{ left: Math.max(8, Math.min(shown.selection.rect.left, window.innerWidth - 112)), top: Math.max(8, Math.min(shown.selection.rect.bottom + 12, window.innerHeight - 56)) }}
      onPointerDown={(event) => event.preventDefault()} onClick={() => void load({ ...shown, mode: "drawer" })}>
      <BookOpen className="size-4" />Kamus
    </button>, container ?? document.body)}
    {shown?.mode === "desktop" && <Popover open modal={false} onOpenChange={(open) => { if (!open) close(); }}>
      <PopoverContent anchor={{ getBoundingClientRect: () => shown.selection.rect, contextElement: shown.selection.region }} positionMethod="fixed"
        align="start" sideOffset={10} collisionPadding={8} portalContainer={container} initialFocus={false} finalFocus={false}
        data-dictionary-popup data-dictionary-ignore data-dictionary-active="true" data-reviewer-keys="off"
        className="w-[min(26rem,calc(100vw-1rem))] max-h-[min(36rem,calc(100dvh-2rem))] gap-0 overflow-y-auto overscroll-contain rounded-none border-[3px] border-neo-ink bg-popover p-4 shadow-neo ring-0 motion-reduce:animate-none">
        <div className="mb-3 flex items-center justify-between gap-3"><PopoverTitle className="flex items-center gap-2 font-black"><BookOpen className="size-4" />Kamus Jepang</PopoverTitle>{closeButton}</div>
        {content}
      </PopoverContent>
    </Popover>}
    {shown?.mode === "drawer" && <Drawer open showSwipeHandle onOpenChange={(open) => { if (!open) close(); }}>
      <DrawerContent portalContainer={container} data-dictionary-popup data-dictionary-ignore data-dictionary-active="true" data-reviewer-keys="off"
        finalFocus={() => { if (shown.selection.region.isConnected) { shown.selection.region.focus({ preventScroll: true }); } return false; }}
        className="border-[3px] border-neo-ink motion-reduce:transition-none">
        <div className="flex items-center justify-between gap-3 border-b-2 border-border px-4 py-3"><DrawerTitle className="flex items-center gap-2 font-black"><BookOpen className="size-4" />Kamus Jepang</DrawerTitle>{closeButton}</div>
        <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{content}</div>
      </DrawerContent>
    </Drawer>}
  </DictionaryContext.Provider>;
}

