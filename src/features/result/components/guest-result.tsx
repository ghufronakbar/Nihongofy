"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, RotateCcw, UserPlus } from "lucide-react";
import { getGuestAttemptSummary } from "../actions";
import { ResultSummaryView } from "./result-summary-view";
import { GUEST_EXAM_STORAGE_PREFIX } from "@/features/exam/storage";
import type { ExamAnswerInput } from "@/features/exam/schemas";

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

export function GuestResult() {
  const [view, setView] = useState<ViewState>({ status: "loading" });

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

  if (view.status === "loading") {
    return (
      <main className="page-reveal mx-auto w-full max-w-2xl px-4 py-16">
        <div className="neo-surface neo-grid-paper border-[3px] border-neo-ink bg-white p-8 text-center shadow-neo space-y-4">
          <div className="inline-flex size-14 items-center justify-center rounded-xl border-[3px] border-neo-ink bg-neo-yellow shadow-neo-sm">
            <span className="font-mono text-2xl font-black">JLPT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-neo-ink">Menilai Jawabanmu...</h1>
          <p className="text-sm font-semibold text-foreground/70">
            Mencocokkan lembar jawaban dengan kunci di server.
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
            Hasil ujian tanpa akun hanya tersimpan di tab browser yang dipakai mengerjakan, dan
            hilang begitu tab ditutup. Daftar akun supaya hasil dan riwayat ujianmu tersimpan
            permanen.
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
        <div className="neo-surface flex items-start gap-3 border-[3px] border-neo-ink bg-neo-yellow p-4 shadow-neo">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-black" />
          <p className="text-sm font-bold text-black">
            Hasil ini tidak tersimpan. Menutup tab akan menghapusnya, dan ujian ini tidak masuk
            riwayat, statistik, maupun analisis progres.{" "}
            <Link href="/register" className="underline underline-offset-2">
              Daftar gratis
            </Link>{" "}
            untuk menyimpan hasil dan membuka review jawaban soal per soal.
          </p>
        </div>
      }
      actions={
        <>
          <Link href="/register" className="neo-button bg-neo-blue text-white font-black text-sm">
            <UserPlus className="size-4" />
            Daftar untuk Simpan Hasil
          </Link>
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
