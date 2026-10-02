# Catatan Migration

Setiap perubahan `prisma/schema.prisma`, constraint, index, enum, SQL policy, trigger, atau data
contract wajib memiliki migration dan catatan ringkas di dokumen/PR perubahan. Jangan memakai
`prisma db push` untuk perubahan project ini.

## Template

```md
### <tanggal> - <nama perubahan>

- Status: required / not required / deployed
- Migration: prisma/migrations/<timestamp_name>/migration.sql atau "tidak ada"
- Alasan: perilaku/kontrak yang membutuhkan perubahan
- Object terdampak: table, column, index, constraint, policy, atau data
- Data existing: backfill/cleanup yang dibutuhkan dan cara memverifikasinya
- Risiko operasi: lock, durasi, compatibility aplikasi lama/baru, dan urutan deploy
- Validasi: prisma validate, migrate status/diff yang relevan, seed validation, dan query pemeriksaan
- Refresh setelah deploy: cache invalidation, reseed, restart, atau tidak ada
- Owner: role/nama yang mengeksekusi dan memverifikasi
```

## Checklist Author

- [ ] Schema dan [database.md](../database.md) konsisten.
- [ ] Migration dibuat dengan `prisma migrate dev`, dibaca manual, dan tidak berisi drop tak sengaja.
- [ ] `DATABASE_URL` tetap untuk runtime pooled; `DIRECT_URL` tetap untuk migration direct connection.
- [ ] Constraint/ownership baru memiliki strategi untuk row existing.
- [ ] Index ditinjau untuk foreign key dan query ownership yang baru/berubah.
- [ ] Urutan deploy kompatibel atau downtime dicatat eksplisit.
- [ ] `npx prisma validate` dan `npm run verify` lulus.
- [ ] User menerima langkah migration/seed/cache refresh sebelum acceptance test.

## Ledger

### 2 Oktober 2026 - Pola bunpou sebagai target catatan dan diskusi

- Status: required (belum di-deploy)
- Migration: `prisma/migrations/20261002130000_comment_bunpou_point_target/migration.sql`.
- Alasan: catatan pribadi dan diskusi publik per pola bunpou memakai tabel `QuestionComment` yang
  sama dengan soal dan kata flashcard.
- Object terdampak: kolom `QuestionComment.bunpouPointId` dengan FK `ON DELETE RESTRICT`, tiga index,
  dan CHECK `QuestionComment_target_check` yang didefinisikan ulang menjadi
  `num_nonnulls("questionId", "vocabId", "bunpouPointId") = 1`.
- Data existing: tidak ada backfill; seluruh baris lama punya kolom baru NULL dan tepat satu target
  lama, jadi CHECK baru langsung terpenuhi.
- Risiko operasi: `DROP`/`ADD CONSTRAINT` memindai `QuestionComment`. **Wajib diterapkan sebelum
  deploy kode**: seluruh query diskusi dan catatan (soal dan kata juga) kini memilih kolom
  `bunpouPointId`, jadi kode baru tanpa migration ini membuat halaman diskusi error.
- Validasi: `npx prisma validate`, `src/features/question-comment/target.test.ts`, typecheck, lint,
  test, build.
- Refresh setelah deploy: `npx prisma generate` lalu redeploy (juga memperbarui `robots.txt` dan
  sitemap untuk diskusi yang kini diindeks).
- Owner: Engineering Owner.

### 2 Oktober 2026 - Pola dan perbandingan bunpou sebagai target laporan

- Status: required (belum di-deploy)
- Migration: `prisma/migrations/20261002120000_report_bunpou_enum/migration.sql` lalu
  `prisma/migrations/20261002120100_report_bunpou_target/migration.sql`. Dipisah dua karena nilai
  enum baru tidak boleh dipakai di transaksi yang menambahkannya (SQLSTATE 55P04).
