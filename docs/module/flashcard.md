# Modul Flashcard (kosakata bawaan, penjadwalan ala Anki)

## Status Aktual

**Dirombak 1 Oktober 2026; kode dan katalog selesai (6.720 kata, 52 deck di database), flag
masih mati sampai uji manual.** Modul ini tidak lagi meniru Anki
sebagai aplikasi koleksi pribadi. Isinya kini satu katalog kosakata JLPT bawaan yang
digenerate AI, dan user hanya memilih deck lalu mengatur penjadwalan. Konten buatan user
(deck sendiri, tambah kartu, impor/ekspor CSV, card browser yang bisa mengedit, preset per
deck, editor deck bawaan di admin) sudah dihapus.

Yang masih perlu sebelum flag dinyalakan: uji manual di browser dengan data asli, lalu
`FEATURES_FLASHCARD=true` di Vercel (checklist di Fase 8.12 `docs/plan.md`).

Rancangan lama (paritas Anki penuh) tetap ada di
[`docs/plan/anki-parity-flashcard.md`](../plan/anki-parity-flashcard.md) sebagai riwayat.

## Feature Flag

`FEATURES_FLASHCARD` (default `true`). Saat `false`:

- Seluruh `/flashcard/*`, termasuk mode coba guest `/flashcard/try/*`, mengembalikan 404 lewat
  guard `src/app/(public)/flashcard/layout.tsx`.
- Menu Flashcard di header dan sidebar, kartu di home dan dashboard, serta quick action dan
  statistik "Kartu dipelajari" di profile tidak dirender.
- `/flashcard` keluar dari `sitemap.xml` dan `robots.txt`.
- Server Action flashcard tidak mengecek flag; tab lama yang masih terbuka tetap dapat
  memanggilnya.
- Kartu tidak dapat dilaporkan: tombol "Laporkan kartu" hanya ada di bawah `/flashcard`, dan
  `submitReportAction` (modul report, di luar segmen ini) mengecek flag ini sendiri untuk target
  `FLASHCARD_VOCAB`. Laporan kartu yang sudah masuk tetap dapat ditindak di `/admin/report`.

## Konsep

- **Katalog** (`FlashcardVocab`): satu baris per kata, diisi `npm run seed:flashcard` dari
  `src/flashcard-data/vocab/*.json`. Kata yang hilang dari fixture diberi `retiredAt`, tidak
  pernah dihapus, karena progres user merujuknya.
- **Satu kata = satu kartu per user** (`FlashcardCard`, primary key `userId + vocabId`). Baris
  kartu baru dibuat saat kata pertama kali disentuh (dijawab, ditunda, atau di-suspend). Kata
  tanpa baris adalah kartu baru.
- **Deck = tag.** Deck bawaan (`FlashcardDeck`) dibentuk dari tag taxonomy yang bertanda
  `deck: true`. Kata termasuk deck bila `tags`-nya memuat slug deck itu, sehingga 食事 bisa ada
  di "JLPT N5" sekaligus "Makanan & minuman". Progresnya satu: kata yang dipelajari di satu deck
  tidak muncul lagi sebagai kartu baru di deck lain.
- **Langganan** (`FlashcardDeckSubscription`): deck yang dipilih user. Melepas langganan tidak
  menghapus progres.
- Deck dengan kata kurang dari `deckMinNotes` (10) tidak ditampilkan; ini juga membuat deck
  topik yang kata-katanya belum digenerate tetap tersembunyi. Halaman deck, mode coba, belajar,
  dan tombol tambah deck memakai katalog yang sama, jadi deck tersembunyi tidak bisa dibuka
  atau ditambahkan lewat URL langsung.
- **Taxonomy** (`src/flashcard-data/taxonomy.json`) adalah satu-satunya daftar tag. Lima
  dimensi: level (diisi otomatis dari daftar kata), kelas kata, ragam bahasa, kategori, dan
  topik. Aplikasi, prompt AI, dan validator seed membaca file yang sama.

## Kartu

- **Sisi depan**: hanya tulisan kata tanpa furigana (`wordPlain`).
- **Sisi belakang**: kata dengan furigana, arti Indonesia (utama) dan Inggris, 1-2 contoh
  kalimat dengan kata target disorot, terjemahan ID/EN, catatan, dan tag (tanpa tag level).
- Semua teks Jepang memakai markup `parseJapaneseMarkup` (`{漢字|かな}`, `__target__`). Di
  flashcard, `__...__` dirender sebagai sorotan, bukan garis bawah 下線部.
