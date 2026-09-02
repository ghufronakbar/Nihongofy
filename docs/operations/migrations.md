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

