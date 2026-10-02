# Modul Public Shell dan Home

## Status Aktual

**Selesai.** Aplikasi memiliki layout publik, header responsif, footer, metadata, sitemap, robots, dan landing page yang membaca status session serta artikel featured nyata dari database.

## Route

- `/`
- `/privacy` (Kebijakan Privasi) dan `/terms` (Syarat & Ketentuan) — lihat [Dokumen Hukum](#dokumen-hukum).
- Layout bersama untuk route group `(public)`, termasuk home, article, kana, flashcard, exercises, test-package, exam, result, conversation, dan speaking.

## Fitur Aktif

- Header desktop/mobile menuju Kana, Flashcard, Bunpou, Latihan Cepat, Mock JLPT, Artikel, Percakapan, dan Bicara, masing-masing hanya bila flag modulnya aktif.
- CTA berubah antara login/register dan dashboard/test package berdasarkan session.
- Landing page menampilkan kartu kana, flashcard, bunpou, latihan cepat, dan mock JLPT untuk modul yang aktif, serta section conversation dan speaking bila flag-nya aktif.
- Featured article berasal dari query artikel published, dengan empty state jika database kosong.
- Metadata Open Graph dasar tersedia.
- Footer menautkan Kebijakan Privasi dan Syarat & Ketentuan tanpa syarat flag.

## Feature Flag

Public shell tidak punya flag sendiri, tetapi menjadi tempat utama flag modul diterapkan:

| Bagian | Perilaku saat flag modul `false` |
|---|---|
| Header dan footer | Menu modul tidak dirender |
| Home: hero | Tanpa `FEATURES_TEST_PACKAGE`, kicker, subjudul, dan CTA memakai copy tanpa mock test |
| Home: "Cara belajar" | Tidak dirender bila `FEATURES_TEST_PACKAGE=false` |
| Home: kartu modul | Kartu modul yang mati tidak dirender. Lima kartu tersusun 5/7, 12 (bunpou), 7/5; empat kartu 5/7/7/5; selebihnya dibagi rata di grid. Judul serta intro menyebut jumlah dan nama modul yang aktif. Section hilang bila kelimanya mati |
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
- Sitemap memuat home, `/privacy`, `/terms`, test package, latihan cepat, kana, flashcard, bunpou (katalog, tiap pola, dan tiap perbandingan), dan artikel untuk modul yang aktif. `robots.ts` meng-`allow` `/privacy` dan `/terms` tanpa syarat, selebihnya hanya path modul aktif; route akun, exam, result, conversation, dan speaking selalu di-`disallow`. Diskusi (`/discussion`, `/flashcard/discussion`, dan diskusi di halaman pola) diindeks sejak 2 Oktober 2026; halaman diskusi tanpa entri diberi `noindex`.
- `robots.txt` dan `sitemap.xml` di-prerender saat build, sehingga perubahan flag baru tercermin di keduanya setelah redeploy.
- Header publik tidak menyediakan shortcut langsung ke history/progress/analytics; aksesnya melalui dashboard.
- Routing tidak mewajibkan login untuk prefix belajar/exam/result. Proteksi akun dan ownership diterapkan secara selektif di page/action terkait; mode guest memang tersedia pada beberapa modul.
- Sidebar dashboard hanya tersedia pada `/dashboard`, `/history`, `/progress`, `/analytics`, dan `/profile`; modul belajar serta exam tetap memakai public shell.

## Dokumen Hukum

Kebijakan Privasi (`/privacy`) dan Syarat & Ketentuan (`/terms`) ditambahkan 2 Oktober 2026.

- **Statis, di repo.** Isi ditulis sebagai TSX per bagian di `src/features/legal/content/`
  (`privacy-policy.tsx`, `terms.tsx`), bukan tabel database, seed, atau CMS artikel. Setiap file
  mengekspor `VERSION`, `LAST_UPDATED`, dan `EFFECTIVE_DATE` yang tampil di kepala halaman.
  Riwayat perubahan cukup lewat git; naikkan `VERSION` setiap kali isinya berubah berarti.
- **Tanpa flag dan tanpa query.** Halaman memakai `export const dynamic = "force-static"` sehingga
  di-prerender saat build (○ di output build). Konsekuensinya `cookies()` di layout `(public)`
  kosong, jadi header di kedua halaman selalu tampil sebagai tamu (tombol Masuk, bukan Dashboard).
- **Isian yang belum diketahui** (nama pengelola, email kontak, alamat, usia minimum, region
  Supabase, penyedia SMTP dan AI) dikumpulkan di `LEGAL_FACTS` (`src/features/legal/constants.ts`)
  dengan awalan `[[ISI:` dan dirender sebagai penanda merah. Tanggal berlaku ada di masing-masing
  file konten. Jangan deploy ke publik selama masih ada `[[ISI:`.
- **Akurat terhadap kode.** Setiap klaim kebijakan merujuk alur data yang ada (cookie, retensi,
  pemroses, anonimisasi). Saat menambah cookie, pemroses, atau aturan retensi baru, perbarui
  dokumen ini di commit yang sama.
- Ditautkan dari footer publik, `/profile/privacy`, form daftar, dan dekat tombol Google di login
  serta register (`LegalConsentNotice`, tautan dibuka di tab baru agar isian form tidak hilang).

## File Utama

- `src/app/(public)/page.tsx`
- `src/app/(public)/layout.tsx`
- `src/components/marketing/public-header.tsx`
- `src/components/marketing/public-footer.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/app/(public)/privacy/page.tsx`, `src/app/(public)/terms/page.tsx`
- `src/features/legal/` — konten, `LEGAL_FACTS`, `LegalDocumentView`, `LegalConsentNotice`
- `src/proxy.ts`
