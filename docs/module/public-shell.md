# Modul Public Shell dan Home

## Status Aktual

**Selesai.** Aplikasi memiliki layout publik, header responsif, footer, metadata, sitemap, robots, dan landing page yang membaca status session serta artikel featured nyata dari database.

## Route

- `/`
- Layout bersama untuk route group `(public)`, termasuk home, article, kana, vocabulary, exercises, test-package, exam, dan result.

## Fitur Aktif

- Header desktop/mobile menuju Kana, Vocabulary, Latihan Cepat, Mock JLPT, dan Artikel.
- CTA berubah antara login/register dan dashboard/test package berdasarkan session.
- Landing page menampilkan empat modul aktif: kana, vocabulary, latihan cepat, dan mock JLPT.
- Featured article berasal dari query artikel published, dengan empty state jika database kosong.
- Metadata Open Graph dasar tersedia.

## Data dan Persistence

- Session dibaca dari cookie JWT melalui `getSession()`.
- Featured article berasal dari PostgreSQL/Prisma dan global cache artikel.
- Preview kartu, alur belajar, conversation, dan speaking pada home adalah komposisi UI statis.

## Kondisi Mock atau Belum Jadi

- Bagian **conversation** dan **speaking** hanya preview marketing; tidak ada route atau action yang dapat digunakan.
- Preview hasil review dan contoh kartu pada hero tidak berasal dari attempt user.
- Copy landing yang menyebut vocabulary besar belum sebanding dengan database sekarang yang hanya berisi 32 kartu.

## Keterbatasan

- Tidak ada halaman publik khusus overview product selain home.
- Sitemap hanya memasukkan home, index artikel, dan detail artikel; modul belajar sengaja tidak diindeks melalui `robots.ts`.
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
