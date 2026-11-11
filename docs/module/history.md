# Modul History

## Status Aktual

**Selesai untuk riwayat mock/section attempt.** Halaman membaca seluruh attempt milik user lintas paket; attempt yang belum selesai dilanjutkan ke `Attempt.currentSession`.

## Feature Flag

`FEATURES_HISTORY` (default `true`). Saat `false`, `/history` mengembalikan 404 lewat guard `src/app/(dashboard)/history/layout.tsx`, dan menu History di sidebar serta tombol "Lihat Riwayat" di dashboard tidak dirender.

Flag ini tidak bergantung pada `FEATURES_TEST_PACKAGE`. Bila test package mati, daftar attempt tetap tampil tetapi tombol "Lihat Hasil", "Review Jawaban", "Lanjutkan Ujian", dan link "Tambah Attempt Baru" tidak dirender.

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
- Full mock kembali ke `Attempt.currentSession`, yang dinaikkan submit sesi. Adanya row `AttemptAnswer` bukan lagi penanda sesi selesai karena jawaban disimpan otomatis sebelum submit — lihat [Exam](exam.md#simpan-otomatis-dan-lanjut-di-device-lain).
- Query tidak dicache agar attempt baru/selesai langsung terlihat.

## Keterbatasan Aktual

- Hanya mencakup `Attempt`; `PracticeSession` latihan cepat tidak tampil.
- Tidak ada pagination, filter level/status/mode, search, delete, atau abandon.
- Status `ABANDONED` tidak memiliki treatment khusus: badge non-completed tampak seperti sedang dikerjakan, tetapi tombol resume hanya dirender untuk `IN_PROGRESS`.
- Tidak ada ringkasan score langsung pada card history.

## File Utama

- `src/features/history/actions.ts`
- `src/app/(dashboard)/history/page.tsx`