- Alasan: isi pola dan perbandingan ditulis AI, jadi user perlu jalur untuk melaporkan yang keliru.
- Object terdampak: enum `ReportTargetType` (+`BUNPOU_POINT`, `BUNPOU_COMPARISON`), enum
  `ReportCategory` (+`CONNECTION_ERROR`); kolom `Report.bunpouPointId` dan
  `Report.bunpouComparisonId` dengan FK `ON DELETE SET NULL`, index, CHECK
  `Report_target_columns_check` yang didefinisikan ulang, dan dua partial unique index anti-banjir.
- Data existing: tidak ada backfill; seluruh baris lama punya kedua kolom NULL sehingga CHECK baru
  langsung terpenuhi.
- Risiko operasi: `DROP`/`ADD CONSTRAINT` CHECK memindai tabel `Report` yang kecil. Kode baru
  membaca kolom ini di antrean `/admin/report`, jadi migration wajib diterapkan **sebelum** deploy
  kode; kode lama tidak terpengaruh kolom baru.
- Validasi: `npx prisma validate`, `src/features/report/report-migrations.test.ts`, typecheck,
  lint, test, build.
- Refresh setelah deploy: `npx prisma generate` lalu redeploy. Tidak ada cache yang perlu
  diinvalidasi.
- Owner: Engineering Owner.

### 1 Oktober 2026 - Katalog Bunpou Phase A

- Status: deployed (2 Oktober 2026; seed 227 point)
- Migration: `prisma/migrations/20261001200000_bunpou_catalog/migration.sql`. Ditulis tangan;
  `prisma migrate dev` tidak dipakai karena shadow database Supabase tidak tersedia untuk project
  ini.
- Alasan: fixture hasil ekstraksi slide membutuhkan katalog grammar yang stabil, provenance dua
  tahap AI, pengelompokan family/section, dan kelompok perbandingan yang dapat dirujuk fitur lain.
- Object terdampak: enum `BunpouKind`; tabel `BunpouPoint`, `BunpouComparison`, dan
  `BunpouComparisonPoint`; unique key dan urutan per level; index section/family/tag/FK; tiga FK;
  revoke grant Data API; RLS aktif tanpa policy client.
- Data existing: seluruh tabel baru dan kosong. Setelah migration, jalankan ekstraksi/generator,
  `npm run seed:bunpou:check`, lalu `npm run seed:bunpou`.
- Risiko operasi: hanya membuat object baru sehingga tidak mengunci tabel aplikasi lama. Kode lama
  tidak membaca tabel ini; migration aman dideploy sebelum UI Bunpou. Seed mempertahankan row yang
  hilang sebagai retired dan memakai order negatif internal untuk membebaskan unique order saat
  dua point bertukar posisi.
- Validasi: `npx prisma validate`, validasi fixture, lint, typecheck, test, build, dan penerapan
  migration pada PostgreSQL lokal/Supabase masih harus dilengkapi sebelum deploy.
- Refresh setelah deploy: jalankan `npx prisma generate`, redeploy aplikasi, lalu seed setelah
  fixture N5 lolos review. Setelah seed, invalidasi tag `bunpouCatalog` di `/admin/ops` (atau
  tunggu `revalidate` 1 jam).
- Urutan deploy (sejak UI `/bunpou` ada): migration wajib diterapkan **sebelum** deploy kode UI,
  karena `sitemap.xml` di-prerender saat build dan membaca `BunpouPoint` selama
  `FEATURES_BUNPOU` aktif. Tanpa migration, build gagal dengan `P2021`.
- Owner: Engineering Owner.

### 1 Oktober 2026 - Kartu flashcard sebagai target laporan

- Status: required (belum di-deploy)
- Migration: `prisma/migrations/20261001150000_report_flashcard_vocab_enum/migration.sql`, lalu
  `prisma/migrations/20261001150100_report_flashcard_vocab_target/migration.sql`. Ditulis tangan;
  `prisma migrate dev` tidak dipakai karena shadow database Supabase.
