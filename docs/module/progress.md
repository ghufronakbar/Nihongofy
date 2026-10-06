# Modul Progress dan Export

## Status Aktual

**Selesai untuk pelacakan skor attempt.** Progress mempertahankan satu row per attempt agar perubahan hasil dari waktu ke waktu dapat dibandingkan, lalu menyediakan export XLSX (di browser) dan report PDF (dirender di server).

## Feature Flag

`FEATURES_PROGRESS` (default `true`). Saat `false`, `/progress` mengembalikan 404 lewat guard `src/app/(dashboard)/progress/layout.tsx` dan menu Progress di sidebar tidak dirender.

Flag ini tidak bergantung pada `FEATURES_TEST_PACKAGE`. Bila test package mati, tabel dan export tetap tersedia, tetapi nama paket tampil sebagai teks biasa (bukan link ke result) dan CTA "Mulai Ujian Pertama" pada empty state tidak dirender.

## Route

- `/progress`
- `GET /api/progress/report?level=N5` — unduh report PDF satu level (butuh session; 400 untuk level tidak valid, 404 bila belum ada attempt di level itu)

## Data dan Tampilan

- Hanya `Attempt` berstatus `COMPLETED` milik user.
- Dikelompokkan per JLPT level.
- Tabel memuat paket, tanggal, akurasi tiap mondai, skor per section, skor berbobot, dan total.
- Latihan satu section tetap muncul, tetapi hanya mengisi section yang memiliki data.
- Ambang visual: di bawah 60% dianggap lemah, minimal 80% dianggap kuat.

## Export

- XLSX dibuat client-side dengan `xlsx`, nama file `progress-<level>.xlsx`, mencerminkan tabel tab level yang sedang dipilih.
- Report PDF dirender di server dengan `@react-pdf/renderer` (route di atas), nama file `nihongofy-progress-<level>-<YYYY-MM-DD>.pdf`. Tombol di tab mengunduhnya lewat `fetch` + blob dengan status loading dan toast error.
  - Font **Noto Sans JP** Regular/Bold (OFL, `assets/fonts/`, ±5,7 MB per file) di-embed dan otomatis di-subset per glyph, jadi kanji/kana tampil dan PDF hasil tetap kecil (±50 KB). File font dibaca lewat `fs`, sehingga di-include eksplisit ke function route lewat `outputFileTracingIncludes` di `next.config.ts`.
  - Isi (A4, 3 halaman untuk data biasa; tabel panjang mengalir ke halaman berikutnya): (1) header nama/periode/tanggal cetak, kartu skor terakhir/terbaik/perubahan, ringkasan otomatis, grafik tren skor total /180 per mock lengkap dengan garis & area di bawah batas lulus resmi (`JLPT_PASS_MARK`); (2) ringkasan per seksi (terakhir, rata-rata, terbaik, terendah + rentang), 3 mondai prioritas (< 80%), batang akurasi semua mondai beserta perubahan awal→akhir; (3) tabel per attempt, matriks akurasi mondai × attempt (10 attempt terakhir), dan catatan metodologi.
  - Data disusun oleh `buildProgressReport()` (`lib/report-data.ts`, murni dan dites). Grafik total dan batas lulus hanya memakai attempt bernilai maksimal 180; latihan per seksi tetap masuk tabel, ringkasan seksi, dan analisis mondai.

## Kondisi Skor

- Skor asli adalah normalisasi linier ke 60 per section.
- Skor berbobot memakai bobot kesulitan mondai statis.
- Keduanya adalah proyeksi aplikasi, bukan hasil resmi JLPT.

## Keterbatasan Aktual

- Database development saat audit belum memiliki `Attempt`, sehingga halaman aktual masih menampilkan empty state.
- Tampilan yang sudah diimplementasikan hanya tabel; belum ada grafik walaupun copy empty-state menyebut grafik akan muncul setelah mock test selesai.
- Report PDF belum mengikuti filter tanggal; selalu memuat seluruh attempt level itu.
- Dependency `xlsx` yang dipakai untuk export memiliki laporan kerentanan high tanpa perbaikan resmi pada versi npm saat ini; project mempertahankannya berdasarkan keputusan yang tercatat di `docs/plan.md`.
- Export XLSX belum mengandung metadata user, catatan metodologi, atau grafik (report PDF sudah).
- Progress tidak memasukkan latihan cepat, kana, dan vocabulary.
- Tidak ada pagination; seluruh completed attempt user dimuat sekaligus.
- Cache Progress per user tidak memiliki TTL eksplisit dan berbagi tag invalidasi Analytics karena sumber datanya sama.

## File Utama

- `src/features/progress/actions.ts`
- `src/features/progress/components/progress-tabs.tsx`
- `src/features/progress/components/progress-export-buttons.tsx`
- `src/features/progress/lib/export.ts`
- `src/features/progress/lib/report-data.ts`
- `src/features/progress/report/progress-report-document.tsx`
- `src/app/api/progress/report/route.ts`
- `src/app/(dashboard)/progress/page.tsx`
