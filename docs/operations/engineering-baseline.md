# Engineering Baseline

## Gate Wajib

Setelah setiap perubahan, jalankan:

```bash
npm run verify
```

Perintah tersebut menjalankan lint tanpa toleransi warning, TypeScript strict check, lalu production
build. Untuk diagnosis, masing-masing gate dapat dijalankan dengan `npm run lint`,
`npm run typecheck`, dan `npm run build`.

Perubahan belum siap diserahkan bila salah satu gate gagal. Pengecualian harus ditulis sebagai
release blocker dengan owner dan alasan, bukan dilewati diam-diam.

GitHub Actions menjalankan gate yang sama dan `prisma validate` pada pull request serta push ke
`main` melalui `.github/workflows/quality.yml`. Placeholder environment di workflow hanya dipakai
untuk validasi/build dan tidak memiliki akses ke layanan production.

## Handoff Perubahan

Setiap fase/perubahan harus menyertakan:

1. Ringkasan perilaku yang berubah dan route/action yang terdampak.
2. Catatan migration dengan format di [migrations.md](./migrations.md), termasuk pernyataan eksplisit
   bila tidak ada perubahan schema/data.
3. Daftar skenario manual yang harus dijalankan user, diambil dari
   [manual-test-checklist.md](../verification/manual-test-checklist.md).
4. Hasil `npm run verify` dan validation/seed tambahan yang relevan.
5. Known issue, severity, owner, dan release decision.

## Structured Logging dan Error Monitoring

Server menulis satu object JSON per event melalui `src/lib/server-logger.ts`. Error yang tidak
tertangani pada render, Route Handler, Server Action, dan Proxy ditangkap oleh hook Next.js di
`src/instrumentation.ts`. Error yang sengaja ditangani harus memanggil `reportServerError` sebelum
memberi response generik; `/api/ping` menjadi contoh boundary tersebut.

Kontrak minimum event:

```json
{
  "timestamp": "2026-09-02T00:00:00.000Z",
  "level": "error",
  "service": "jlpt-exam",
  "event": "next.request.unhandled_error",
  "incidentId": "optional-correlation-id",
  "error": { "name": "Error", "message": "safe message" }
}
```

Aturan logging:

- Gunakan nama event stabil dengan format domain dan kejadian, misalnya `exam.submit.failed`.
- Log metadata operasional minimum; jangan log seluruh request, form input, Prisma row, atau response.
- Redaction terpusat menutup cookie, authorization, token, password, secret, URL database, API key,
  email/username, user ID, IP, answer payload, selected/correct answer, answer key, dan explanation.
- Query string dibuang dari path error global. Header request tidak disalin ke event.
- Stack hanya dicetak di non-production. Client menerima pesan generik dan `incidentId` bila perlu.
- Jangan memakai `console.*` langsung pada runtime server untuk error aplikasi. Seed/CLI boleh tetap
  memakai output terminal karena bukan request runtime dan tidak menerima data user.

Hook ini menyediakan error capture terpusat tanpa vendor lock-in. Environment production wajib
mengirim stdout/stderr JSON ke log drain yang memiliki retention dan alert untuk event level `error`.
Alert minimum: setiap `P0` segera, lonjakan error per route, dan kegagalan health/database berulang.

## Baseline Phase 0

| Pemeriksaan | Hasil implementasi 2 September 2026 |
|---|---|
| `npm run lint` | Lulus, 0 error dan 0 warning |
| `npm run typecheck` | Lulus |
| `npm run build` | Lulus setelah instrumentation ditambahkan |
| Perubahan schema | Tidak ada |
| Automated test framework | Tidak ditambahkan sesuai keputusan roadmap |
