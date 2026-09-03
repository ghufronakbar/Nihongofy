# Fase 5 - Artikel Publik

Tanggal selesai: 26 Agustus 2026

## Hasil

Fase 5 menambahkan area bacaan publik yang mengikuti visual neo-brutalist `reference_ui_web`
tanpa memindahkan kelemahan implementasi referensi seperti HTML mentah, data acak, atau state
akun di browser.

- `/article` menampilkan hero pencarian, artikel pilihan, daftar terbaru, tag, dan kategori.
- `/article/search` mendukung query, kategori, multi-tag, empat mode urutan, URL params,
  empty state, dan cursor pagination server-side.
- `/article/[slug]` menampilkan cover, metadata, body terstruktur, penulis, tag, related article,
  save, favorite, penghitung pembaca akun, dan native share dengan copy fallback.
- Home memakai artikel pilihan nyata dan tetap memiliki empty state bila belum ada artikel terbit.
- Header/footer publik, mobile navigation, loading state, dan not-found state mencakup route artikel.

## Konten dan Rendering

- Enam artikel awal dan 16 tag disimpan pada fixture terkurasi
  `src/features/article/data/article-seed.json`.
- `npm run seed:articles` melakukan upsert berdasarkan slug dan aman dijalankan ulang.
- Body artikel disimpan sebagai blok JSON tervalidasi Zod: heading, paragraph, list, quote,
  example, dan callout.
- Renderer tidak memakai `dangerouslySetInnerHTML`, Markdown runtime, atau sanitizer tambahan.
- `bodyText` menyimpan representasi teks untuk pencarian server-side.
- Cover dibuat oleh `ImageResponse` project pada `/article/[slug]/cover` dan dirender melalui
  `next/image`; tidak ada hotlink aset eksternal.

## Database

Migration: `prisma/migrations/20260826131225_phase_5_public_articles/`.

Model baru:

- `Article`: content, status publish, kategori, cover, tanggal, read time, dan counter publik.
- `ArticleTag`: kamus tag berdasarkan stable slug.
- `ArticleTagLink`: relasi many-to-many artikel dan tag.
- `ArticleInteraction`: save, favorite, dan first-view per user dan artikel.

Constraint dan index:

- Unique slug artikel/tag, unique `(articleId, tagId)`, dan unique `(userId, articleId)`.
- Check slug/category slug, read time 1-60 menit, counter non-negatif, dan published article
  wajib memiliki `publishedAt`.
- Index untuk publish date, featured article, kategori, sort popular/favorite, seluruh foreign key,
  serta daftar save/favorite per user.

## Security dan Cache

- Seluruh mutation memvalidasi input dengan Zod dan mengambil user dari cookie session.
- `userId` tidak pernah diterima dari client; interaction selalu di-scope ke `session.userId`.
- Session yang masih valid secara kriptografis tetapi user-nya sudah terhapus dibersihkan dan
  mendapat pesan login ulang, bukan dianggap artikel hilang.
- RLS aktif pada empat tabel artikel tanpa client policy.
- Grant tabel dan sequence dicabut dari `anon`, `authenticated`, dan `service_role` karena akses
  aplikasi hanya melalui Prisma server-side.
- Cache list, facets, search, detail, cover, dan sitemap memakai key/tag terpusat.
- State save/favorite user tidak masuk cache publik.
- Nilai tanggal dari cache dihidupkan kembali menjadi `Date` pada query boundary agar metadata
  dan formatter tetap aman setelah cache dipersist atau server reload.

## SEO

- Metadata per slug mencakup title, description, author, canonical, Open Graph, dan Twitter card.
- `sitemap.xml` mencakup home, article index, dan seluruh artikel published.
- `robots.txt` mengizinkan content publik dan menutup auth, dashboard, exam, serta tool belajar
  protected.
- URL publik berasal dari `APP_URL` yang divalidasi di constants.

## Verifikasi

- Migration status current; seed menghasilkan 6 artikel, 16 tag, dan 18 article-tag links.
- Audit database mengonfirmasi RLS aktif dan tidak ada privilege Data API pada tabel/sequence.
- Uji dua user dalam transaction rollback menghasilkan user A melihat satu interaction,
  sedangkan user B melihat nol row dan update milik user B memengaruhi nol row.
- Browser desktop dan mobile 390x844 memverifikasi index, filter gabungan, detail, cover,
  save/favorite, empty search, not-found, mobile menu, focus ring tag, dan tanpa horizontal overflow.
- QA runtime menemukan lalu memperbaiki serialisasi tanggal cache yang tidak terlihat pada build.
- Console browser bersih setelah perbaikan dan warning style `ImageResponse` dihapus.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx prisma migrate status`, dan
  `git diff --check` menjadi final gate.