- Pengaturan tampilan per user: **ukuran teks** (80-160%, default 100%) dan **furigana langsung
  di sisi belakang** (default aktif; bila mati, furigana disembunyikan dengan `visibility`
  dan muncul saat diketuk atau tombol `F`).

## Penjadwalan

- FSRS-6 lewat `ts-fsrs`, dengan fallback SM-2 saat FSRS dimatikan. Scheduler (`lib/scheduler/`)
  tidak berubah dari rancangan lama.
- **Satu pengaturan per user** (`FlashcardCollection.config`), berlaku untuk semua deck. Deck
  saling tumpang tindih, jadi batas harian per deck akan membuat jumlah kartu baru harian
  bergantung pada deck yang dibuka.
- Nilai bawaan mengikuti deck options Anki milik pemilik project:

  | Setting | Bawaan |
  |---|---|
  | Kartu baru per hari | 20 (semua deck sekaligus) |
  | Maksimum review per hari | 9999 |
  | Learning steps | `1m 2h 3h` |
  | Insertion order | Sequential |
  | Relearning steps | `1m 1h` |
  | New card gather order | Random cards |
  | New card sort order | Order gathered |
  | New/review order | Show after reviews |
  | Interday learning/review order | Show before reviews |
  | Review sort order | Descending retrievability |
  | FSRS | aktif |
  | Desired retention | 95% |

  Setting lain (parameter FSRS, setting SM-2, leech) tidak ditampilkan dan memakai default Anki.
  Setiap field di halaman pengaturan punya tombol ↺ ke nilai bawaannya.
- Urutan pengambilan antrean mengikuti scheduler v3 Anki: intraday learning → interday learning
  → review → new. Opsi urutan yang membedakan subdeck atau note bersaudara jatuh ke padanan
  terdekatnya, karena deck tidak punya subdeck dan satu kata hanya punya satu kartu.
- **Insertion order** dihitung, bukan disimpan: "sequential" mengikuti urutan katalog (level
  termudah dulu, lalu urutan daftar sumber), "random" memakai hash per user yang stabil.
  Mengganti opsi ini langsung berlaku untuk semua kartu baru, seperti di Anki.
- **Learn ahead 20 menit.** Kartu learning hanya tampil saat jatuh tempo (atau dalam 20 menit ke
  depan). Kartu dengan step 2 jam ditahan reviewer dan tampil tepat waktu dalam sesi yang sama;
  bila tidak ada kartu lain, reviewer menampilkan jam tampil berikutnya. Kode lama memasukkan
  semua kartu learning hari ini sekaligus, sehingga step jam tidak pernah dihormati.
- **Tunda** menyimpan `buriedUntil` (awal hari berikutnya), **suspend** menyimpan
  `isSuspended`. Keduanya tidak menimpa jadwal kartu, dan kartu tertunda muncul lagi tanpa job
  unbury.
- **Undo** memulihkan salinan kartu yang disimpan di `FlashcardRevlog.previousState`, sehingga
  keadaannya kembali persis (termasuk learning step). Hanya review terakhir sebuah kartu yang
  bisa dibatalkan.
- **Idempotency** lewat `clientToken` per user. Retry dengan token yang sudah tercatat
  mengembalikan hasil yang tersimpan, termasuk untuk kartu yang belum jatuh tempo lagi.
- Server menolak menjawab kartu yang di-suspend, ditunda, belum jatuh tempo, atau melewati batas
  kartu baru hari ini.
- Leech: setelah 8 lapse kartu diberi `isLeech` (default `tagOnly`).

## Halaman

| Route | Isi |
|---|---|
| `/flashcard` | Guest: katalog dengan tombol "Coba deck ini". Login: deck milik user dengan hitungan baru/belajar/ulang hari ini. |
| `/flashcard/add` | Katalog per Level JLPT, Topik, dan Kategori dengan tombol tambah/lepas. |
| `/flashcard/deck/[slug]` | Hitungan hari ini, tombol belajar, tambah/lepas deck, dan daftar kata read-only (pencarian kata/bacaan/arti, filter status, 50 per halaman, suspend, reset, dan laporkan per kata). |
| `/flashcard/deck/[slug]/study` | Reviewer. Hanya untuk deck yang sudah ditambahkan. Antrean dikirim per 200 kartu; tombol "Lanjutkan" membangun antrean berikutnya. |
| `/flashcard/settings` | Ukuran teks, furigana, dan penjadwalan. |
| `/flashcard/stats` | True retention, perkiraan 30 hari, riwayat review, sebaran interval, status kartu. |
| `/flashcard/try/[slug]` | Mode coba 20 kata pertama deck, selalu ephemeral. Guest boleh melaporkan kartu (dengan Turnstile). |

