# Modul Article

## Status Aktual

**Selesai sebagai modul artikel publik berbasis seed.** Index, search, detail, related content, structured body, generated cover, SEO, save/favorite, dan view tracking tersedia.

## Route

- `/article`
- `/article/search`
- `/article/[slug]`
- `/article/[slug]/cover`

## Fitur Aktif

- Satu featured article dan hingga enam artikel terbaru selain featured.
- Search pada title, excerpt, body text, dan author.
- Filter kategori dan multi-tag.
- Sort newest, oldest, popular, dan most liked.
- Cursor pagination delapan artikel per halaman.
- Structured body untuk heading, paragraph, list, quote, example, dan callout.
- Related article dari kategori yang sama dengan fallback global.
- Share via Web Share API atau copy URL.
- User login dapat save dan favorite.
- View count bertambah sekali pada first view tiap akun.
- Canonical, Open Graph, Twitter card, sitemap, robots, dan generated cover tersedia.

## Data Aktual

- 6 artikel published.
- 16 tag.
- 1 artikel featured.
- Dengan isi database saat audit, index aktual menampilkan 1 featured dan 5 artikel lain pada bagian terbaru.
- Content dikelola melalui JSON fixture dan `npm run seed:articles`, bukan CMS.

## Caching

- Index/detail/facet/sitemap dicache global sekitar satu jam.
- Search dicache sekitar 30 menit.
- State saved/favorited dibaca per session dan tidak masuk cache global.
- Favorite/view pertama menginvalidasi list dan detail terkait.

## Keterbatasan Aktual

- Belum ada admin/CMS, editor, preview draft, revision history, scheduled publishing UI, atau moderation workflow.
- Fitur save tersedia, tetapi belum ada halaman "artikel tersimpan/favorit saya".
- View count hanya menghitung user login, bukan seluruh visitor unik.
- Seed selalu menerbitkan keenam fixture; enum `DRAFT`/`ARCHIVED` belum memiliki workflow UI.
- Search memakai `contains` database, belum memakai full-text search/ranking.
- Generated cover memakai font Arial pada image route dan bukan asset editorial yang diunggah.

## File Utama

- `src/features/article/queries.ts`
- `src/features/article/actions.ts`
- `src/features/article/schemas.ts`
- `src/features/article/components/article-body.tsx`
- `src/features/article/components/article-actions.tsx`
- `src/app/(public)/article/`
- `prisma/seed-articles.mjs`
