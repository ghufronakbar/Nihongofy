"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { saveExamAnswersAction } from "../actions";
import { examStorageKey } from "../storage";

type AnswerState = {
  selectedAnswer: number | null;
  flagged: boolean;
  /** Catatan selama mengerjakan; string kosong = belum ada catatan. */
  note: string;
};

type AnswerMap = Record<number, AnswerState>;

export type SavedExamAnswer = {
  questionId: number;
  selectedAnswer: number | null;
  flagged: boolean;
  note: string | null;
};

/**
 * Status simpan otomatis untuk user login. `null` pada guest, yang lembar
 * jawabannya memang hanya ada di tab ini.
 */
export type ExamSaveStatus =
  | "saved"
  | "pending"
  | "saving"
  | "error"
  | "unauthorized"
  | "closed";

type ExamContextValue = {
  hydrated: boolean;
  saveStatus: ExamSaveStatus | null;
  getAnswer: (questionId: number) => AnswerState;
  setAnswer: (questionId: number, selectedAnswer: number | null) => void;
  toggleFlag: (questionId: number) => void;
  setNote: (questionId: number, note: string) => void;
  /** Coba kirim ulang sekarang, mis. dari tombol "Coba lagi". */
  retrySave: () => void;
  /** Dipanggil tepat sebelum submit: payload submit sudah membawa seluruh lembar. */
  stopAutosave: () => void;
};

const ExamContext = createContext<ExamContextValue | null>(null);

const EMPTY_ANSWER: AnswerState = { selectedAnswer: null, flagged: false, note: "" };

// Jeda setelah perubahan terakhir sebelum dikirim, supaya ganti pilihan atau
// tanda ragu beruntun terkirim dalam satu request.
const SAVE_DEBOUNCE_MS = 800;
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 30_000;

function readStoredAnswers(key: string): AnswerMap {
  let parsed: unknown;
  try {
    const raw = sessionStorage.getItem(key);
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    // storage diblokir atau isinya rusak — mulai dari yang ada saja
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};

  // Lembar dari versi sebelum ada catatan tidak punya `note`.
  const answers: AnswerMap = {};
  for (const [questionId, state] of Object.entries(parsed)) {
    const id = Number(questionId);
    if (!Number.isInteger(id) || id <= 0 || typeof state !== "object" || state === null) continue;
    const { selectedAnswer, flagged, note } = state as Record<string, unknown>;
    answers[id] = {
      selectedAnswer: typeof selectedAnswer === "number" ? selectedAnswer : null,
      flagged: flagged === true,
      note: typeof note === "string" ? note : "",
    };
  }
  return answers;
}

function writeStoredAnswers(key: string, answers: AnswerMap) {
  try {
    if (Object.keys(answers).length === 0) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(answers));
  } catch {
    // sessionStorage dapat melempar di private mode / storage diblokir
  }
}

function sameAnswer(a: AnswerState | undefined, b: AnswerState | undefined) {
  return (
    a?.selectedAnswer === b?.selectedAnswer && a?.flagged === b?.flagged && a?.note === b?.note
  );
}

/**
 * Lembar jawaban satu sesi exam.
 *
 * - Guest (`savedAnswers === null`): seluruh lembar di `sessionStorage`, dibaca
 *   lagi oleh `/result/guest`.
 * - User login: server adalah sumber utama (`savedAnswers`, dari device mana
 *   pun). Setiap perubahan dikirim lewat `saveExamAnswersAction`; key
 *   `sessionStorage` yang sama hanya menampung perubahan yang BELUM diterima
 *   server, supaya tidak hilang saat reload atau koneksi putus. Lembar lama
 *   (sebelum ada simpan otomatis) berisi seluruh jawaban yang memang belum
 *   tersimpan, jadi ikut terkirim apa adanya.
 *
 * Komponen ini diberi `key` per attempt/sesi oleh halaman, jadi state dan ref
 * di bawah tidak perlu di-reset ketika props berganti.
 */