- Alasan: isi 6.720 kartu kosakata ditulis AI dan perlu jalur laporan dari user yang menunjuk kata
  di katalog. Rancangan di [report.md](../module/report.md).
- Object terdampak: nilai enum `ReportTargetType.FLASHCARD_VOCAB` dan
  `ReportCategory.READING_ERROR`/`MEANING_ERROR`/`EXAMPLE_ERROR`/`TAG_ERROR`; kolom
  `Report.vocabId` dengan FK `Report_vocabId_fkey` ke `FlashcardVocab` (`ON DELETE SET NULL`),
  index `Report_vocabId_idx`, `Report_target_columns_check` didefinisikan ulang dengan klausa
  `vocabId`, dan partial unique index `Report_open_vocab_per_reporter_key`.
- Data existing: tidak ada backfill. Kolom baru `NULL` di seluruh baris lama, sehingga CHECK baru
  langsung terpenuhi.
- Risiko operasi: dua migration WAJIB tetap terpisah. Nilai enum baru tidak boleh dipakai di
  transaksi yang menambahkannya (`55P04 unsafe use of new value`), dan `migrate deploy` menjalankan
  satu file sebagai satu transaksi; versi satu file sudah dicoba dan gagal dengan `P3018`. Tabel
  `Report` dikunci sebentar saat CHECK diganti dan divalidasi ulang (tabel kecil). Aplikasi lama
  tetap jalan setelah migration karena tidak pernah menulis nilai atau kolom baru; deploy migration
  dulu, baru kode.
- Validasi: `npx prisma validate`; `migrate deploy` dari nol ke PostgreSQL 16 lokal dengan role
  Supabase tiruan; `migrate diff` dari database itu ke `schema.prisma` hanya menyisakan drift lama
  (`Report.updatedAt` default); CHECK, unique index, dan `SET NULL` diuji langsung dengan transaksi
  yang di-rollback; `npm run lint`, `typecheck`, `test`, dan `build` lulus.
- Refresh setelah deploy: redeploy agar Prisma Client terbaru aktif. Tidak ada cache yang perlu
  diinvalidasi dan tidak perlu seed ulang.
- Owner: Engineering Owner.

### 26 September 2026 - Kotak masuk laporan pengguna (Report)

- Status: deployed
- Migration: `prisma/migrations/20260926230000_report_inbox/migration.sql`
- Alasan: kesalahan isi soal, kunci jawaban keliru, dan bug aplikasi sebelumnya hanya sampai lewat
  jalur di luar aplikasi. Tabel ini menjadikannya antrean yang dapat ditindak dan ditelusuri, dengan
  tautan langsung ke objek yang dikeluhkan.
- Object terdampak: tiga enum (`ReportTargetType`, `ReportCategory`, `ReportStatus`), tabel `Report`,
  enam foreign key (`questionId`, `articleId`, `commentId`, `reporterId`, `repliedById`,
  `handledById`) seluruhnya `ON DELETE SET NULL`, dua CHECK constraint, delapan index biasa, tiga
  partial unique index, revoke grant Data API, dan RLS aktif.
- Data existing: tabel baru dan kosong; tidak ada backfill.
- Risiko operasi: tabel baru, tidak menyentuh data lama. Dua hal yang perlu diingat saat mengubah
  tabel ini kemudian: (1) `Report_target_columns_check` sengaja TIDAK mewajibkan kolom target terisi,
  karena FK-nya `SET NULL` dan CHECK semacam itu akan menggagalkan penghapusan soal/artikel/komentar
  yang dirujuknya; (2) ketiga partial unique index dan kedua CHECK tidak terlihat oleh Prisma, jadi
  `schema.prisma` bukan daftar lengkap constraint tabel ini.
- Validasi: `npx prisma validate`, `prisma migrate deploy`, `prisma migrate status` (up to date),
  `npm run lint`, `npm run typecheck`, `npm run test` (258 lulus), dan `npm run build` lulus.
