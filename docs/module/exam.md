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
- Furigana tidak tampil selama pengerjaan, termasuk yang tercetak di soal asli. Semua furigana (instruksi, soal, bacaan, pilihan) dibuang dari payload di server (`withoutFurigana`/`withoutQuestionFurigana` di `getExamQuestions`), bukan hanya tidak dirender: props Client Component ikut terkirim utuh di RSC payload, dan pada `MOJI_GOI_READ_KANJI` furigana di dalam underline adalah jawabannya.
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
- Audit answer-key leakage sudah dilakukan (lihat di bawah). Test end-to-end masih manual di `docs/plan.md`.

## Audit Data-Leak (3 Oktober 2026)

Yang diaudit: `Question.questionAnswer`, relasi `explanation` beserta `choices`-nya, dan
turunannya (`AttemptAnswer.isCorrect`, `QuestionExplanationChoice.isCorrect`, serta cara baca
soal 漢字読み). Yang dihitung "terkirim" bukan hanya return value Server Action, tetapi juga props
Server Component ke Client Component (RSC payload) dan data cache yang dapat dipakai jalur lain.

| Jalur | Yang dikirim ke client | Kapan, untuk siapa | Status |
|---|---|---|---|
| Exam `/exam/[attemptId]/[session]` (`getExamQuestions` → `ExamRunner`) | Stem, stimulus, pilihan, media. Tanpa kunci, pembahasan, atau catatan | Selama attempt; pemilik attempt atau guest pemegang cookie | Aman. Cara baca 漢字読み di underline ikut terkirim — **bocor, diperbaiki** |
| Submit sesi (`submitExamSessionAction`) | Hanya redirect. Kunci dibaca untuk menilai, tidak dikembalikan | Per sesi | Aman |
| Guest exam | Jawaban hanya di `sessionStorage`; client tidak menilai apa pun | Guest | Aman |
| `/result/guest` (`getGuestAttemptSummary`) | Agregat: benar/salah/kosong/ragu dan proyeksi skor | Setelah sesi terakhir, pemegang cookie guest | Disengaja. Dapat dipakai sebagai oracle skor, setara mode baca yang publik |
| Latihan login (`getPracticeSession`, `submitPracticeAnswerAction`) | Kunci dan pembahasan hanya untuk soal yang sudah dijawab; dinilai server | Pemilik sesi | Aman. Cara baca 漢字読み — **bocor, diperbaiki** |
| Latihan guest | Payload tanpa kunci; submit mengembalikan kunci dan pembahasan hanya untuk soal di cookie sesi guest | Guest | Awalnya bocor (keanggotaan soal tidak diperiksa) — **diperbaiki** ([practice.md](practice.md#keterbatasan-dan-hardening)) |
| `/result/[attemptId]` dan `/detail` | Kunci, pembahasan, catatan pribadi | Hanya `COMPLETED` dan pemilik attempt | Aman |
| Mode baca `/test-package/[id]/questions` | Kunci dan pembahasan | Publik | Disengaja. Cache `testPackageQuestions` hanya dipakai jalur ini |
| Diskusi `/discussion/*`, `getDiscussionAction` | Halaman soal membawa kunci dan pembahasan; thread hanya entri publik | Publik | Disengaja. Tidak dipasang di runner exam maupun latihan |
| Laporkan (`getReportFormContextAction`) | Konteks form saja (captcha, dapat dibalas) | Siapa saja | Aman. Runner exam hanya melaporkan soal; latihan menawarkan laporan pembahasan setelah feedback |
| Admin | Kunci dan pembahasan lewat select milik admin | `requireAdmin()` | Aman, terpisah dari jalur exam |
| `/api/account/export` | Attempt beserta jawaban | Pemilik akun | `isCorrect` attempt yang belum selesai — **bocor, diperbaiki** (kini `null`) |
| Dashboard, analytics, progress, history | Agregat dari attempt `COMPLETED` | Pemilik | Aman |

Penjaganya `src/lib/answer-key-guard.test.ts`:

- Action exam, latihan, dan result dipanggil dengan Prisma tiruan; argumen query yang benar-benar
  dikirim ditelusuri lewat DMMF schema. Select baru yang ditulis langsung di action ikut
  terperiksa, termasuk relasi `true`/`include` yang diam-diam membawa seluruh kolom.
- Cara baca 漢字読み tidak ada di payload exam dan latihan; latihan hanya meminta kunci untuk soal
  yang sudah dijawab; review result berhenti sebelum query ber-kunci bila attempt belum selesai
  atau bukan milik viewer; ringkasan guest hanya berisi agregat.
- Statis: `QUESTION_EXPLANATION_SELECT` berbentuk tetap dan hanya diimpor jalur yang boleh;
  tidak ada `explanation: true`/`include` pembahasan; query baca pada model ber-kunci selalu
  memakai `select`; runner exam tidak menyebut kunci, pembahasan, catatan, atau diskusi; hanya
  mode baca yang men-cache soal ber-kunci; admin dan jalur publik tidak saling mengimpor.

## File Utama

- `src/features/exam/actions.ts`
- `src/features/exam/guest-cookie.ts`
- `src/features/exam/schemas.ts`
- `src/features/exam/storage.ts`
- `src/features/exam/components/exam-provider.tsx`
- `src/features/exam/components/exam-runner.tsx`
- `src/app/(public)/exam/[attemptId]/[session]/page.tsx`
