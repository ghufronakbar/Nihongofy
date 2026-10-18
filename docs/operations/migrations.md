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

### 18 Oktober 2026 - Kamus seleksi JMdict

- Status: not required.
- Migration: tidak ada.
- Alasan: lookup memakai indeks gzip read-only, bukan tabel aplikasi.
- Object terdampak: artefak baru `assets/dictionary`, tidak ada perubahan schema/constraint/index/policy.
- Data existing: tidak ada seed, backfill, cleanup atau perubahan data aplikasi.
- Risiko operasi: manifest dan seluruh shard harus satu versi/deployment; jangan hot-swap pada server hidup.
- Validasi: checker integritas/restriction, rebuild reproducible dan failed-update preservation lulus; hasil quality gate dan UAT di [catatan verifikasi](../verification/dictionary-popup-uat.md).
- Refresh: restart/redeploy dan refresh tab untuk perubahan flag/indeks; tidak perlu flush Redis global.
- Owner: Engineering Owner untuk indeks/kode; Release Owner untuk budget, UAT dan aktivasi.

### 18 Oktober 2026 - Kana Word Race solo

- Status: required; diterapkan dan diuji pada PostgreSQL lokal disposable, belum production.
- Migration: `prisma/migrations/20261018051003_kana_word_race_solo/migration.sql`.
- Alasan: sesi solo membutuhkan roster satu pemain, sedangkan CHECK v1 mewajibkan 2-20.
- Object: hanya `KanaRaceMatch_shape_check`; mode solo tepat satu roster, mode multiplayer
  atau config legacy tanpa mode tetap 2-20. Semua syarat bentuk/versi/ronde/expiry dipertahankan.
  Tidak ada perubahan Prisma model, tabel, kolom, index, FK, RLS, grant atau release kamus.
- Data existing: tidak ada backfill/cleanup/reseed. JSON tanpa `config.mode` dibaca multiplayer.
  Mode baru tersimpan dalam config JSONB dan tidak dapat diubah melalui configure.
- Risiko operasi: DROP/ADD dalam satu statement memerlukan ACCESS EXCLUSIVE singkat;
  `NOT VALID` menjaga row baru, lalu VALIDATE memeriksa row existing dengan lock
  SHARE UPDATE EXCLUSIVE. Terapkan sebelum kode solo. Drain dan selesaikan pertandingan,
  redeploy, lalu refresh tab: kode lama memakai config strict tanpa mode sehingga tidak
  dapat membaca config yang ditulis kode baru, termasuk multiplayer baru.
- Validasi: file kosong dibuat lewat Prisma `migrate dev --create-only` pada generator
  disposable, SQL CHECK ditinjau manual dan diterapkan setelah seluruh 45 migration existing.
  Checker lokal memeriksa legacy, roster solo/multiplayer, akses owner, concurrency/retry,
  hasil, rematch dan privasi. Bukti proyek ada di [UAT](../verification/kana-word-race-uat.md).
- Refresh: `npx prisma migrate deploy` melalui DIRECT_URL target, redeploy dan refresh tab.
  Tidak perlu reseed, env baru atau flush cache Redis.
- Owner: Engineering Owner untuk kode/bukti lokal; Release Owner untuk migration/deploy/UAT target.

### 18 Oktober 2026 - Kana Word Race v1

- Status: required; diterapkan dan diuji pada PostgreSQL lokal disposable, belum production.
- Migration: `prisma/migrations/20261018035428_kana_word_race/migration.sql`.
- Alasan: kamus game immutable dan ledger room/pertandingan tebak kana privat, terpisah dari
  Flashcard dan Kotoba Clash.
- Object: enam tabel baru, FK/index, CHECK identitas/bentuk/panjang, partial unique unfinished
  match per room, composite current-match FK, RLS dan revoke tabel/sequence/fungsi; trigger
  dictionary immutable memakai fungsi invoker (bukan SECURITY DEFINER).
- Data existing: tidak diubah; tidak ada backfill. Seed game turunan fixture harus dijalankan
  setelah migration; provenance vocabId boleh NULL jika flashcard belum diseed.
