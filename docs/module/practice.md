# Modul Latihan Cepat

## Status Aktual

**Fungsional untuk user login, dengan guest mode sementara.** Modul mengambil soal dari bank paket yang sama, tetapi menyimpan session dan analitik secara terpisah dari mock exam.

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

## Keterbatasan dan Hardening

- Guest submit belum memverifikasi bahwa `questionId` merupakan anggota cookie guest session.
- Guest submit belum memverifikasi bahwa jawaban merupakan choice yang tersedia.
- Guest response selalu mengembalikan `answeredCount: 1` dan `isComplete: false`; ringkasan lengkap dibentuk hanya dari state client.
- Tidak ada timer, flag, bookmark, atau comment per soal di runner practice.
- Tidak ada halaman history/discovery session practice; user perlu menyimpan URL untuk kembali.
- Session yang ditinggalkan dapat tetap `IN_PROGRESS` tanpa cleanup otomatis.
- Tidak ada automated end-to-end test untuk persistence, refresh, restart, atau answer-key guard.

## File Utama

- `src/features/practice/actions.ts`
- `src/features/practice/schemas.ts`
- `src/features/practice/components/practice-configurator.tsx`
- `src/features/practice/components/practice-runner.tsx`
- `src/app/(public)/exercises/page.tsx`
- `src/app/(public)/exercises/[sessionId]/page.tsx`

