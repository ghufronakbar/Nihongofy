# Modul Paket Tes dan Bank Soal

## Status Aktual

**Fungsional, tetapi isi database development belum selengkap fixture repository.** Listing, detail, mode baca, riwayat per paket, guest start, dan pembuatan attempt sudah aktif.

## Route

- `/test-package`
- `/test-package/[id]`
- `/test-package/[id]/questions`

## Fitur Aktif

- Listing paket dikelompokkan per level.
- Detail menampilkan section yang tersedia, durasi resmi per session sebagai referensi, dan history attempt user.
- User dapat memilih full mock atau latihan satu section.
- Guest dapat mulai tanpa membuat row `Attempt`.
- Mode baca menampilkan seluruh soal, kunci, explanation bila ada, furigana, audio/image, copy question, dan comment user login.
- Query content global dicache, sedangkan attempt/comment user dibaca terpisah agar tidak bocor lintas akun.

## Struktur Data

- `TestPackage` -> `TestPackageItem` per mondai -> `Question` -> `QuestionChoice`.
- `QuestionContext` menyimpan stimulus bersama seperti bacaan, image, atau audio.
- Kunci memakai `codeAnswer` 1-4, bukan ID choice.
- Konten diisi melalui JSON fixture dan script import; tidak ada admin UI.

## Data Aktual

- Repository: 50 fixture valid dan 5.028 soal lintas N1-N5.
- Database development: 31 paket dan 3.159 soal, hanya N2, N3, N4.
- Hanya 20 soal database yang memiliki explanation.
- Database menyimpan 147 context audio, 83 question image, 1 context image, dan tidak memiliki question-level audio.

## Keterbatasan dan Isu Aktual

- Label jumlah pada detail memakai `testPackageItems.length` tetapi ditampilkan sebagai "SESI UJIAN"; angka tersebut sebenarnya jumlah blok mondai, bukan jumlah session unik.
- Tombol lanjut pada history per paket selalu menuju session 1; halaman History global memiliki resolver resume yang lebih akurat.
- Copy "pembahasan lengkap" belum sesuai dengan database karena hanya 20 dari 3.159 soal memiliki explanation.
- Mode baca bersifat publik dan sengaja membuka kunci/explanation karena bukan mode pengerjaan.
- Belum ada indikator kualitas/kelengkapan per paket, misalnya persentase explanation atau media yang tersedia.
- Tidak ada pencarian/filter tahun, bulan, atau level selain grouping visual.
- Cache content tidak otomatis berubah hanya karena fixture file berubah; database harus di-seed dan cache harus direvalidasi/restart sesuai deployment.

## File Utama

- `src/features/test-package/actions.ts`
- `src/features/test-package/components/start-attempt-actions.tsx`
- `src/app/(public)/test-package/page.tsx`
- `src/app/(public)/test-package/[id]/page.tsx`
- `src/app/(public)/test-package/[id]/questions/page.tsx`
- `src/test-package-data/`
