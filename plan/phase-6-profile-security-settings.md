# Fase 6 - Profile, security, dan flashcard settings

## Status

Selesai pada 26 Agustus 2026. Profile mock dan preference localStorage dari reference UI sudah
diganti dengan akun, statistik, password mutation, dan scheduler setting yang persisten.

## Routes dan UI

- `/profile`: overview neo-brutalist dengan avatar, tanggal bergabung, dan statistik nyata untuk
  kana, vocabulary, latihan cepat, serta mock exam.
- `/profile/info`: edit display name, normalized email, dan avatar Cloudinary. Username legacy
  tetap read-only.
- `/profile/security`: change password dengan current password dan tanpa Google/OAuth mock.
- `/flashcard-settings`: daily limits, learning/relearning steps, lapse, dan interval lanjutan
  dalam kelompok progressive disclosure. Route ini kini menjadi pengaturan belajar mandiri di sidebar.
- `/profile/auth`: compatibility redirect ke `/profile/security`.
- Footer sidebar sekarang menjadi entry point Profile, Security, dan Logout serta menampilkan
  avatar/display name terbaru.

UI mengikuti reference: pale blue paper, outline tiga pixel, hard shadow, cobalt/coral/yellow/
green, heading besar, dan tactile controls. Angka overview berasal dari query user, bukan mock atau
`Math.random()`.

## Profile dan security

- Semua read/mutation mengambil identitas dari `session.userId`; action tidak menerima `userId`
  dari client.
- Update profile memakai shared Zod schema, normalisasi whitespace display name, lowercase email,
  dan unique constraint sebagai duplicate guard terakhir.
- Avatar diupload langsung dari browser ke folder Cloudinary per user memakai signature berumur
  pendek; API secret tidak pernah masuk client.
- Password baru memakai policy registrasi existing dan bcrypt cost 12.
- Current password salah mengembalikan error generik tanpa detail record akun.
- Setelah hash password tersimpan, `createSession()` membuat ulang JWT cookie aktif dengan `jti`
  acak baru agar token benar-benar berbeda meski rotasi terjadi pada detik yang sama.

## Database dan scheduler

Migration:

- `prisma/migrations/20260826144305_phase_6_profile_security_settings/migration.sql`

Perubahan:

- Model satu-ke-satu `FlashcardSetting` dengan daily limits, learning/relearning step arrays,
  interval, ease, lapse retention, serta multiplier yang benar-benar dibaca scheduler.
- `FlashcardProgress.learningStep` menyimpan posisi learning/relearning.
- `FlashcardReviewLog.wasNew` memisahkan konsumsi limit kartu baru dan review.
- Queue menghitung hari berdasarkan Asia/Jakarta, mendahulukan due cards, lalu kartu baru.
- Mutation rating memeriksa due date dan limit kembali sebelum menjadwalkan kartu.
- `GOOD` pada kartu baru dengan default `1m 10m` bergerak ke step kedua dan due 10 menit; setelah
  step terakhir kartu lulus ke review.
- Range, cardinality, dan interval dijaga oleh CHECK constraint. `learningStepsMinutes` dan
  `relearningStepsMinutes` ditegakkan `NOT NULL`.
- RLS aktif pada `FlashcardSetting`; grant table untuk `anon`, `authenticated`, dan
  `service_role` dicabut. Foreign key `userId` memakai primary-key index dan cascade delete.

`prisma migrate dev --create-only` tidak dapat replay migration Fase 2 pada shadow database karena
migration lama mengamankan `_prisma_migrations`. Migration Fase 6 karena itu dibuat dengan
`prisma migrate diff` terhadap datasource aktif, direview, lalu diterapkan lewat
`prisma migrate deploy`. Riwayat database tetap sinkron dan `prisma migrate status` melaporkan
schema up to date.

## Cache dan invalidation

- Cache key/tag per-user ditambahkan untuk account, overview, dan flashcard settings.
- Update profile meng-expire account cache dan me-refresh dashboard layout.
- Kana grade, flashcard rating, practice answer, dan exam completion meng-expire overview cache.
- Save/reset setting memakai `updateTag` sehingga queue berikutnya langsung membaca preference
  terbaru.

## Verifikasi

Lolos:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx prisma migrate status`
- Database audit: RLS aktif, array step `NOT NULL`, enam constraint terpasang, dan tidak ada grant
  SELECT untuk role Data API.
- Negative database test: `newCardsPerDay = 101` ditolak constraint dan transaksi QA rollback.
- Browser QA desktop dan mobile `390x844`: overview, profile edit, security UI, settings groups,
  client validation, save/reset, dan horizontal overflow.
- Setting `newCardsPerDay = 0` menutup antrean review dengan pesan limit dan link pengaturan.
- Rating QA `GOOD` membuat `FlashcardProgress(state=LEARNING, learningStep=1)` dengan due 10 menit
  serta `FlashcardReviewLog.wasNew = true`.
- Profile overview berubah dari 0 menjadi 1 vocabulary setelah rating, membuktikan invalidation
  cache per-user.

Akun, progress, setting, route login development, dan session browser QA sementara sudah dihapus.
