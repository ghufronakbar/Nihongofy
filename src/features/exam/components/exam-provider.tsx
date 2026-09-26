"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { examStorageKey } from "../storage";

type AnswerState = {
  selectedAnswer: number | null;
  flagged: boolean;
};

type ExamContextValue = {
  hydrated: boolean;
  getAnswer: (questionId: number) => AnswerState;
  setAnswer: (questionId: number, selectedAnswer: number | null) => void;
  toggleFlag: (questionId: number) => void;
};

const ExamContext = createContext<ExamContextValue | null>(null);

const EMPTY_ANSWER: AnswerState = { selectedAnswer: null, flagged: false };

export function ExamProvider({
  attemptId,
  session,
  children,
}: {
  attemptId: number;
  session: number;
  children: ReactNode;
}) {
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [hydrated, setHydrated] = useState(false);

  // Runs before paint so the sessionStorage state is applied without a visible flash.
  useLayoutEffect(() => {
    const raw = sessionStorage.getItem(examStorageKey(attemptId, session));
    if (raw) {
      try {
        // sessionStorage isn't readable during SSR, so this can only happen
        // client-side on mount — an effect is the correct place for it, not
        // a lazy useState initializer (that would desync from the SSR pass).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAnswers(JSON.parse(raw));
      } catch {
        // malformed state — start fresh instead of crashing the exam page
      }
    }
    setHydrated(true);
  }, [attemptId, session]);

  useLayoutEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(examStorageKey(attemptId, session), JSON.stringify(answers));
  }, [answers, attemptId, session, hydrated]);

  const value = useMemo<ExamContextValue>(
    () => ({
      hydrated,
      getAnswer: (questionId) => answers[questionId] ?? EMPTY_ANSWER,
      setAnswer: (questionId, selectedAnswer) =>
        setAnswers((prev) => ({
          ...prev,
          [questionId]: { selectedAnswer, flagged: prev[questionId]?.flagged ?? false },
        })),
      toggleFlag: (questionId) =>
        setAnswers((prev) => ({
          ...prev,
          [questionId]: {
            selectedAnswer: prev[questionId]?.selectedAnswer ?? null,
            flagged: !(prev[questionId]?.flagged ?? false),
          },
        })),
    }),
    [answers, hydrated],
  );

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}

export function useExam() {
  const ctx = useContext(ExamContext);
  if (!ctx) throw new Error("useExam must be used within an ExamProvider");
  return ctx;
}