- Refresh setelah deploy: redeploy agar Prisma Client terbaru aktif, dan set `FEATURES_REPORT` di
  environment bila ingin eksplisit (kosong = aktif). Tidak ada cache yang perlu diinvalidasi —
  antrean laporan memang tidak di-cache.
- Owner: Engineering Owner.

### 25 September 2026 - Audit log aksi admin

- Status: deployed
- Migration: `prisma/migrations/20260925210000_admin_audit_log/migration.sql`
- Alasan: role statis dua level berarti siapa pun yang dapat memperbaiki typo soal juga dapat
  menghapus akun user; tanpa tabel ini tidak ada cara menelusuri apa yang terjadi dan siapa
  pelakunya.
- Object terdampak: tabel `AdminAuditLog`, foreign key `actorId` ke `User` dengan
  `ON DELETE SET NULL`, tiga index (`createdAt`, `actorId`, `targetType`+`targetId`), revoke grant
  Data API, dan RLS aktif.
- Data existing: tabel baru dan kosong; tidak ada backfill. Aksi admin sebelum migrasi ini memang
  tidak tercatat dan tidak dapat direkonstruksi.
- Risiko operasi: tabel baru, tidak menyentuh data lama. SET NULL dipilih supaya menghapus akun
  admin tidak ikut menghapus jejak aksinya; `actorName` disimpan sebagai snapshot agar baris tetap
  terbaca setelah akunnya hilang.
- Validasi: `npx prisma validate`, `prisma migrate deploy`, lint, typecheck, dan build lulus.
  Jaminan transaksional diuji langsung: transaksi yang di-rollback tidak menyisakan baris log,
  transaksi yang commit menyisakannya.
- Refresh setelah deploy: redeploy agar Prisma Client terbaru aktif. Tidak ada cache yang perlu
  diinvalidasi.
- Owner: Engineering Owner.

### 25 September 2026 - Atribusi penghapusan komentar (deletedById)

- Status: deployed
- Migration: `prisma/migrations/20260925180000_comment_deleted_by/migration.sql`
- Alasan: moderasi admin membutuhkan pembeda antara takedown admin dan hapusan pemilik. Hanya
  takedown admin yang boleh dipulihkan; memulihkan hapusan pemilik berarti menerbitkan ulang
  tulisan yang sengaja ia tarik.
- Object terdampak: kolom `QuestionComment.deletedById`, foreign key ke `User` dengan
  `ON DELETE SET NULL`, index `QuestionComment_deletedById_idx` dan `QuestionComment_sharedAt_idx`.
- Data existing: baris yang sudah `deletedAt` berasal dari sebelum admin ada, jadi seluruhnya
  dibackfill `deletedById = userId` (hapusan pemilik) agar tidak tertukar dengan takedown admin.
- Risiko operasi: kolom nullable dan dua index pada tabel yang masih kecil. SET NULL dipilih supaya
  menghapus akun admin tidak ikut menghapus komentar milik user lain yang pernah ia takedown.
- Validasi: `npx prisma validate`, `prisma migrate deploy`, dan `npm run verify` lulus. Dua cabang
  state diuji lewat HTTP: entri yang dihapus pemilik tampil tanpa tombol pulihkan, entri hasil
  takedown admin tampil dengan tombol pulihkan dan nama admin yang menghapusnya.
- Refresh setelah deploy: redeploy agar Prisma Client terbaru aktif. Tidak ada cache yang perlu
  diinvalidasi — thread diskusi memang tidak di-cache.
- Owner: Engineering Owner.

### 25 September 2026 - Role statis USER/ADMIN

- Status: deployed
- Migration: `prisma/migrations/20260925150000_user_role/migration.sql`
- Alasan: prasyarat dashboard admin (`/admin`). Dua role statis, tanpa tabel permission granular.
- Object terdampak: enum `UserRole`, kolom `User.role` NOT NULL DEFAULT 'USER', index `User_role_idx`.
- Data existing: tidak ada backfill terpisah. Default constant membuat seluruh akun lama tetap
  `USER`; admin pertama dipromosikan manual lewat `npm run user:role`.
