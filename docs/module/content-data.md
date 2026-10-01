# Modul Content Data dan Seeding

## Status Aktual

**Infrastruktur import aktif; sebagian sudah punya admin UI.** Bank soal dan artikel dapat dikelola dari `/admin` maupun script seed — keduanya berbagi jalur kode yang sama, jadi tidak dapat menyimpang. Pembahasan dan deck bawaan masih lewat script seed saja.

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

## Kosakata flashcard

- Katalog kosakata bawaan diisi lewat tiga langkah: daftar kata dari `.apkg` (`flashcard:extract`),
  isi kartu oleh AI (`gen:flashcard`), lalu `seed:flashcard`. Kontraknya di
  [seed-flashcard.md](../seed-flashcard.md).
- Daftar kata sumber: 6.697 kata N5-N1. Isi kartu belum digenerate saat perombakan
  1 Oktober 2026.
- Deck bawaan dibentuk dari tag taxonomy (`src/flashcard-data/taxonomy.json`), bukan disimpan
  per deck. Satu kata bisa ada di beberapa deck dengan satu progres.
- Seed tidak pernah menghapus kata: kata yang hilang dari fixture diberi `retiredAt`, sehingga
  progres user tetap aman.

## Artikel

- Fixture berisi 6 artikel dan seed selalu menyimpannya sebagai `PUBLISHED`.
- `bodyText` diturunkan dari structured body untuk kebutuhan search.
- Cover memakai route generated image lokal `/article/[slug]/cover`, bukan file raster statis.
- Seed tidak mereset `viewCount`, `favoriteCount`, atau interaction user.

## Keterbatasan dan Risiko

- Katalog flashcard hanya bisa diubah lewat fixture dan seed; editor admin-nya sudah dihapus.
- Pembuatan pembahasan tetap lewat `npm run gen:explanation` karena generator menulis ke file
  fixture di repository, bukan ke database. Peninjauan dan persetujuannya sudah ada di
  `/admin/explanation`.
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
