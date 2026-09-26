# Modul Exam Runner

## Status Aktual

**Fungsional, tetapi masih membutuhkan hardening submit/session.** Exam runner mendukung full mock dan latihan per section, menyembunyikan answer key, menyimpan state browser per session, serta mempersist jawaban akun saat submit.

## Feature Flag

Tidak punya flag sendiri; ikut `FEATURES_TEST_PACKAGE` (lihat [Paket tes](test-package.md#feature-flag)). Saat `false`, `/exam/*` mengembalikan 404 lewat guard `src/app/(public)/exam/layout.tsx`, termasuk exam guest. Server Action submit tidak mengecek flag, sehingga tab exam yang sudah terbuka masih dapat submit.

## Route

- `/exam/[attemptId]/[session]`
- `/exam/guest/[session]`

## Alur User Login

- `Attempt.sectionScope = null` berarti full mock berdasarkan session asli paket.
- `sectionScope` terisi berarti latihan section dan URL session selalu `1` sebagai virtual session.
- Query exam hanya memilih stem, stimulus, choice, dan media; `questionAnswer` serta `explanation` tidak dikirim ke client.
- Jawaban dan flag disimpan di React Context dan `sessionStorage` dengan key per attempt/session.
- Query `?questionNumber=` divalidasi di client; nilai invalid diarahkan ke soal pertama yang belum dijawab atau soal pertama.
- Submit menghitung `isCorrect` di server dan meng-upsert `AttemptAnswer` dalam transaksi.
- Attempt menjadi `COMPLETED` setelah session terakhir, lalu cache dashboard/analytics/profile diinvalidasi.

## Guest Mode

- Pilihan paket/section disimpan dalam cookie `jlpt_guest_exam` (dibaca lewat `readGuestExamCookie`).
- Jawaban hanya disimpan dalam `sessionStorage`; tidak ada row attempt, history, analytics, atau comment.
- Setelah session terakhir guest diarahkan ke `/result/guest`. Halaman itu mengumpulkan lembar jawaban seluruh session dari `sessionStorage`, lalu server menilainya lewat `getGuestAttemptSummary` — lihat [Result](result.md#result-guest).
- Penilaian tetap di server karena `questionAnswer` tidak pernah dikirim ke client selama exam. Tidak ada score yang dipersist; hasil hilang saat tab ditutup.
- Mode baca paket yang membuka kunci jawaban tetap dapat diakses dari tombol pada halaman hasil guest.
- Cookie guest menyimpan `startedAt` saat exam dimulai, dipakai saat hasilnya diklaim ke akun — lihat [Result](result.md#klaim-hasil-ke-akun).

## Perilaku yang Disengaja

- Tidak ada timer internal. Detail paket hanya memberikan durasi resmi sebagai acuan timer mandiri.
- Furigana yang berada di dalam underline pada `MOJI_GOI_READ_KANJI` tidak dirender saat exam agar jawaban cara baca tidak bocor.
- Comment tidak tampil selama pengerjaan.

## Keterbatasan dan Risiko

- Tidak ada marker `submittedSession`. Selama attempt belum completed, session lama masih bisa dibuka langsung dan disubmit ulang sehingga jawaban dapat tertimpa.
- Server menerima subset `answers` yang valid tetapi belum mewajibkan satu row untuk setiap soal session. Payload buatan dapat menghilangkan soal dari denominator result.
- Tombol "submit tidak bisa diulang" baru dijaga oleh alur UI, belum menjadi invariant database/server per session.
- Requirement project menyebut furigana harus disembunyikan penuh selama exam, tetapi runner saat ini masih merender furigana umum. Yang benar-benar disembunyikan baru reading dalam underline untuk tipe cara-baca kanji.
- `AttemptAnswer.timeSpentSec` belum diisi.
- `AttemptStatus.ABANDONED` belum mempunyai action/UI pada mock exam.
- State yang belum disubmit terikat pada satu tab/sessionStorage dan tidak sinkron antar-device.
- Payload jawaban guest yang dikirim ke `/result/guest` tidak diverifikasi keasliannya; hasilnya tidak dipersist sehingga hanya memengaruhi tampilan milik guest itu sendiri.
- Audit answer-key leakage dan test end-to-end masih tercatat sebagai pekerjaan manual di `docs/plan.md`.

## File Utama

- `src/features/exam/actions.ts`
- `src/features/exam/guest-cookie.ts`
- `src/features/exam/schemas.ts`
- `src/features/exam/storage.ts`
- `src/features/exam/components/exam-provider.tsx`
- `src/features/exam/components/exam-runner.tsx`
- `src/app/(public)/exam/[attemptId]/[session]/page.tsx`
