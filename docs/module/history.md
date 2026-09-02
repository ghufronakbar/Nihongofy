# Modul History

## Status Aktual

**Selesai untuk riwayat mock/section attempt.** Halaman membaca seluruh attempt milik user lintas paket dan menghitung session resume untuk attempt yang belum selesai.

## Route

- `/history`

## Fitur Aktif

- Daftar attempt berdasarkan waktu mulai terbaru.
- Badge level, mode full mock/section, dan status.
- Link summary/review untuk attempt completed.
- Tombol resume untuk attempt in-progress.
- KPI total, completed, dan in-progress.

## Resume Logic

- Section practice selalu kembali ke virtual session 1.
- Full mock mencari session paling awal yang belum memiliki row `AttemptAnswer`.
- Query tidak dicache agar attempt baru/selesai langsung terlihat.

## Keterbatasan Aktual

- Hanya mencakup `Attempt`; `PracticeSession` latihan cepat tidak tampil.
- Tidak ada pagination, filter level/status/mode, search, delete, atau abandon.
- Status `ABANDONED` tidak memiliki treatment khusus: badge non-completed tampak seperti sedang dikerjakan, tetapi tombol resume hanya dirender untuk `IN_PROGRESS`.
- Resume mengasumsikan submit session selalu lengkap dan atomik. Payload parsial dapat membuat satu session dianggap sudah selesai karena sudah memiliki sebagian row jawaban.
- Tidak ada ringkasan score langsung pada card history.

## File Utama

- `src/features/history/actions.ts`
- `src/app/(dashboard)/history/page.tsx`

