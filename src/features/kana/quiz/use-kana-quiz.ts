"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { answerQuestion, beginQuestion, createQuiz, QUIZ_STORAGE_KEY, restoreQuiz, type QuizSession, type QuizSetup } from "./engine";

export function useKanaQuiz() {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const current = useRef<QuizSession | null>(null);
  const pendingFrame = useRef(0);

  const commit = useCallback((next: QuizSession | null) => {
    current.current = next;
    setSession(next);
    try {
      if (next) window.sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(QUIZ_STORAGE_KEY);
    } catch {
      setStorageWarning(true);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = window.sessionStorage.getItem(QUIZ_STORAGE_KEY);
        if (raw) {
          let value: unknown;
          try { value = JSON.parse(raw); } catch { value = null; }
          const saved = restoreQuiz(value);
          // Reject snapshots from a device clock set in the future.
          if (saved && Math.max(saved.startedAt, saved.questionStartedAt ?? 0, saved.finishedAt ?? 0) <= Date.now()) {
            current.current = saved;
            setSession(saved);
            setRestored(true);
          } else window.sessionStorage.removeItem(QUIZ_STORAGE_KEY);
        }
      } catch {
        setStorageWarning(true);
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // The timer starts after the new kana has committed to the screen. The
  // neutral inter-question interval is excluded; refresh keeps the old clock.
  useEffect(() => {
    if (!session || session.finishedAt !== null || session.questionStartedAt !== null) return;
    const timer = window.setTimeout(() => {
      const frame = requestAnimationFrame(() => {
        const latest = current.current;
        if (latest && latest.finishedAt === null && latest.questionStartedAt === null) commit(beginQuestion(latest, Date.now()));
      });
      pendingFrame.current = frame;
    }, session.answers.length ? 320 : 0);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(pendingFrame.current); };
  }, [session, commit]);

  const start = useCallback((setup: QuizSetup) => {
    setRestored(false);
    commit(createQuiz(setup, Date.now()));
  }, [commit]);

  const answer = useCallback((kanaKey: string, reading: string) => {
    const latest = current.current;
    if (!latest) return;
    const next = answerQuestion(latest, kanaKey, reading, Date.now());
    if (next !== latest) commit(next);
  }, [commit]);

  const reset = useCallback(() => { setRestored(false); commit(null); }, [commit]);

  return { session, ready, restored, storageWarning, start, answer, reset };
}
