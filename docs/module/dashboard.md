# Modul Dashboard

## Status Aktual

**Selesai dalam bentuk ringkasan sederhana.** Dashboard memakai data attempt user nyata untuk dua KPI, sedangkan empat kartu learning hub adalah shortcut statis ke modul lain.

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
- Copy "ribuan kosakata" belum sesuai dengan database yang baru memiliki 32 flashcard.
- Tidak ada grafik atau aktivitas terbaru; detail tersebut berada di Progress dan Analytics.

## File Utama

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/features/dashboard/actions.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/components/app-sidebar.tsx`
