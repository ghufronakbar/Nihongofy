"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceKotobaQuiz, answerKotoba, createKotobaQuiz, KOTOBA_QUIZ_STORAGE_KEY, restoreKotobaQuiz, type KotobaQuizSession, type KotobaQuizSetup } from "./engine";

export function useKotobaQuiz() {
  const [session, setSession] = useState<KotobaQuizSession | null>(null);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const current = useRef<KotobaQuizSession | null>(null);

  const commit = useCallback((next: KotobaQuizSession | null) => {
    current.current = next;
    setSession(next);
    try {
      if (next) window.sessionStorage.setItem(KOTOBA_QUIZ_STORAGE_KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(KOTOBA_QUIZ_STORAGE_KEY);
    } catch {
      setStorageWarning(true);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = window.sessionStorage.getItem(KOTOBA_QUIZ_STORAGE_KEY);
        if (raw) {
          let value: unknown;
          try { value = JSON.parse(raw); } catch { value = null; }
          const saved = restoreKotobaQuiz(value);
          // Reject snapshots from a device clock set in the future.
          if (saved && Math.max(saved.startedAt, saved.questionStartedAt ?? 0, saved.finishedAt ?? 0) <= Date.now()) {
            current.current = saved;
            setSession(saved);
            setRestored(true);
          } else window.sessionStorage.removeItem(KOTOBA_QUIZ_STORAGE_KEY);
        }
      } catch {
        setStorageWarning(true);
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // The first card opens by itself once it has committed to the screen. Later
  // cards wait for "Lanjut" so reading the back of a card is never timed.
  useEffect(() => {
    if (!session || session.answers.length > 0 || session.questionStartedAt !== null) return;
    const frame = requestAnimationFrame(() => {
      const latest = current.current;
      if (latest && latest.answers.length === 0) commit(advanceKotobaQuiz(latest, Date.now()));
    });
    return () => cancelAnimationFrame(frame);
  }, [session, commit]);

  const start = useCallback((setup: KotobaQuizSetup, onlyKeys?: readonly string[]) => {
    setRestored(false);
    commit(createKotobaQuiz(setup, Date.now(), Math.random, onlyKeys));
  }, [commit]);

  // selectedKey null melewati kata dan langsung membuka bagian belakang kartu.
  const answer = useCallback((key: string, selectedKey: string | null) => {
    const latest = current.current;
    if (!latest) return;
    const next = answerKotoba(latest, key, selectedKey, Date.now());
    if (next !== latest) commit(next);
  }, [commit]);

  const advance = useCallback(() => {
    const latest = current.current;
    if (!latest) return;
    const next = advanceKotobaQuiz(latest, Date.now());
    if (next !== latest) commit(next);
  }, [commit]);

  const reset = useCallback(() => { setRestored(false); commit(null); }, [commit]);

  return { session, ready, restored, storageWarning, start, answer, advance, reset };
}