- Risiko operasi: penambahan kolom dengan default constant, tidak menulis ulang tabel pada
  PostgreSQL 11+. Aplikasi lama mengabaikan kolom baru sehingga urutan deploy bebas.
- Validasi: `npx prisma validate`, `prisma migrate deploy`, `npm run lint`, `npm run typecheck`,
  dan `npm run build` lulus. Guard diuji lewat HTTP: guest dan user berrole `USER` mendapat 404 di
  `/admin`, admin mendapat 200 dengan cookie session yang sama.
- Refresh setelah deploy: redeploy agar Prisma Client terbaru aktif. Tidak ada cache aplikasi yang
  perlu diinvalidasi — overview admin sengaja tidak di-cache.
- Owner: Engineering Owner.

### 3 September 2026 - Google OAuth account linking

- Status: deployed
- Migration: `prisma/migrations/20260903170000_google_oauth_account_linking/migration.sql`
- Alasan: mendukung login/register Google, account linking, dan akun OAuth-only tanpa password.
- Object terdampak: `User.password` menjadi nullable, enum `OAuthProvider`, tabel `OAuthAccount`,
  unique index identity/provider per user, foreign key cascade, CHECK constraint, RLS, dan revoke
  privilege Data API.
- Data existing: user credential dan hash password tidak berubah; seluruh token `EMAIL_CHANGE`
  lama dihapus karena email sekarang immutable.
- Risiko operasi: perubahan password hanya melonggarkan nullability. Tabel identity baru tidak
  memerlukan backfill; aplikasi lama tetap dapat membaca user credential selama rollout.
- Validasi: `prisma migrate deploy` dan status migration lulus; nullable column, index, constraint,
  RLS, grant kosong, serta cleanup token diverifikasi langsung melalui catalog PostgreSQL.
- Refresh setelah deploy: restart/redeploy aplikasi setelah Google environment diisi agar tombol
  OAuth dan Prisma Client terbaru aktif.
- Owner: Engineering Owner.

### 3 September 2026 - Phase 1.2 profile dan account lifecycle

- Status: deployed
- Migration: `prisma/migrations/20260903113000_phase_1_2_profile_account_lifecycle/migration.sql`
- Alasan: timezone user, opt-in privacy AI, metadata ownership avatar, dan grace period penghapusan akun.
- Object terdampak: kolom baru pada `User`, unique index public ID avatar, partial index akun pending
  deletion, serta CHECK constraint metadata avatar/timezone/jadwal deletion.
- Data existing: timezone dibackfill melalui default `Asia/Jakarta`; privacy default `false`; avatar
  legacy tetap valid dengan metadata null.
- Risiko operasi: seluruh penambahan nullable atau memakai constant default; index dibuat pada tabel
  user yang kecil. Aplikasi lama mengabaikan kolom baru dan tetap kompatibel selama urutan deploy.
- Validasi: migration diterapkan dengan `prisma migrate deploy`; `prisma validate`, status migration,
  pemeriksaan constraint/index, dan `npm run verify` dijalankan sebelum handoff.
- Refresh setelah deploy: redeploy aplikasi agar Prisma Client dan cron lifecycle terbaru aktif.
- Owner: Engineering Owner.

### 2 September 2026 - Phase 0 engineering baseline

- Status: not required
- Migration: tidak ada
- Alasan: perubahan hanya pada lint/typecheck/build scripts, validasi cookie guest, observability,
  response error health, dan dokumentasi operasional.
- Object terdampak: tidak ada object database.
- Data existing: tidak ada backfill atau cleanup.
- Risiko operasi: instrumentation menambah satu log JSON untuk error server; tidak mengubah data.
- Validasi: `npx prisma validate` dan `npm run verify` pada verifikasi akhir.
- Refresh setelah deploy: restart/redeploy aplikasi agar instrumentation dimuat.
- Owner: Engineering Owner.
