# Fase 4: Latihan Cepat dengan Feedback Langsung

Status: selesai pada 26 Agustus 2026.

## Hasil

- Menambahkan configurator `/exercises` untuk level, section, mondai type, dan 1-20 soal berdasarkan ketersediaan bank soal nyata.
- Menambahkan runner `/exercises/[sessionId]` dengan satu soal per langkah, previous/next, peta soal, progress, skor sementara, restart, review, dan completion summary.
- Menggunakan player audio existing untuk soal atau context listening yang memiliki URL audio.
- Menambahkan navigasi `Latihan Cepat` pada sidebar.
- Menambahkan ringkasan analytics practice yang dipisahkan secara eksplisit dari tren dan proyeksi skor mock JLPT.
- Menambahkan loading dan empty states untuk configurator dan runner.

## Database

Migration: `prisma/migrations/20260826122129_phase_4_quick_exercises/`.

Model baru:

- `PracticeSession`: owner, level, section, mondai type, jumlah soal, status, serta timestamp mulai/selesai.
- `PracticeAnswer`: assignment soal berurutan, selected answer, correctness, dan answered timestamp.

Constraint dan index:

- Unique `(practiceSessionId, questionId)` dan `(practiceSessionId, order)`.
- Index `(userId, startedAt)`, `(jlptLevel, section, mondaiType)`, status, dan `questionId`.
- Check constraint untuk jumlah soal, urutan, range jawaban, dan konsistensi answered/feedback state.
- RLS aktif tanpa client policy. Grant tabel dan sequence dicabut dari `anon`, `authenticated`, dan `service_role` karena runtime hanya memakai Prisma server-side.

## Security Boundary

- Start, answer, restart, dan read session memvalidasi input dengan Zod dan mengambil user dari cookie session.
- Tidak ada action practice yang menerima `userId` dari client.
- Read awal memakai explicit select tanpa `Question.questionAnswer` dan `Question.explanation`.
- Submit jawaban memverifikasi owner, session, membership question, dan pilihan jawaban sebelum membaca kunci server-side.
- Feedback hanya mengembalikan kunci dan explanation untuk question yang baru disubmit.
- Jawaban pertama dikunci secara atomik dengan `updateMany` pada `answeredAt: null`.
- User kedua menerima 404 saat mencoba membuka session milik user pertama.

## Perilaku Produk

- Pemilihan soal diacak secara deterministik memakai session ID dan user ID, lalu urutannya disimpan di database.
- Restart membuat session baru dengan set dan urutan soal yang sama. Session in-progress lama ditandai `ABANDONED`.
- Refresh membuka soal pertama yang belum dijawab. Jika semua selesai, halaman membuka ringkasan.
- Practice analytics menghitung hanya `PracticeSession.COMPLETED` dan tidak memengaruhi `Attempt` atau proyeksi skor JLPT.

## Verifikasi

- Migration diterapkan dengan `npx prisma migrate deploy`.
- Browser desktop dan mobile memverifikasi configurator neo-brutalist, runner, feedback benar/salah, completion summary, refresh persistence, restart, listening audio, dan analytics practice.
- Audit DOM sebelum submit tidak menemukan `questionAnswer`, `correctAnswer`, atau `explanation`.
- Isolation test dua user berhasil.
- `npx tsc --noEmit`, `npm run lint`, dan `npm run build` dijalankan sebagai final gate.

## Perbaikan Terkait

- Login dan register sekarang memeriksa bahwa user pada JWT masih ada sebelum melakukan redirect. Ini mencegah redirect loop saat cookie session menunjuk akun yang sudah dihapus.
