# Modul Dashboard

## Status Aktual

**Selesai dalam bentuk ringkasan sederhana.** Dashboard memakai data attempt user nyata untuk dua KPI, sedangkan empat kartu learning hub adalah shortcut statis ke modul lain.

## Feature Flag

Dashboard tidak punya flag sendiri dan selalu tersedia bagi user login. Isinya mengikuti flag modul lain:

- Kartu learning hub (Kana Lab, Flashcard Deck, Latihan Cepat, Mock Test Penuh) hanya dirender untuk modul yang aktif; section "Pusat Latihan" hilang bila keempatnya mati.
- `FEATURES_TEST_PACKAGE=false`: kartu "Total Selesai" dan "Attempt Terakhir", tombol "Pilih Paket Ujian", dan link "Lihat Semua Paket" tidak dirender; subjudul hero memakai copy tanpa paket ujian.
- `FEATURES_HISTORY=false`: tombol "Lihat Riwayat" tidak dirender.
- Menu sidebar History, Progress, Analytics, Flashcard, Percakapan, dan Bicara mengikuti flag masing-masing.

## Route

- `/dashboard`

## Data yang Ditampilkan

- Jumlah semua `Attempt` berstatus `COMPLETED` milik user.
- Attempt completed terbaru beserta paket, level, mode, dan tanggal.
- Link menuju result terakhir, history, test package, kana, vocabulary, dan latihan cepat.

## Caching

- Summary dicache per user memakai `unstable_cache`.
- Cache diinvalidasi saat attempt selesai; practice juga memanggil tag yang sama walaupun KPI dashboard saat ini tidak membaca practice.

## Keterbatasan Aktual

- Label "Attempt Mock Test" menghitung semua attempt completed, termasuk latihan per seksi.
- Dashboard belum menampilkan due vocabulary, progress kana, latihan cepat terakhir, streak, rekomendasi, atau kelemahan utama.
- Deskripsi kartu learning hub bersifat marketing/statis dan tidak menyesuaikan ketersediaan data live.
- Copy "ribuan kosakata" baru akurat setelah katalog flashcard diisi (6.697 kata siap digenerate,
  lihat [Flashcard](flashcard.md)).
- Tidak ada grafik atau aktivitas terbaru; detail tersebut berada di Progress dan Analytics.

## File Utama

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/features/dashboard/actions.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/components/app-sidebar.tsx`