- Risiko operasi: additive, tetapi FK pada User/FlashcardVocab memerlukan lock singkat.
  Migration wajib mendahului deploy **termasuk flag-off** karena cron/account lifecycle
  memanggil tabel baru. State JSONB/row-lock dan biaya provider perlu pengukuran hosting.
- Validasi: Prisma `migrate dev --create-only` pada generator baseline disposable; SQL dibaca
  manual, 45 migration direplay ke DB lokal dengan role Supabase lokal. Seed/reseed/check,
  FK/RLS/grant/trigger serta checker concurrency/privacy/anonimisasi/retensi lulus lokal.
  Diff hanya menunjukkan drift existing `Report.updatedAt` DEFAULT now() vs schema tanpa
  default; tidak ada drift objek Kana Race dan tidak ada perubahan Report pada migration ini.
  Hasil engineering proyek dan UAT tercatat di [verifikasi](../verification/kana-word-race-uat.md).
- Refresh: `npx prisma migrate deploy`, validasi/seed Kana Race, deploy default-off, UAT target,
  kemudian flag/runtime enable. Drain Redis game ini sebelum rollback/redeploy; jangan drop
  schema untuk rollback aplikasi biasa.
- Owner: Engineering Owner untuk kode/bukti lokal; Release Owner untuk target migration,
  seed, deployment, review konten dan acceptance/aktivasi.


### 17 Oktober 2026 - Kotoba Clash refinement lobby

- Status: required (applied dan diuji lokal; belum dijalankan pada production di sesi ini)
- Migration: `prisma/migrations/20261017164300_kotoba_clash_lobby_refinements/migration.sql`
- Alasan: host dapat mengeluarkan peserta di lobby tanpa menghapus ledger atau mengizinkan
  reconnect memulihkan membership yang sudah dicabut.
- Object terdampak: satu kolom nullable `KotobaClashRoomMember.kickedAt` `TIMESTAMPTZ(3)`.
  Tidak ada perubahan index/FK/CHECK/RLS/grant. Semua row existing tetap NULL; tidak ada backfill.
- Risiko operasi: ADD COLUMN nullable tanpa default tidak menulis ulang tabel, tetapi membutuhkan
  ACCESS EXCLUSIVE lock singkat. Terapkan sebelum redeploy. Selesaikan match dan refresh semua
  tab setelah redeploy agar instance/socket lama tidak mengabaikan status kick yang baru.
- Validasi: Prisma create-only memakai baseline generator lokal disposable karena shadow replay
  sejarah gagal pada `_prisma_migrations`; SQL ditinjau dan diterapkan pada DB lokal yang berisi
  seluruh migration existing. Prisma validate, checker transaksi/RLS/anonimisasi, dan gate penuh
  dicatat di [laporan refinement lobby](../verification/kotoba-clash-lobby-refinements.md).
- Refresh setelah deploy: `npx prisma migrate deploy` melalui DIRECT_URL, redeploy dan refresh tab.
  Tidak ada env/seed/flush Redis atau cache baru.
- Owner: Engineering Owner untuk bukti lokal; user/Release Owner untuk migration/deploy production.

### 17 Oktober 2026 - Kotoba Clash room multiuser dan penggantian room host

- Status: not required
- Migration: tidak ada
- Alasan: hapus batas satu room global, buat room host masing-masing, tutup room lama ketika host
  membuat room baru, dan longgarkan create menjadi 20 percobaan/menit per akun terverifikasi.
- Object terdampak: transaksi existing `KotobaClashRoom`/membership; advisory lock hanya per host,
  room dikunci terurut. Request UUID opsional dipakai sebagai PK room existing untuk retry.
  Tidak ada perubahan tabel/kolom/index/CHECK/policy/default atau seed.
- Data existing: tidak ada backfill atau bulk close. Room OPEN lama hanya ditutup saat pemiliknya
  membuat room baru; room pengguna lain tidak disentuh. Ledger dan hasil tetap mengikuti retensi.
