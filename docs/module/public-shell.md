# Modul Public Shell dan Home

## Status Aktual

**Selesai.** Aplikasi memiliki layout publik, header responsif, footer, metadata, sitemap, robots, dan landing page yang membaca status session serta artikel featured nyata dari database.

## Route

- `/`
- Layout bersama untuk route group `(public)`, termasuk home, article, kana, flashcard, exercises, test-package, exam, result, conversation, dan speaking.

## Fitur Aktif

- Header desktop/mobile menuju Kana, Flashcard, Bunpou, Latihan Cepat, Mock JLPT, Artikel, Percakapan, dan Bicara, masing-masing hanya bila flag modulnya aktif.
- CTA berubah antara login/register dan dashboard/test package berdasarkan session.
- Landing page menampilkan kartu kana, flashcard, latihan cepat, dan mock JLPT untuk modul yang aktif, serta section conversation dan speaking bila flag-nya aktif.
- Featured article berasal dari query artikel published, dengan empty state jika database kosong.
- Metadata Open Graph dasar tersedia.

## Feature Flag

Public shell tidak punya flag sendiri, tetapi menjadi tempat utama flag modul diterapkan:

| Bagian | Perilaku saat flag modul `false` |
|---|---|
| Header dan footer | Menu modul tidak dirender |
| Home: hero | Tanpa `FEATURES_TEST_PACKAGE`, kicker, subjudul, dan CTA memakai copy tanpa mock test |
| Home: "Cara belajar" | Tidak dirender bila `FEATURES_TEST_PACKAGE=false` |
| Home: kartu modul | Kartu modul yang mati tidak dirender; kartu tersisa dibagi rata di grid, dan judul serta intro menyebut jumlah dan nama modul yang aktif. Section hilang bila keempatnya mati |
| Home: conversation/speaking | Section tidak dirender |
| Home: artikel | Section tidak dirender dan query artikel dilewati |
| Halaman 404 | Tombol "Cari paket JLPT" hilang tanpa `FEATURES_TEST_PACKAGE` |
| Sitemap dan robots | Path modul yang mati tidak dimasukkan |

Route milik modul yang mati mengembalikan 404 lewat `layout.tsx` guard di segmen masing-masing; `src/proxy.ts` tidak ikut memeriksa flag. Daftar lengkap key ada di [index](index.md#feature-flag).

## Data dan Persistence

- Session dibaca dari cookie JWT melalui `getSession()`.
- Featured article berasal dari PostgreSQL/Prisma dan global cache artikel.
- Preview kartu, alur belajar, conversation, dan speaking pada home adalah komposisi UI statis.
- Status modul dibaca dari objek `FEATURES` (`src/constants/index.ts`) di server lalu diteruskan ke header sebagai props bertipe `FeatureFlags`.

## Kondisi Mock atau Belum Jadi

- Section **conversation** dan **speaking** hanya dirender bila flag-nya aktif, dengan label "Versi awal"; copy provider mock tetap menyebut balasan belum dari AI.
- Preview hasil review dan contoh kartu pada hero tidak berasal dari attempt user.
- Copy landing yang menyebut vocabulary besar belum sebanding dengan database sekarang yang hanya berisi 32 kartu.

## Keterbatasan

- Tidak ada halaman publik khusus overview product selain home.
- Sitemap memuat home, test package, latihan cepat, kana, flashcard, bunpou (katalog, tiap pola, dan tiap perbandingan), dan artikel untuk modul yang aktif. `robots.ts` hanya meng-`allow` path modul aktif; route akun, exam, result, conversation, dan speaking selalu di-`disallow`.
- `robots.txt` dan `sitemap.xml` di-prerender saat build, sehingga perubahan flag baru tercermin di keduanya setelah redeploy.
- Header publik tidak menyediakan shortcut langsung ke history/progress/analytics; aksesnya melalui dashboard.
- Routing tidak mewajibkan login untuk prefix belajar/exam/result. Proteksi akun dan ownership diterapkan secara selektif di page/action terkait; mode guest memang tersedia pada beberapa modul.
- Sidebar dashboard hanya tersedia pada `/dashboard`, `/history`, `/progress`, `/analytics`, dan `/profile`; modul belajar serta exam tetap memakai public shell.

## File Utama

- `src/app/(public)/page.tsx`
- `src/app/(public)/layout.tsx`
- `src/components/marketing/public-header.tsx`
- `src/components/marketing/public-footer.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/proxy.ts`
