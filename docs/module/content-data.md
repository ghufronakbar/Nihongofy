# Modul Content Data dan Seeding

## Status Aktual

**Infrastruktur import aktif, tetapi source fixture dan database development belum sinkron penuh.** Bank soal, vocabulary, dan artikel tidak memiliki admin UI; konten masuk melalui fixture dan script seed.

## Sumber Data

| Domain | Source | Import |
|---|---|---|
| Bank soal | `src/test-package-data/*.json` | `npm run seed:test-package` |
| Vocabulary | `src/features/vocabulary/data/vocabulary-seed.json` | `npm run seed:learning` |
| Artikel | `src/features/article/data/article-seed.json` | `npm run seed:articles` |

## Bank Soal

- Tersedia 50 file fixture yang lolos `npm run seed:test-package:check`.
- Total fixture adalah 5.028 soal: N1 13 paket, N2 14, N3 10, N4 8, dan N5 5.
- Import memvalidasi enum, session/section, order, pilihan jawaban, context reference, dan constraint struktur sebelum write.
- Satu package diimpor dalam transaksi; package parsial diblokir dan replacement ditolak jika sudah memiliki attempt.
- Database development saat audit baru berisi 31 paket dan 3.159 soal: N2 13, N3 10, dan N4 8.
- N1, N5, serta satu fixture N2 belum ada di database development, sehingga UI/runtime belum mencerminkan seluruh fixture repository.
- Hanya 20 soal database yang mempunyai `explanation`; mayoritas review hanya dapat menampilkan kunci tanpa pembahasan.

## Vocabulary

- Fixture berisi 32 kartu: mayoritas N5 dan satu kartu N4.
- Script membuat 6 deck yang saling overlap berdasarkan level/tag, bukan 6 kumpulan kartu independen.
- Semua deck di-seed sebagai published.
- `audioText` tersedia, tetapi `audioUrl` database masih kosong; playback mengandalkan browser TTS.
- Seed membangun ulang deck item dan tag link, tetapi progress user terhubung langsung ke `Flashcard` sehingga tidak ikut dihapus.

## Artikel

- Fixture berisi 6 artikel dan seed selalu menyimpannya sebagai `PUBLISHED`.
- `bodyText` diturunkan dari structured body untuk kebutuhan search.
- Cover memakai route generated image lokal `/article/[slug]/cover`, bukan file raster statis.
- Seed tidak mereset `viewCount`, `favoriteCount`, atau interaction user.

## Keterbatasan dan Risiko

- Tidak ada dashboard admin, workflow draft/review, atau editor konten.
- Status runtime sangat bergantung pada seed database yang terakhir dijalankan.
- Dokumentasi/marketing yang menyebut seluruh level tersedia bisa berbeda dari database environment tertentu.
- Kualitas OCR, underline rujukan, media, jawaban, dan explanation tetap membutuhkan kurasi manusia walaupun schema valid.
- Cache list/detail perlu diinvalidasi bila konten diubah di luar jalur aplikasi.

## File Utama

- `prisma/seed-test-package.mjs`
- `prisma/seed-learning.mjs`
- `prisma/seed-articles.mjs`
- `prisma/schema.prisma`
- `docs/seed.md`
- `docs/database.md`
