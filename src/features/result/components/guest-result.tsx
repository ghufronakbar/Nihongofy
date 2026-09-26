"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, BookOpen, LogIn, RotateCcw, Save, UserPlus } from "lucide-react";
import {
  getGuestAttemptSummary,
  importGuestAttemptAction,
  stashGuestAttemptAction,
} from "../actions";
import { ResultSummaryView } from "./result-summary-view";
import { clearGuestExamStorage, GUEST_EXAM_STORAGE_PREFIX } from "@/features/exam/storage";
import type { ExamAnswerInput } from "@/features/exam/schemas";

// Penanda pada URL kembalian auth supaya impor hanya berjalan ketika user memang
// menekan CTA simpan, bukan setiap kali halaman ini dibuka sambil login. Query-nya
// dibaca server-side lalu dioper sebagai prop, jadi hook pembaca URL di client
// (yang menuntut Suspense boundary saat prerender) tidak diperlukan.
const RETURN_PATH = "/result/guest?import=1";

type GuestSummary = NonNullable<Awaited<ReturnType<typeof getGuestAttemptSummary>>>;

type ViewState =
  | { status: "loading" }
  | { status: "ready"; summary: GuestSummary }
  | { status: "empty" };

/**
 * Mengumpulkan lembar jawaban guest dari seluruh session pada tab ini.
 *
 * `null` berarti tidak ada satu pun key exam — tab baru, sessionStorage sudah
 * dibersihkan, atau halaman dibuka langsung tanpa mengerjakan ujian. Ini
 * dibedakan dari array kosong (ujian dikerjakan tetapi tanpa satu pun jawaban)
 * supaya kasus pertama tidak ditampilkan sebagai skor 0%.
 */
function readGuestAnswers(): ExamAnswerInput[] | null {
  let found = false;
  const answers: ExamAnswerInput[] = [];

  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(GUEST_EXAM_STORAGE_PREFIX)) continue;
      found = true;

      const raw = sessionStorage.getItem(key);
      if (!raw) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // state rusak — lewati session ini, soalnya tetap terhitung kosong
        continue;
      }
      if (typeof parsed !== "object" || parsed === null) continue;

      for (const [questionId, state] of Object.entries(parsed)) {
        const id = Number(questionId);
        if (!Number.isInteger(id) || id <= 0) continue;
        if (typeof state !== "object" || state === null) continue;

        const { selectedAnswer, flagged } = state as Record<string, unknown>;
        answers.push({
          questionId: id,
          selectedAnswer:
            typeof selectedAnswer === "number" && selectedAnswer >= 1 && selectedAnswer <= 4
              ? selectedAnswer
              : null,
          flagged: flagged === true,
        });
      }
    }
  } catch {
    // sessionStorage dapat melempar di private mode / storage diblokir
    return null;
  }

  return found ? answers : null;
}

