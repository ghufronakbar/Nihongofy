import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { withoutUnsubmittedGrades } from "./account-export";

// Baris contoh lengkap seperti hasil select ekspor akun: nilai per soal sudah
// tertulis untuk sesi yang disubmit walau attempt-nya belum selesai.
function attempt(status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED") {
  return {
    id: 7,
    status,
    sectionScope: null,
    answers: [
      { id: 1, questionId: 11, selectedAnswer: 3, isCorrect: true, flagged: false },
      { id: 2, questionId: 12, selectedAnswer: 1, isCorrect: false, flagged: true },
    ],
  };
}

describe("withoutUnsubmittedGrades", () => {
  it("attempt yang belum selesai tidak membawa nilai per soal", () => {
    for (const status of ["IN_PROGRESS", "ABANDONED"] as const) {
      const [exported] = withoutUnsubmittedGrades([attempt(status)]);
      for (const answer of exported!.answers) expect(answer.isCorrect, status).toBeNull();
      // Jawaban user sendiri tetap ikut.
      expect(exported!.answers.map((answer) => answer.selectedAnswer)).toEqual([3, 1]);
      expect(JSON.stringify(exported)).not.toMatch(/"isCorrect":\s*(true|false)/);
    }
  });

  it("attempt yang sudah selesai dikirim apa adanya", () => {
    const completed = attempt("COMPLETED");
    expect(withoutUnsubmittedGrades([completed])[0]).toBe(completed);
  });
});

describe("ekspor akun", () => {
  const route = readFileSync(
    fileURLToPath(new URL("../../../app/api/account/export/route.ts", import.meta.url)),
    "utf8",
  );

  it("attempt melewati withoutUnsubmittedGrades sebelum diserialisasi", () => {
    expect(route).toContain("attempts: withoutUnsubmittedGrades(account.attempts)");
    // Tanpa status, helper tidak dapat membedakan attempt yang belum selesai.
    expect(route).toMatch(/attempts: \{[\s\S]*?select: \{[\s\S]*?status: true/);
  });
});