- Risiko operasi: penutupan dan insert baru atomik, rollback mempertahankan room lama. Pembuatan
  room baru menutup room lama termasuk match aktif; client diberi keterangan sebelum klik.
  Tidak ada lock admission global lagi. Bucket Redis baru `create-account` mengabaikan bucket
  create IP lama, yang akan expired sendiri; tidak perlu menghapus key Upstash.
- Validasi: concurrency/retry/rollback real PostgreSQL, room aktif, history, rate/auth dan terminal
  socket diuji; hasil lengkap ada pada [laporan room multiuser](../verification/kotoba-clash-multi-room.md).
- Refresh setelah deploy: redeploy dan refresh tab host. Tidak ada env/reseed/cache reset baru.
  Selama deployment lama masih berjalan, server lama tetap memakai aturan create lama;
  gunakan tab baru setelah deploy. Migration early-reveal sebelumnya tetap prasyarat v2.
- Owner: Engineering Owner untuk kode/verifikasi; user/Release Owner untuk redeploy dan acceptance.

### 17 Oktober 2026 - Kotoba Clash reveal saat seluruh roster menjawab

- Status: required (replay lokal PASS; belum diterapkan ke production pada sesi ini)
- Migration: `prisma/migrations/20261017141402_kotoba_clash_early_reveal/migration.sql`
- Alasan: pertandingan baru memakai aturan v2 untuk langsung reveal ketika semua pemain menjawab;
  pertandingan v1/historis tetap memakai deadline penuh dan skor semula.
- Object terdampak: hanya CHECK `KotobaClashMatch_schedule_check`, menerima versi 1/2 sambil
  mempertahankan syarat `startsAt < endsAt < expiresAt` dan config JSON object. Default versi
  database tetap 1; aplikasi baru menulis 2 secara eksplisit. Tidak ada tabel/kolom/index baru.
- Data existing: tidak ada backfill, konversi versi, penghapusan atau reseed. Migration hanya
  melonggarkan versi yang diizinkan; jadwal dan ledger match lama tetap utuh.
- Risiko operasi: DROP/ADD constraint dalam satu statement memerlukan ACCESS EXCLUSIVE lock
  singkat; `NOT VALID` menegakkan row baru, lalu VALIDATE memeriksa row existing dengan lock
  SHARE UPDATE EXCLUSIVE. Jalankan saat trafik rendah. Terapkan migration lebih dahulu; default
  1 menjaga aplikasi lama tetap dapat membuat match v1 selama pergantian deployment. Server lama
  tidak mendukung match v2: selesaikan match aktif, redeploy, lalu refresh semua tab sebelum Start.
- Validasi: migration dibuat melalui Prisma create-only pada baseline generator disposable,
  disesuaikan untuk CHECK yang tidak dimodelkan Prisma; seluruh 43 migration direplay lokal.
  CHECK tervalidasi, default 1, versi 3 ditolak, RLS/grant tetap tertutup. Checker foundation,
  room, dan early-reveal serta gate lengkap dicatat pada
  [laporan](../verification/kotoba-clash-early-reveal.md). Belum ada verifikasi/write remote baru.
- Refresh setelah deploy: `npx prisma migrate deploy` memakai `DIRECT_URL` target, redeploy,
  refresh seluruh tab host/pemain/spectator, lalu buat match baru. Tidak ada env atau seed baru.
- Owner: Engineering Owner untuk implementasi/bukti lokal; user/Release Owner untuk migration,
  deployment, dan acceptance production.

### 17 Oktober 2026 - UI/UX kompetisi Kotoba Clash

- Status: not required
- Migration: tidak ada
- Alasan: redesign landing/join/lobby/arena/hasil, avatar peserta, serta terminal room closed/expired.
- Object terdampak: query snapshot menambah select relasi `User.avatarUrl` existing. Tidak ada
  perubahan tabel, kolom, index, constraint, policy, seed, atau format data tersimpan.
- Data existing: tidak perlu backfill/cleanup. Avatar dibaca dari akun saat snapshot, bukan disalin.
- Risiko operasi: field wire avatar opsional; payload lama/baru kompatibel. Socket deployment
  lama dapat menampilkan fallback initial sampai reconnect. Aturan skor/deadline tidak berubah.
