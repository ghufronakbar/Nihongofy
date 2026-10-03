import type { AttemptStatus } from "@prisma/client";

// Bentuk minimal satu attempt di ekspor akun: hanya yang dibutuhkan untuk
// memutuskan apakah nilai per soalnya boleh ikut.
type ExportedAttempt<TAnswer extends { isCorrect: boolean }> = {
  status: AttemptStatus;
  answers: TAnswer[];
};

/**
 * Mengosongkan `isCorrect` pada attempt yang belum `COMPLETED`.
 *
 * Mock penuh disubmit per sesi, dan setiap sesi langsung menulis `isCorrect`
 * (turunan kunci jawaban) selagi attempt masih `IN_PROGRESS`. Selama attempt
 * belum selesai, sesi lama masih dapat dibuka dan disubmit ulang (docs/module/
 * exam.md), jadi nilai per soal di ekspor sama dengan membuka kunci sebelum
 * attempt disubmit — dilarang docs/database.md.
 *
 * Nilainya `null` (belum dinilai), bukan `false` yang berarti salah, dan kolomnya
 * tetap ada supaya bentuk ekspor tidak berubah. `selectedAnswer` tetap ikut
 * karena itu data milik user sendiri; nilainya ikut setelah attempt selesai.
 */
export function withoutUnsubmittedGrades<
  TAnswer extends { isCorrect: boolean },
  TAttempt extends ExportedAttempt<TAnswer>,
>(attempts: TAttempt[]) {
  return attempts.map((attempt) =>
    attempt.status === "COMPLETED"
      ? attempt
      : {
          ...attempt,
          answers: attempt.answers.map((answer) => ({ ...answer, isCorrect: null })),
        },
  );
}