export function ExamProvider({
  attemptId,
  session,
  savedAnswers,
  children,
}: {
  attemptId: number;
  session: number;
  savedAnswers: SavedExamAnswer[] | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const autosave = savedAnswers !== null && attemptId > 0;
  const storageKey = examStorageKey(attemptId, session);

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ExamSaveStatus | null>(autosave ? "saved" : null);

  const statusRef = useRef<ExamSaveStatus | null>(autosave ? "saved" : null);
  const answersRef = useRef<AnswerMap>({});
  const pendingRef = useRef<AnswerMap>({});
  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(RETRY_MIN_MS);
  const flushRef = useRef<() => void>(() => {});

  const updateStatus = useCallback((status: ExamSaveStatus) => {
    statusRef.current = status;
    setSaveStatus(status);
  }, []);

  const schedule = useCallback((delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), delay);
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!autosave || stoppedRef.current || inFlightRef.current) return;

    const batch = { ...pendingRef.current };
    const entries = Object.entries(batch);
    if (entries.length === 0) return;

    inFlightRef.current = true;
    updateStatus("saving");

    try {
      const result = await saveExamAnswersAction({
        attemptId,
        session,
        answers: entries.map(([questionId, state]) => ({
          questionId: Number(questionId),
          selectedAnswer: state.selectedAnswer,
          flagged: state.flagged,
          note: state.note,
        })),
      });
      if (stoppedRef.current) return;

      if (result.status === "closed") {
        // Sesi ini sudah disubmit dari tab/device lain: perubahan lokal tidak
        // akan pernah dinilai, jadi dibuang dan user diarahkan ke posisi terbaru.
        stoppedRef.current = true;
        pendingRef.current = {};
        writeStoredAnswers(storageKey, {});
        updateStatus("closed");
        router.replace(result.redirectTo);
        return;
      }

      if (result.status === "unauthorized") {
        updateStatus("unauthorized");
        return;
      }

      // Hanya buang yang tidak berubah lagi selama request berjalan.
      const remaining = { ...pendingRef.current };
      for (const [questionId, state] of entries) {
        if (sameAnswer(remaining[Number(questionId)], state)) delete remaining[Number(questionId)];
      }
      pendingRef.current = remaining;
      writeStoredAnswers(storageKey, remaining);
      retryDelayRef.current = RETRY_MIN_MS;

      if (Object.keys(remaining).length > 0) {
        updateStatus("pending");
        schedule(SAVE_DEBOUNCE_MS);
      } else {
        updateStatus("saved");
      }
    } catch {
      if (stoppedRef.current) return;
      updateStatus("error");
      schedule(retryDelayRef.current);
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, RETRY_MAX_MS);
    } finally {
      inFlightRef.current = false;
    }
  }, [attemptId, autosave, router, schedule, session, storageKey, updateStatus]);

  // Layout effect agar sudah terpasang sebelum efek pemulihan di bawah menjadwalkan kirim.
  useLayoutEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  // Runs before paint so the restored sheet is applied without a visible flash.
  useLayoutEffect(() => {
    // sessionStorage isn't readable during SSR, so this can only happen
    // client-side on mount — an effect is the correct place for it, not a lazy
    // useState initializer (that would desync from the SSR pass).
    const stored = readStoredAnswers(storageKey);
    let restored: AnswerMap = stored;

    if (autosave) {
      const fromServer: AnswerMap = {};
      for (const { questionId, selectedAnswer, flagged, note } of savedAnswers) {
        fromServer[questionId] = { selectedAnswer, flagged, note: note ?? "" };
      }
      restored = { ...fromServer, ...stored };
      pendingRef.current = stored;

      // Sesi sebelumnya sudah disubmit; sisa lembarnya tidak dipakai lagi.
      for (let previous = 1; previous < session; previous += 1) {
        writeStoredAnswers(examStorageKey(attemptId, previous), {});
      }
    }

    answersRef.current = restored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(restored);
    setHydrated(true);

    if (autosave && Object.keys(pendingRef.current).length > 0) {
      updateStatus("pending");
      schedule(0);
    }
    // Hanya saat mount: `savedAnswers` adalah snapshot server untuk sesi ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kirim secepatnya saat tab disembunyikan/ditutup atau koneksi kembali, dan
  // peringatkan sebelum meninggalkan halaman bila masih ada yang belum tersimpan.
  useEffect(() => {
    if (!autosave) return;

    const flushNow = () => void flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    const onOnline = () => {
      retryDelayRef.current = RETRY_MIN_MS;
      flushNow();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (stoppedRef.current) return;
      if (inFlightRef.current || Object.keys(pendingRef.current).length > 0) {
        event.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushNow);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushNow);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [autosave, flush]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const updateAnswer = useCallback(
    (questionId: number, change: (previous: AnswerState) => AnswerState) => {
      if (stoppedRef.current) return;
      const next = change(answersRef.current[questionId] ?? EMPTY_ANSWER);
      answersRef.current = { ...answersRef.current, [questionId]: next };
      setAnswers(answersRef.current);

      if (!autosave) {
        writeStoredAnswers(storageKey, answersRef.current);
        return;
      }

      pendingRef.current = { ...pendingRef.current, [questionId]: next };
      writeStoredAnswers(storageKey, pendingRef.current);

      // Status gagal/logout tetap tampil sampai ada simpanan yang berhasil.
      const status = statusRef.current;
      if (status !== "error" && status !== "unauthorized") updateStatus("pending");
      // Setelah logout, kirim ulang menunggu user login lagi lalu menekan "Coba lagi".
      if (status !== "unauthorized" && !inFlightRef.current) schedule(SAVE_DEBOUNCE_MS);
    },
    [autosave, schedule, storageKey, updateStatus],
  );

  const retrySave = useCallback(() => {
    retryDelayRef.current = RETRY_MIN_MS;
    void flush();
  }, [flush]);

  const stopAutosave = useCallback(() => {
    stoppedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const value = useMemo<ExamContextValue>(
    () => ({
      hydrated,
      saveStatus,
      getAnswer: (questionId) => answers[questionId] ?? EMPTY_ANSWER,
      setAnswer: (questionId, selectedAnswer) =>
        updateAnswer(questionId, (previous) => ({ ...previous, selectedAnswer })),
      toggleFlag: (questionId) =>
        updateAnswer(questionId, (previous) => ({ ...previous, flagged: !previous.flagged })),
      setNote: (questionId, note) => updateAnswer(questionId, (previous) => ({ ...previous, note })),
      retrySave,
      stopAutosave,
    }),
    [answers, hydrated, retrySave, saveStatus, stopAutosave, updateAnswer],
  );

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}

export function useExam() {
  const ctx = useContext(ExamContext);
  if (!ctx) throw new Error("useExam must be used within an ExamProvider");
  return ctx;
}
