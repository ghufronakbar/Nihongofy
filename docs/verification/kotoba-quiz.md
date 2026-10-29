# Tebak Kotoba Minna no Nihongo — verifikasi 29 Oktober 2026

## Implementasi

- Route publik `/kana/kotoba` (opsional `?bab=1`–`?bab=5`), CTA "Tebak Kotoba" di hero halaman hiragana/katakana, dan entri sitemap. Route mengikuti `FEATURES.kana` dari layout induk; tidak ada flag baru.
- 253 kosakata Bab 1–5 ditranskripsi dari "Kosakata minna no nihongo 1 Bab 1-25.pdf". Teks PDF memakai encoding font rusak, sehingga transkripsi dibaca dari render halaman 1–9 dan koreksinya dicatat di kepala `src/features/kana/kotoba/data.ts`.
- Pengaturan: nickname, satu atau beberapa bab, depan kartu kana atau kanji, dan 10/20/semua soal. Depan kartu menampilkan kata; setelah memilih satu dari empat arti, kartu dibalik ke bagian belakang lengkap (kana, kanji, arti, catatan, TTS).
- Hasil: skor, akurasi, waktu, rincian per bab, daftar kata salah, tabel jawaban, "Ulangi N kata ini", dan "Main lagi". Tidak ada perubahan database atau action.

## Pemeriksaan otomatis

- `npx vitest run src/features/kana/`: **26 lulus** (15 baru untuk Tebak Kotoba). Menguji jumlah kata per bab, key unik, referensi grup, konflik untuk arti/tulisan depan yang sama, fallback kanji → kana, cakupan setiap kata per bab dengan empat pilihan tanpa konflik (8 putaran acak per bab), prioritas pengecoh sejenis, batas jumlah soal dan gabungan bab, ulang kata tertentu, penguncian jawaban, waktu baca tidak dihitung, hasil per bab, restore saat kartu belakang terbuka, serta snapshot rusak.
- `npm test -- --maxWorkers=2`: **62 file, 776 tes lulus**.
- `npm run lint` dan `npm run typecheck`: lulus.
- `next build` (env dummy, tanpa database): kompilasi dan TypeScript lulus; build berhenti saat prerender `/sitemap.xml` karena `prisma.article.findMany()` tidak dapat menjangkau database. Kegagalan ini berasal dari lingkungan verifikasi, bukan dari route baru. Build produksi penuh perlu dikonfirmasi di CI/Vercel.
- Dependency `xlsx` (cdn.sheetjs.com) diblokir jaringan lingkungan verifikasi; untuk pemeriksaan lokal dipasang `xlsx@0.18.5` dari npm tanpa mengubah `package.json`/lockfile.

## Pemeriksaan tampilan

- Chromium (Playwright) desktop 1280 px: validasi nickname kosong, pilih Bab 1 + 2, depan kanji, 10 soal; jawab dengan keyboard 1–4, lanjut dengan Enter, refresh di soal ke-4 memulihkan kartu belakang yang sedang terbuka, halaman hasil tampil, dan "Ulangi 7 kata ini" membuka sesi 7 soal. Tidak ada error konsol atau page error.
- Viewport 390 px: form, kartu depan/belakang, dan pilihan tampil tanpa scroll horizontal (`scrollWidth` 390).
- Contoh tampilan: [kartu belakang desktop](evidence/2026-10-29-kotoba-quiz-back.png) dan [kartu belakang HP](evidence/2026-10-29-kotoba-quiz-mobile.png).

## Batas verifikasi

- Arti dan catatan perlu ditinjau pengajar, terutama kata yang dikoreksi dari PDF (きょうし, はじめまして, そちら Bab 4, びじゅつかん, ほんのきもちです).
- TTS bergantung pada voice browser; belum diuji di perangkat nyata.
- UAT lanjutan: selesaikan satu bab penuh di HP dan desktop, uji mode kanji untuk Bab 4–5, dan uji tombol Dengar di perangkat yang memiliki voice Jepang.

## Tambahan: opsi lewati (29 Oktober 2026)

- `npx vitest run src/features/kana/`: **27 lulus**, termasuk tes lewati: kunci dibuka tanpa pilihan, tidak bisa melewati kata yang bukan soal aktif atau dua kali, snapshot dengan `selectedKey: null` dipulihkan, serta hasil menghitung benar/dilewati dan memasukkan kata dilewati ke daftar ulang.
- Chromium desktop, Bab 4, 10 soal: satu kata dilewati lewat tombol dan satu lewat keyboard `L`; kartu belakang berwarna kuning dengan label "Dilewati", hasil menampilkan Salah 5 dan Dilewati 2, dan "Ulangi 7 kata ini" mencakup keduanya. Tidak ada error konsol.