export function GuestResult({
  isAuthenticated,
  shouldImport,
}: {
  isAuthenticated: boolean;
  shouldImport: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [isSaving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const answers = readGuestAnswers();

    // Tanpa key exam sama sekali tidak ada yang perlu dinilai, tapi hasilnya
    // tetap dilewatkan promise supaya state tidak diubah sinkron dalam effect.
    const pending = answers ? getGuestAttemptSummary(answers) : Promise.resolve(null);

    pending
      .then((summary) => {
        if (!active) return;
        setView(summary ? { status: "ready", summary } : { status: "empty" });
      })
      .catch(() => {
        if (active) setView({ status: "empty" });
      });

    return () => {
      active = false;
    };
  }, []);

  const importToAccount = useCallback(() => {
    startSaving(async () => {
      setSaveError(null);
      const result = await importGuestAttemptAction();
      if (!result.ok) {
        setSaveError(
          "Lembar jawaban yang dititipkan sudah kedaluwarsa, jadi tidak bisa disimpan ke akun.",
        );
        return;
      }
      clearGuestExamStorage();
      router.replace(`/result/${result.attemptId}`);
    });
  }, [router]);

  // Kembali dari login/register dengan ?import=1: klaim titipannya sekali saja.
  const autoImported = useRef(false);
  useEffect(() => {
    if (autoImported.current) return;
    if (!isAuthenticated || !shouldImport) return;
    autoImported.current = true;
    // Ditunda satu microtask supaya impor tidak memicu setState sinkron di
    // dalam effect (cascading render).
    void Promise.resolve().then(importToAccount);
  }, [isAuthenticated, shouldImport, importToAccount]);

  function saveThenAuthenticate(destination: "login" | "register") {
    setSaveError(null);
    startSaving(async () => {
      const answers = readGuestAnswers();
      const stashed = answers ? await stashGuestAttemptAction(answers) : { ok: false as const };
      if (!stashed.ok) {
        setSaveError("Lembar jawaban sudah tidak tersedia di tab ini, jadi tidak bisa disimpan.");
        return;
      }
      router.push(`/${destination}?next=${encodeURIComponent(RETURN_PATH)}`);
    });
  }

  // Kembali dari auth: tampilkan layar impor, bukan ringkasan atau empty state.
  // Pada jalur verifikasi email tab-nya baru, jadi sessionStorage pasti kosong
  // dan tanpa ini user sempat melihat "Hasil Tidak Tersedia" yang menyesatkan.
  const isClaiming = isAuthenticated && shouldImport && !saveError;

  if (isClaiming || view.status === "loading") {
    return (
      <main className="page-reveal mx-auto w-full max-w-2xl px-4 py-16">
        <div className="neo-surface neo-grid-paper border-[3px] border-neo-ink bg-white p-8 text-center shadow-neo space-y-4">
          <div className="inline-flex size-14 items-center justify-center rounded-xl border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
            <span className="font-mono text-2xl font-black">JLPT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neo-ink">
            {isClaiming ? "Menyimpan ke Akunmu..." : "Menilai Jawabanmu..."}
          </h1>
          <p className="text-sm font-semibold text-foreground/70">
            {isClaiming
              ? "Memindahkan lembar jawaban yang kamu kerjakan ke riwayat akun."
              : "Mencocokkan lembar jawaban dengan kunci di server."}
          </p>
        </div>
      </main>
    );
  }

  if (view.status === "empty") {
    return (
      <main className="page-reveal mx-auto w-full max-w-2xl px-4 py-16">
        <div className="neo-surface neo-grid-paper border-[3px] border-neo-ink bg-white p-8 text-center shadow-neo space-y-4">
          <div className="inline-flex size-14 items-center justify-center rounded-xl border-[3px] border-neo-ink bg-neo-coral shadow-neo-sm">
            <AlertTriangle className="size-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neo-ink">Hasil Tidak Tersedia</h1>
          <p className="text-sm font-semibold text-foreground/70">
            {saveError ??
              "Hasil ujian tanpa akun hanya tersimpan di tab browser yang dipakai mengerjakan, dan hilang begitu tab ditutup. Daftar akun supaya hasil dan riwayat ujianmu tersimpan permanen."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/register" className="neo-button bg-neo-blue text-white font-black text-sm">
              <UserPlus className="size-4" />
              Daftar Gratis
            </Link>
            <Link
              href="/test-package"
              className="neo-button bg-white text-black font-extrabold text-sm"
            >
              <ArrowLeft className="size-4" />
              Pilih Paket Ujian
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { summary } = view;

  return (
    <ResultSummaryView
      testPackageName={summary.testPackage.name}
      jlptLevel={summary.testPackage.jlptLevel}
      sectionScope={summary.sectionScope}
      subtitle="Hasil sementara mode tanpa akun. Dinilai di server, tetapi tidak disimpan."
      stats={summary.stats}
      projection={summary.projection}
      notice={
        <div className="neo-surface space-y-3 border-[3px] border-neo-ink bg-neo-yellow p-4 shadow-neo">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-black" />
            <p className="text-sm font-bold text-black">
              {isAuthenticated
                ? "Hasil ini belum tersimpan. Simpan ke akunmu untuk masuk riwayat, statistik, dan analisis progres, serta membuka review jawaban soal per soal."
                : "Hasil ini tidak tersimpan. Menutup tab akan menghapusnya, dan ujian ini tidak masuk riwayat, statistik, maupun analisis progres. Simpan ke akun untuk menyimpannya permanen dan membuka review jawaban soal per soal."}
            </p>
          </div>
          {saveError && (
            <p className="border-2 border-neo-ink bg-white px-3 py-2 text-sm font-bold text-destructive">
              {saveError}
            </p>
          )}
        </div>
      }
      actions={
        <>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                setSaveError(null);
                importToAccount();
              }}
              disabled={isSaving}
              className="neo-button bg-neo-blue text-white font-black text-sm disabled:opacity-60"
            >
              <Save className="size-4" />
              {isSaving ? "Menyimpan..." : "Simpan ke Akun"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => saveThenAuthenticate("register")}
                disabled={isSaving}
                className="neo-button bg-neo-blue text-white font-black text-sm disabled:opacity-60"
              >
                <UserPlus className="size-4" />
                {isSaving ? "Menyiapkan..." : "Daftar & Simpan Hasil"}
              </button>
              <button
                type="button"
                onClick={() => saveThenAuthenticate("login")}
                disabled={isSaving}
                className="neo-button bg-white text-black font-extrabold text-sm disabled:opacity-60"
              >
                <LogIn className="size-4" />
                Sudah Punya Akun? Masuk
              </button>
            </>
          )}
          <Link
            href={`/test-package/${summary.testPackage.id}/questions`}
            className="neo-button bg-white text-black font-extrabold text-sm"
          >
            <BookOpen className="size-4" />
            Lihat Kunci & Pembahasan
          </Link>
          <Link
            href={`/test-package/${summary.testPackage.id}`}
            className="neo-button bg-neo-paper text-black font-extrabold text-sm"
          >
            <RotateCcw className="size-4" />
            Ulangi Ujian
          </Link>
        </>
      }
    />
  );
}