## Laporan Kartu

Isi kartu ditulis AI, jadi bisa saja ada yang salah. Kartu dilaporkan lewat
[modul report](report.md) dengan target `FLASHCARD_VOCAB`, yang menunjuk kata di katalog
(`vocabId`), bukan kartu milik user.

- Tombol "Laporkan kartu" ada di reviewer (hanya setelah sisi belakang dibuka), daftar kata
  `/flashcard/deck/[slug]`, dan mode coba guest. Dialognya sama dengan laporan soal dan terbuka di
  tempat; laporan tidak me-render ulang halaman, jadi sesi belajar tidak ter-reset, dan pintasan
  keyboard reviewer mati selama dialog terbuka.
- Kategori: bacaan/furigana salah, arti atau catatan keliru, contoh kalimat bermasalah, tag atau
  deck tidak cocok, ada yang error, dan lainnya. Alasan pemisahannya di
  [report.md](report.md#kategori-dibatasi-target).
- Kartu **tidak** diedit dari admin. `/admin/report` menampilkan isi kartu sekarang, level, dan
  key-nya beserta perintah perbaikan: sunting `content` di fixture atau
  `npm run gen:flashcard -- --key "<key>" --overwrite`, lalu `npm run seed:flashcard`. Bacaan kata
  yang keliru diselesaikan lewat peninjau kata ragu, karena bacaan itu bagian dari key.

## Pipeline Konten

Kontrak lengkapnya di [seed-flashcard.md](../seed-flashcard.md):

1. `npm run flashcard:extract` — daftar kata dari `data/anki/exported_anki.apkg` (file ini
   tidak di-commit).
2. `npm run gen:flashcard` — isi kartu oleh AI, hanya untuk kata yang belum terisi.
3. `npm run seed:flashcard` — fixture ke database.

## Perbedaan dari Anki yang Disengaja

- Tidak ada konten buatan user, custom card template, maupun impor `.apkg` oleh user.
- Satu pengaturan per user, bukan preset per deck; tidak ada tab "This deck" untuk desired
  retention.
- Satu template kartu (kata → arti), jadi tidak ada sibling burying.
- `FlashcardCard.due` timestamp absolut, bukan integer relatif `col.crt`.
- Learning steps dibatasi < 1 hari dan tanpa satuan detik, karena `ts-fsrs` merusak keduanya
  diam-diam (lihat komentar di `schemas.ts`).
- Tidak ada custom scheduling dan tidak ada optimizer parameter FSRS.
- Tidak ada audio.

## Yang Belum Ada

- Audio atau tombol dengar (TTS browser seperti modul kana bisa ditambahkan tanpa file).
- Halaman admin untuk meninjau kata bertanda ragu dari generator AI. Sementara memakai
  `npm run flashcard:doubts` dan `npm run fix:flashcard-doubts` di terminal, lalu seed ulang.

## File Utama

- `prisma/schema.prisma` — model `Flashcard*`
- `src/flashcard-data/taxonomy.json`, `src/flashcard-data/vocab/*.json`
- `prisma/flashcard-vocab.mjs`, `flashcard-anki.mjs`, `flashcard-vocab-prompt.mjs`,
  `japanese-markup-check.mjs`
- `prisma/extract-flashcard-anki.mjs`, `generate-flashcard-vocab.mjs`, `seed-flashcard.mjs`,
  `report-flashcard-doubts.mjs`
- `src/features/flashcard/data.ts` — query katalog, deck, daftar kata, sesi belajar
- `src/features/flashcard/actions.ts` — jawab, undo, tunda, suspend, reset, langganan, pengaturan
- `src/features/flashcard/lib/scheduler/`, `lib/queue/`, `lib/collection.ts`
- `src/features/flashcard/schemas.ts`, `settings-form.ts`, `taxonomy.ts`, `types.ts`
- `src/features/flashcard/components/` — reviewer, tampilan kartu, katalog, form pengaturan
- `src/features/flashcard/**/*.test.ts` — scheduler, antrean, pipeline seed, pengaturan, statistik