- Validasi: query avatar dibuktikan read-only; gate dan evidence UI pada
  [laporan UI/UX](../verification/kotoba-clash-ui-ux.md).
- Refresh setelah deploy: redeploy aplikasi lalu refresh tab. Tidak ada reseed/invalidation manual
  atau perubahan environment baru.
- Owner: Engineering Owner; user/Release Owner untuk acceptance UI di production.

### 17 Oktober 2026 - Integrasi Mini Games dan Kotoba Clash (C-E)

- Status: not required
- Migration: tidak ada; menggunakan fondasi `20261016174702_kotoba_clash_foundation` yang
  terkonfirmasi applied melalui status/metadata Supabase read-only. Tidak ada perubahan schema,
  index, policy, seed atau backfill.
- Alasan: menghubungkan katalog/lobby, transport, runner, hasil/rematch, export dan cleanup.
- Object terdampak: runtime membaca/menulis enam tabel fondasi; cron auth existing menambahkan
  batch room/match expired, idle close dan anonimisasi guest expired.
- Data existing: tidak dimutasi selama pengujian; fixture memakai cluster loopback disposable.
- Risiko operasi: kedua flag default false. Migration fondasi tetap prasyarat export/anonimisasi
  dan cron, walaupun flag mati. Aktivasi menunggu budget dan UAT Hobby produk final.
- Validasi: gate `npm run verify` dan checker lokal; bukti serta batasnya di
  [laporan C-E](../verification/kotoba-clash-phase-c-e.md).
- Refresh setelah deploy: restart/redeploy untuk flag; drain runtime sebelum menonaktifkan.
  Tidak ada reseed/invalidation manual; stok aggregate mengikuti tag bank soal.
- Owner: Engineering Owner; user/Release Owner untuk verifikasi remote dan acceptance.

### 17 Oktober 2026 - Fondasi domain Kotoba Clash (fase B)

- Status: deployed, dikonfirmasi 17 Oktober 2026 melalui `prisma migrate status` dan metadata
  Supabase read-only: 42 migration up to date, keenam tabel RLS/tanpa grant Data API, 22 constraint
  tervalidasi serta partial unique index aktif/valid. Tidak menjalankan ulang migration atau write.
  Uji perilaku constraint memakai PostgreSQL 17.11 lokal; bukti remote ada di laporan C-E.
- Migration: `prisma/migrations/20261016174702_kotoba_clash_foundation/migration.sql`.
  Timestamp generator UTC; tanggal lokal pekerjaan 17 Oktober WIB.
- Alasan: persistence room, roster, jadwal tetap, jawaban pertama final, dan rekonstruksi skor.
- Object terdampak: dua enum dan enam tabel `KotobaClash*`; index semua FK, FK komposit untuk
  kesamaan room/match, unique answer, partial unique satu RUNNING per room, CHECK bentuk
  identitas/jadwal/nilai, RLS serta revoke grant PUBLIC/anon/authenticated/service_role.
- Data existing: tidak ada backfill/seed. Tidak ada tabel/kolom existing yang diubah atau dihapus.
- Risiko operasi: additive; **migration wajib sebelum deploy kode** karena export akun dan
  anonimisasi membaca tabel baru meskipun kedua feature flag game mati. Deploy kode dengan
  `FEATURES_MINI_GAMES=false` dan `FEATURES_KOTOBA_CLASH=false`; aktivasi publik belum disetujui.
- Validasi: Prisma validate/generate, replay 42 migration lokal, checker transaksi/constraint/RLS
  dan anonimisasi, serta `npm run verify`. Generator memakai baseline lokal terisolasi karena
  shadow replay sejarah lama gagal P3006 pada `_prisma_migrations`. Diff global hanya melaporkan
  default existing `Report.updatedAt`; bukan perubahan Kotoba Clash. Lihat [bukti B](../verification/kotoba-clash-phase-b.md).
