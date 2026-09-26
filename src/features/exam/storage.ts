// Key sessionStorage lembar jawaban exam, dipakai bersama oleh runner dan
// halaman hasil guest.
//
// Guest tidak punya row `Attempt`, sehingga memakai id sentinel 0. Hasil guest
// dibentuk dengan memindai seluruh key berprefix `GUEST_EXAM_STORAGE_PREFIX`,
// jadi satu sesi ujian penuh tetap dapat dijumlahkan lintas session.

export const GUEST_ATTEMPT_ID = 0;

export function examStorageKey(attemptId: number, session: number) {
  return `exam-state-${attemptId}-${session}`;
}

export const GUEST_EXAM_STORAGE_PREFIX = `exam-state-${GUEST_ATTEMPT_ID}-`;

/** Dipakai setelah lembar jawaban guest berpindah ke akun. */
export function clearGuestExamStorage() {
  try {
    const keys: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(GUEST_EXAM_STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    // sessionStorage dapat melempar di private mode / storage diblokir
  }
}
