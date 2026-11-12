# Modul Exam Runner

## Status Aktual

**Fungsional.** Exam runner mendukung full mock dan latihan per section, menyembunyikan answer key, menyimpan jawaban akun otomatis per soal (bisa dilanjutkan dari device lain sebelum submit), mengunci sesi yang sudah disubmit lewat `Attempt.currentSession`, dan menerima catatan per soal selama mengerjakan yang langsung menjadi Catatan Belajar di pembahasan (sejak 12 November 2026).

## Feature Flag

Tidak punya flag sendiri; ikut `FEATURES_TEST_PACKAGE` (lihat [Paket tes](test-package.md#feature-flag)). Saat `false`, `/exam/*` mengembalikan 404 lewat guard `src/app/(public)/exam/layout.tsx`, termasuk exam guest. Server Action submit tidak mengecek flag, sehingga tab exam yang sudah terbuka masih dapat submit.

## Route

- `/exam/[attemptId]/[session]`
- `/exam/guest/[session]`

## Alur User Login

- `Attempt.sectionScope = null` berarti full mock berdasarkan session asli paket.
- `sectionScope` terisi berarti latihan section dan URL session selalu `1` sebagai virtual session.
- Query exam hanya memilih stem, stimulus, choice, dan media; `questionAnswer` serta `explanation` tidak dikirim ke client.
- Hanya `Attempt.currentSession` yang boleh dibuka; URL sesi lain (sudah disubmit atau belum gilirannya) dialihkan ke sesi itu. Latihan section selalu sesi 1.
- Halaman memuat jawaban yang sudah tersimpan untuk sesi itu (`selectedAnswer` + `flagged`, tanpa `isCorrect`) sebagai isi awal lembar jawaban — lihat [Simpan otomatis](#simpan-otomatis-dan-lanjut-di-device-lain).
- Query `?questionNumber=` divalidasi di client; nilai invalid diarahkan ke soal pertama yang belum dijawab atau soal pertama. Pindah soal memakai `window.history.replaceState`, bukan `router.replace`, sehingga tidak memicu render ulang halaman di server.
- Submit menilai **seluruh** soal sesi (soal yang tidak ada di payload dihitung kosong), meng-upsert `AttemptAnswer`, dan menaikkan `currentSession` dalam satu transaksi.
- Attempt menjadi `COMPLETED` setelah session terakhir, lalu cache dashboard/analytics/profile diinvalidasi.

## Simpan Otomatis dan Lanjut di Device Lain

- Setiap pilih jawaban/tanda ragu masuk antrean; setelah jeda ±0,8 detik antrean dikirim lewat `saveExamAnswersAction` dalam satu request (hanya soal yang berubah). Antrean juga dikirim saat tab disembunyikan/ditutup dan saat koneksi kembali. Hanya satu request berjalan pada satu waktu, jadi urutan simpanan dari satu tab terjaga.
- Action ini tidak menilai dan tidak mengembalikan data soal: `isCorrect` baris yang tersimpan otomatis tetap `false` sampai submit. Tidak ada revalidate/cookie di dalamnya, jadi halaman tidak dirender ulang.
- Antrean yang belum diterima server disimpan di `sessionStorage` (key yang sama dengan guest, tetapi isinya hanya perubahan tertunda), lalu digabung di atas data server saat halaman dimuat ulang. Lembar lama dari sebelum fitur ini ikut terkirim apa adanya.
- Gagal kirim dicoba ulang dengan jeda 2–30 detik; runner menampilkan status Tersimpan / Menyimpan / Gagal + "Coba lagi". Sesi login yang berakhir menghentikan kiriman sampai user login lagi lalu menekan "Coba lagi". Selama masih ada antrean, browser memperingatkan sebelum tab ditutup.
- Dua device yang terbuka bersamaan: simpanan terakhir per soal yang berlaku. Submit mengirim lembar yang terlihat di device yang men-submit.
- Simpan otomatis dan submit sama-sama diawali `update` bersyarat pada baris `Attempt` (`status = IN_PROGRESS` dan `currentSession` = sesi itu). Update ini mengunci baris sehingga keduanya berurutan: simpanan yang tiba setelah submit gagal P2025, dikembalikan sebagai `closed`, dan client diarahkan ke sesi/hasil terbaru. Submit ganda dari dua device hanya diterima sekali.
- Beban: satu mock ±100 request kecil (1 GET Redis untuk sesi login + ±4 query berindeks), tersebar selama pengerjaan.

## Catatan Selama Mengerjakan

User login dapat menulis catatan per soal selagi ujian berjalan (mis. "ragu antara 2 dan 3",
"belum hafal pola ini"), lalu membahasnya di `/result/[attemptId]/detail` begitu ujian selesai.

- Panel "Tulis catatan untuk soal ini" di bawah kartu soal; shortcut `N` membuka dan memfokuskan
  textarea, `Esc` mengembalikan fokus ke halaman. Teks polos, maksimal 2.000 karakter
  (`EXAM_NOTE_MAX_LENGTH`, sama dengan batas Catatan Belajar). Lampiran gambar ditambahkan dari
  pembahasan.
- Lembar jawaban menandai soal yang punya catatan; dialog submit menyebut jumlah catatan yang akan
  dipindahkan.
- **Draft di `AttemptAnswer.note`.** Catatan ikut antrean simpan otomatis yang sama dengan jawaban
  (sessionStorage, retry, lanjut di device lain), jadi tidak kena kuota tulis komentar per menit.
  Isi yang hanya spasi disimpan sebagai `null`.
- **Submit memindahkan draft menjadi `QuestionComment` privat** (`createMany`) dalam transaksi yang
  sama dengan klaim sesi dan penilaian, lalu mengosongkan `note`. Submit ganda yang kalah klaim
  tidak menggandakan catatan. Catatan itu kemudian tampil sebagai Catatan Belajar biasa: bisa
  disunting, diberi gambar, dihapus, atau dibagikan ke diskusi. Pemindahan sengaja tanpa
  `COMMENT_WRITE_RATE_LIMITS`: privat, paling banyak satu per soal sesi.
- Seperti jawaban, yang dipindahkan adalah lembar di device yang men-submit. Payload dari tab lama
  tanpa field `note` tidak menyentuh draft tersimpan.
- Mengikuti `FEATURES_QUESTION_COMMENT`. Saat mati, panel tidak dirender, simpan otomatis
  mengabaikan `note`, dan submit tidak memindahkan maupun menghapus draft yang sudah ada.
- Guest tidak mendapat panel ini karena tidak punya akun untuk menyimpan Catatan Belajar.
- Draft sesi yang belum disubmit ikut `/api/account/export`; penghapusan akun menghapus attempt
  beserta draft-nya.

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
- Catatan Belajar lama dan diskusi tidak tampil selama pengerjaan karena dapat menyebut jawabannya. Runner hanya membaca draft catatan milik attempt ini (`AttemptAnswer.note`), tidak pernah menyentuh `QuestionComment`.

## Keterbatasan dan Risiko

- Requirement project menyebut furigana harus disembunyikan penuh selama exam, tetapi runner saat ini masih merender furigana umum. Yang benar-benar disembunyikan baru reading dalam underline untuk tipe cara-baca kanji.
- `AttemptAnswer.timeSpentSec` belum diisi.
- `AttemptStatus.ABANDONED` belum mempunyai action/UI pada mock exam.
- Perubahan yang belum sempat terkirim (offline lalu tab ditutup) hilang; jeda kirim dibuat pendek dan browser memperingatkan sebelum tab ditutup untuk mengecilkan peluangnya.
- Guest tetap hanya memakai `sessionStorage` (tidak ada akun untuk menyimpan).
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
| Simpan otomatis (`saveExamAnswersAction`) | Hanya status `saved`/`closed`/`unauthorized`. Tidak membaca kunci; tidak menulis `isCorrect` | Per perubahan jawaban, pemilik attempt | Aman (ditambahkan 11 November 2026) |
| Catatan selama mengerjakan (`AttemptAnswer.note`) | Hanya draft yang ditulis user di attempt ini; Catatan Belajar lama dan diskusi tidak dibaca | Selama attempt, pemilik attempt | Aman (ditambahkan 12 November 2026). Dipindahkan ke `QuestionComment` saat submit |
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
- `src/features/exam/actions.test.ts`
- `src/features/exam/guest-cookie.ts`
- `src/features/exam/schemas.ts`
- `src/features/exam/storage.ts`
- `src/features/exam/components/exam-provider.tsx`
- `src/features/exam/components/exam-runner.tsx`
- `src/features/exam/components/exam-note-panel.tsx`
- `src/features/exam/note.ts`
- `src/app/(public)/exam/[attemptId]/[session]/page.tsx`
