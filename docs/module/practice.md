# Modul Latihan Cepat

## Status Aktual

**Fungsional untuk user login, dengan guest mode sementara.** Modul mengambil soal dari bank paket yang sama, tetapi menyimpan session dan analitik secara terpisah dari mock exam.

## Feature Flag

`FEATURES_PRACTICE` (default `true`). Saat `false`:

- `/exercises` dan `/exercises/[sessionId]` mengembalikan 404 lewat guard `src/app/(public)/exercises/layout.tsx`.
- Menu Latihan Cepat di header, kartu di home dan dashboard, quick action serta statistik "Latihan cepat selesai" di profile tidak dirender.
- Analytics menyembunyikan section "Ringkasan Latihan Cepat" dan opsi scope "Latihan Cepat"; `?scope=PRACTICE` di URL diabaikan.
- `/exercises` keluar dari `sitemap.xml` dan `robots.txt`.
- Practice membaca bank soal secara langsung, sehingga tetap berfungsi walau `FEATURES_TEST_PACKAGE=false`.
- `practice/actions.ts` tidak mengecek flag.

## Route

- `/exercises`
- `/exercises/[sessionId]`
- `/exercises/guest`

## Alur User Login

1. Catalog menghitung kombinasi level, section, dan mondai yang benar-benar memiliki soal.
2. User memilih 1-20 soal; UI menawarkan 5/10/15/20 bila jumlah tersedia cukup.
3. Server mengacak kandidat dari seed waktu, membuat `PracticeSession`, lalu membuat semua `PracticeAnswer` dalam transaksi.
4. Runner menampilkan satu soal per langkah.
5. Kunci dan explanation baru diambil untuk soal yang sudah dijawab.
6. Jawaban pertama bersifat final; setelah semua selesai session menjadi `COMPLETED`.
7. Restart membuat session baru dengan membership soal yang sama; session lama yang masih aktif menjadi `ABANDONED`.

## Data Aktual

- Catalog runtime berasal dari database, bukan daftar level hardcoded saja.
- Pada database development saat audit, latihan tersedia untuk N2, N3, dan N4 di keempat section.
- N1 dan N5 tampak disabled/"Segera" karena fixture-nya belum diimpor ke database development.
- Mayoritas soal tidak mempunyai explanation; runner tetap menandai kunci dan menampilkan fallback bahwa pembahasan belum tersedia.

## Guest Mode

- Konfigurasi dan daftar question ID disimpan dalam cookie `jlpt_guest_practice`.
- Tidak ada `PracticeSession` atau `PracticeAnswer` database.
- Jawaban dan ringkasan hanya bertahan dalam state React pada page yang sedang terbuka; refresh mengulang dari awal.
- Restart guest kembali ke configurator, bukan mengulang set yang sama.

## Data-Leak Guard

Hasil audit 3 Oktober 2026 (tabel lengkap di [exam.md](exam.md#audit-data-leak-3-oktober-2026)):

- Payload sesi (`getPracticeSession`) tidak memuat kunci maupun pembahasan untuk soal yang belum
  dijawab. Query kunci hanya meminta id soal yang `answeredAt`-nya terisi.
- Penilaian di server. User login: pilihan yang tidak ada di soal, atau soal yang belum dijawab
  di sesi yang sudah ditutup, ditolak tanpa mengembalikan kunci. Guest: soal di luar daftar
  cookie sesi guest ditolak sebelum kunci dibaca, dan pilihan yang tidak ada di soal ditolak.
- Cara baca soal 漢字読み di dalam underline dibuang dari payload di server
  (`withoutUnderlineFurigana`). Runner tidak pernah menampilkannya, termasuk setelah dijawab.
- Runner tidak memasang diskusi maupun catatan. Tombol laporan pembahasan baru muncul setelah
  feedback.
- Dijaga `src/lib/answer-key-guard.test.ts`.

## Keterbatasan dan Hardening

- Guest submit memverifikasi bahwa `questionId` ada di daftar soal cookie `jlpt_guest_practice`
  (divalidasi zod) sebelum membaca kunci (3 Oktober 2026). Tanpa cookie yang cocok — termasuk
  user login yang mengirim `sessionId: 0` — action mengembalikan `{ ok: false }` tanpa kunci.
  Konsekuensi yang disengaja: tab latihan guest lama berhenti menerima jawaban setelah guest
  memulai latihan baru, karena cookie-nya sudah diganti; runner menampilkan pesan untuk memulai
  latihan baru.
- Guest submit juga menolak pilihan yang tidak ada di soal, sama seperti jalur user login, tanpa
  mengembalikan kunci.
- Guest response selalu mengembalikan `answeredCount: 1` dan `isComplete: false`; ringkasan lengkap dibentuk hanya dari state client.
- Tidak ada timer, flag, bookmark, atau comment per soal di runner practice.
- Tidak ada halaman history/discovery session practice; user perlu menyimpan URL untuk kembali.
- Session yang ditinggalkan dapat tetap `IN_PROGRESS` tanpa cleanup otomatis.
- Tidak ada automated end-to-end test untuk persistence, refresh, atau restart. Answer-key guard
  punya unit test (lihat di atas).

## File Utama

- `src/features/practice/actions.ts`
- `src/features/practice/schemas.ts`
- `src/features/practice/components/practice-configurator.tsx`
- `src/features/practice/components/practice-runner.tsx`
- `src/app/(public)/exercises/page.tsx`
- `src/app/(public)/exercises/[sessionId]/page.tsx`