- Refresh setelah deploy: Prisma Client regenerate melalui postinstall; tidak ada cache/seed.
- Owner: Engineering Owner.

### 16 Oktober 2026 - Probe infrastruktur Kotoba Clash (fase A)

- Status: not required
- Migration: tidak ada
- Alasan: probe operator WebSocket terisolasi, belum membuat domain/persistence game.
- Object terdampak: tidak ada object PostgreSQL/Supabase; fixture Redis pada namespace probe saja.
- Data existing: tidak ada backfill/seed; state, lease, dan rate bucket uji dibersihkan secara
  terarah, dengan TTL sebagai cadangan. Session/auth tidak dimutasi.
- Risiko operasi: traffic preview berbagi kuota provider; endpoint default off dan ditolak pada
  production. Tidak ada urutan migration/deploy database.
- Validasi: `npm run verify` dan pengujian terpisah pada Vercel Hobby; rincian hasil dan blocker di
  [laporan fase A](../verification/kotoba-clash-phase-a.md).
- Refresh setelah deploy: preview memakai dependency/env baru; tidak ada invalidasi cache aplikasi.
- Owner: Engineering Owner.

### 3 Oktober 2026 - Postingan komunitas

- Status: deployed (3 Oktober 2026, `migrate deploy`; diverifikasi di transaksi yang di-rollback:
  CHECK target komentar menolak dua target, CHECK target laporan menolak `postId` pada laporan
  `COMMENT`, partial unique index menolak laporan OPEN kedua dari pelapor yang sama, FK `Restrict`
  menahan hard delete postingan bercomment, like duplikat diabaikan; RLS aktif di `Post` dan
  `PostLike`; tidak ada baris tersisa)
- Migration: `prisma/migrations/20261003180000_report_post_enum/migration.sql` (nilai enum saja) dan
  `prisma/migrations/20261003180100_post/migration.sql`. Ditulis tangan; enum dipisah karena nilai
  baru tidak boleh dipakai di transaksi yang menambahkannya (`55P04`).
