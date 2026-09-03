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
