# Modul Progress dan Export

## Status Aktual

**Selesai untuk pelacakan skor attempt.** Progress mempertahankan satu row per attempt agar perubahan hasil dari waktu ke waktu dapat dibandingkan, lalu menyediakan export XLSX dan PDF di browser.

## Route

- `/progress`

## Data dan Tampilan

- Hanya `Attempt` berstatus `COMPLETED` milik user.
- Dikelompokkan per JLPT level.
- Tabel memuat paket, tanggal, akurasi tiap mondai, skor per section, skor berbobot, dan total.
- Latihan satu section tetap muncul, tetapi hanya mengisi section yang memiliki data.
- Ambang visual: di bawah 60% dianggap lemah, minimal 80% dianggap kuat.

## Export

- XLSX dibuat client-side dengan `xlsx`.
- PDF dibuat client-side dengan `jsPDF` dan `jspdf-autotable`.
- Nama file mengikuti `progress-<level>.xlsx|pdf`.
- Export mencerminkan data tab level yang sedang dipilih.

## Kondisi Skor

- Skor asli adalah normalisasi linier ke 60 per section.
- Skor berbobot memakai bobot kesulitan mondai statis.
- Keduanya adalah proyeksi aplikasi, bukan hasil resmi JLPT.

## Keterbatasan Aktual

- Database development saat audit belum memiliki `Attempt`, sehingga halaman aktual masih menampilkan empty state.
- Tampilan yang sudah diimplementasikan hanya tabel; belum ada grafik walaupun copy empty-state menyebut grafik akan muncul setelah mock test selesai.
- PDF memakai font bawaan Latin-1; karakter Jepang pada nama paket dibuang agar tidak menjadi mojibake.
- Dependency `xlsx` yang dipakai untuk export memiliki laporan kerentanan high tanpa perbaikan resmi pada versi npm saat ini; project mempertahankannya berdasarkan keputusan yang tercatat di `docs/plan.md`.
- Export belum mengandung metadata user, filter tanggal, catatan metodologi lengkap, atau grafik.
- Progress tidak memasukkan latihan cepat, kana, dan vocabulary.
- Tidak ada pagination; seluruh completed attempt user dimuat sekaligus.
- Cache Progress per user tidak memiliki TTL eksplisit dan berbagi tag invalidasi Analytics karena sumber datanya sama.

## File Utama

- `src/features/progress/actions.ts`
- `src/features/progress/components/progress-tabs.tsx`
- `src/features/progress/components/progress-export-buttons.tsx`
- `src/features/progress/lib/export.ts`
- `src/app/(dashboard)/progress/page.tsx`