- Alasan: tahap 3 modul komunitas. Rancangan di
  [community.md](../module/community.md#tahap-3--postingan).
- Object terdampak: nilai enum `ReportTargetType.POST`; tabel baru `Post` (index `userId, id` dan
  `deletedById`, FK `userId` Restrict dan `deletedById` SetNull) dan `PostLike` (PK `postId, userId`,
  index `userId`, FK Cascade); kolom `QuestionComment.postId` (FK Restrict, index `postId` dan
  `postId, parentId, sharedAt`) dengan `QuestionComment_target_check` empat kolom; kolom
  `Report.postId` (FK SetNull, index) dengan `Report_target_columns_check` baru dan
  `Report_open_post_per_reporter_key`. Revoke grant Data API dan RLS untuk kedua tabel baru serta
  sequence `Post_id_seq`.
- Data existing: hanya kolom nullable baru; seluruh baris lama memenuhi CHECK baru tanpa backfill.
- Risiko operasi: `DROP`/`ADD CONSTRAINT` CHECK memvalidasi ulang `QuestionComment` dan `Report`
  (tabel kecil saat ini). **Wajib diterapkan sebelum deploy kode**: seluruh query diskusi memilih
  `postId`, dan antrean laporan memilih relasi `post`. Bergantung pada dua migration komunitas
  sebelumnya; `migrate deploy` menjalankan semuanya berurutan.
- Validasi: `npx prisma validate`, `npx prisma migrate status`, uji constraint di transaksi yang
  di-rollback, `pg_class.relrowsecurity`, `report-migrations.test.ts` dan `target.test.ts`.
- Refresh setelah deploy: tidak ada.
- Owner: Engineering Owner.

### 3 Oktober 2026 - Follow antar-user

- Status: deployed (3 Oktober 2026, `migrate deploy`; diverifikasi di transaksi yang di-rollback:
  CHECK menolak follow diri sendiri, duplikat diabaikan, kursor daftar benar; RLS aktif; tabel kosong)
- Migration: `prisma/migrations/20261003150000_follow/migration.sql`. Ditulis tangan.
- Alasan: tahap 2 modul komunitas, follow dengan persetujuan untuk akun private. Rancangan di
  [community.md](../module/community.md#tahap-2--follow).
- Object terdampak: enum baru `FollowStatus`; tabel baru `Follow` (PK `followerId, followingId`,
  CHECK `Follow_not_self_check`, index `followingId, status, createdAt` dan
  `followerId, status, createdAt`, FK kedua sisi ke `User` `ON DELETE CASCADE`), revoke grant Data
  API, RLS aktif tanpa policy.
- Data existing: tabel baru dan kosong; tidak ada backfill.
- Risiko operasi: hanya membuat object baru. **Wajib diterapkan sebelum deploy kode**: `/u/[username]`,
  layout dashboard (badge), `/profile`, export akun, dan cron anonimisasi membaca atau menghapus tabel
  ini. Bergantung pada migration `20261003120000_public_profile`; `migrate deploy` menjalankan
  keduanya berurutan.
- Validasi: `npx prisma validate`, `npx prisma migrate status`, uji constraint di transaksi yang
  di-rollback, `pg_class.relrowsecurity`.
- Refresh setelah deploy: tidak ada.
- Owner: Engineering Owner.

### 3 Oktober 2026 - Profil publik (visibility, bio, target level)

- Status: deployed (3 Oktober 2026, `migrate deploy`; diverifikasi read-only: 5 akun lama
  `PUBLIC` dengan `publicProfileNoticeDismissedAt` NULL, default kolom `'PUBLIC'` dan
  `CURRENT_TIMESTAMP`)
- Migration: `prisma/migrations/20261003120000_public_profile/migration.sql`. Ditulis tangan;
  `prisma migrate dev` tidak dipakai karena shadow database Supabase.
- Alasan: tahap 1 modul komunitas, profil publik `/u/[username]` dengan pilihan public/private.
  Rancangan di [community.md](../module/community.md).
- Object terdampak: enum baru `ProfileVisibility`; kolom `User.profileVisibility` (NOT NULL,
  default `PUBLIC`), `User.bio` (`VARCHAR(160)`), `User.jlptTarget` (`JlptLevel`), dan
  `User.publicProfileNoticeDismissedAt`.
- Data existing: tidak ada backfill. `publicProfileNoticeDismissedAt` sengaja ditambahkan tanpa
  default lalu default-nya dipasang sesudahnya, supaya akun lama tetap NULL (melihat banner "profilmu
  kini publik") dan hanya baris baru yang terisi `now()`. Jangan disatukan menjadi
  `ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP`: itu mengisi seluruh baris lama dan bannernya tidak
  pernah tampil.
- Risiko operasi: hanya menambah kolom nullable/berdefault, kompatibel dengan kode lama. **Wajib
  diterapkan sebelum deploy kode**: layout dashboard, `/profile/privacy`, `/profile/info`, dan
  `/u/[username]` membaca kolom baru. Build tidak menyentuhnya (semua route terkait dinamis).
- Validasi: `npx prisma validate`, `npx prisma migrate status`, query read-only kolom dan default
  di `information_schema.columns`.
- Refresh setelah deploy: tidak ada. Cache `profile-account` dinaikkan ke kunci `v3` sehingga entri
  lama tanpa `bio`/`jlptTarget` tidak terbaca.
- Owner: Engineering Owner.

### 2 Oktober 2026 - Upvote diskusi (QuestionCommentVote)

- Status: deployed (2 Oktober 2026, `migrate deploy` oleh pemilik project; katalog diverifikasi read-only: kolom, CHECK, FK, index, RLS aktif, tanpa grant Data API)
- Migration: `prisma/migrations/20261002150000_question_comment_vote/migration.sql`. Ditulis
  tangan; `prisma migrate dev` tidak dipakai karena shadow database Supabase.
- Alasan: suara "membantu" pada entri diskusi soal, kata, dan pola untuk urutan "Paling membantu".
  Rancangan di [question-comment.md](../module/question-comment.md#upvote).
- Object terdampak: tabel baru `QuestionCommentVote` (PK `commentId, userId`), index
  `QuestionCommentVote_userId_idx`, FK `commentId` → `QuestionComment` dan `userId` → `User`
  (keduanya `ON DELETE CASCADE`), revoke grant Data API, RLS aktif tanpa policy.
- Data existing: tabel baru dan kosong; tidak ada backfill.
- Risiko operasi: hanya membuat object baru, tidak mengunci tabel lama. **Wajib diterapkan sebelum
  deploy kode**: setiap pembacaan thread (halaman diskusi soal/kata, permalink, section diskusi
  `/bunpou/[key]`, sheet), antrean moderasi, export akun, dan cron anonimisasi kini membaca atau
  menghapus tabel ini, sehingga kode baru tanpa migration membuat halaman tersebut error. Tidak
  bergantung pada migration suspend posting, tetapi keduanya dijalankan berurutan oleh
  `migrate deploy`. Build tidak menyentuh tabel ini (seluruh route diskusi dinamis; sitemap tidak
  membaca suara).
- Validasi: `npx prisma validate`; `prisma migrate diff` dari `schema.prisma` HEAD ke schema baru
  menghasilkan CREATE TABLE/INDEX/FK yang sama (REVOKE + RLS ditambahkan tangan seperti tabel lain);
  `votes.test.ts`, `anonymize-account.test.ts`, lint, typecheck, test, build.
- Refresh setelah deploy: `npx prisma generate` lalu redeploy. Tidak ada cache yang perlu
  diinvalidasi — thread diskusi memang tidak di-cache.
- Owner: Engineering Owner.

### 2 Oktober 2026 - Suspend posting diskusi per user

- Status: deployed (2 Oktober 2026, `migrate deploy` oleh pemilik project; katalog diverifikasi read-only: kolom, CHECK, FK, index, RLS aktif, tanpa grant Data API)
- Migration: `prisma/migrations/20261002140000_user_posting_suspension/migration.sql`. Ditulis
  tangan; `prisma migrate dev` tidak dipakai karena shadow database Supabase.
- Alasan: rem darurat moderasi — user yang berulang kali menyalahgunakan diskusi dapat dihentikan
  menulis ke diskusi publik tanpa menghapus akunnya. Rancangan di
  [admin.md](../module/admin.md#7-user-dan-akun).
- Object terdampak: kolom `User.postingSuspendedAt`, `User.postingSuspendedReason`
  (`VARCHAR(500)`), `User.postingSuspendedById` dengan FK self-relation `User_postingSuspendedById_fkey`
  (`ON DELETE SET NULL`), index `User_postingSuspendedById_idx`, dan CHECK
  `User_posting_suspension_check` (alasan/admin hanya boleh terisi bila `postingSuspendedAt`
  terisi; hanya ada di SQL).
- Data existing: tidak ada backfill. Seluruh baris lama punya ketiga kolom NULL, jadi CHECK
  langsung terpenuhi dan tidak ada user yang ter-suspend.
- Risiko operasi: `ADD COLUMN` nullable tanpa default tidak menulis ulang tabel; `ADD CONSTRAINT`
  CHECK dan FK memindai tabel `User` yang kecil. **Wajib diterapkan sebelum deploy kode**: action
  diskusi, halaman diskusi, halaman admin user/moderasi, export akun, dan cron anonimisasi kini
  membaca/menulis kolom ini, sehingga kode baru tanpa migration membuat halaman tersebut error.
  Kode lama tidak terpengaruh kolom baru.
- Validasi: `npx prisma validate`; `prisma migrate diff` dari `schema.prisma` HEAD ke schema baru
  menghasilkan ALTER/INDEX/FK yang sama dengan migration (CHECK ditambahkan tangan);
  `anonymize-account.test.ts`, `posting-suspension.test.ts`, lint, typecheck, test, build.
- Refresh setelah deploy: `npx prisma generate` lalu redeploy. Tidak ada cache yang perlu
  diinvalidasi — status suspend dibaca per request dan tidak di-cache.
- Owner: Engineering Owner.

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
