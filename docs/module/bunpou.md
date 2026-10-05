# Modul Bunpou (文法, pola kalimat)

## Status Aktual

**Fase A: data dan UI publik selesai di kode, belum live (2 Oktober 2026).** Kontrak, taxonomy,
generator, validator, schema, dan migration katalog tersedia. Fixture berisi 90 point N5 (36
slide) dan 138 point N4 (77 slide). Halaman `/bunpou`, `/bunpou/[key]`, dan
`/bunpou/compare/[key]` beserta SEO dan flag `FEATURES_BUNPOU` sudah dibuat. Migration sudah
diterapkan dan seed menerbitkan 227 pola (2 pola N4 masih pending). Yang tersisa sebelum live:
uji manual lalu deploy. Kontrak datanya ada di [seed-bunpou.md](../seed-bunpou.md).

## Feature Flag

`FEATURES_BUNPOU` (default `true`). Saat `false`, `/bunpou/*` menjadi 404 lewat
`src/app/(public)/bunpou/layout.tsx`, menu "Bunpou" di header publik tidak dirender, dan path
bunpou keluar dari `sitemap.xml` serta `robots.txt`.

**Urutan deploy:** `sitemap.xml` di-prerender saat build dan membaca `BunpouPoint` bila flag
aktif, jadi migration `20261001200000_bunpou_catalog` wajib sudah diterapkan sebelum deploy kode
ini. Tanpa migration, set `FEATURES_BUNPOU=false` atau build gagal.

## Keputusan

- **Route `/bunpou`** di route group `(public)`. Semua halaman referensi bisa dibaca guest dan
  diindeks mesin pencari, seperti artikel. Login hanya dibutuhkan untuk fitur per user (Fase C).
- **Feature flag `FEATURES_BUNPOU`**, mengikuti aturan umum di [index](index.md#feature-flag).
- **Katalog bawaan milik aplikasi** (lisensi Nihongofy), diisi dari fixture lewat seed seperti
  flashcard. Slide hanya acuan untuk daftar pola dan levelnya. Penjelasan dan contoh ditulis
  ulang AI dalam dua langkah: ekstraksi slide dengan model vision, lalu generate isi dengan model
  teks.
- Source juga dapat berupa indeks teks/video dengan URL dan timestamp. Source jenis ini hanya
  menjadi bukti identitas, urutan, dan level; importer menormalisasi judul serta sense sebelum
  generator menulis konten publik. N2/N1 memakai pembahasan terstruktur yang lebih mendalam untuk
  nuansa, ragam, batasan, konteks umum, dan sedikitnya lima contoh.
- Sumber ketiga adalah **celah dari soal JLPT** (`gap-sources/`): pola yang diuji soal asli tetapi
  belum ada di katalog, dikurasi manusia dari laporan tautan Fase B dengan soal sebagai bukti.
  Adverbia fungsional (やっと, きっと, ずっと) termasuk katalog bunpou, di section "Kata sambung dan
  adverbia".
- **Satu entri = satu makna.** Pola dengan bentuk sama tetapi makna berbeda (ばかり, ながら, ところ,
  わけ) dipecah menjadi beberapa entri yang masing-masing punya level dan URL sendiri, lalu
  dikelompokkan lewat `family`. Level disimpan per makna karena たばかり (N4) dan ばかりだ (N2)
  berbeda level.
- **Level mengikuti slide sumber.** Pola dengan makna sama boleh muncul sebagai entri terpisah di
  beberapa level. Ini mendukung navigasi katalog per level dan tidak memaksakan klasifikasi JLPT
  yang tidak memiliki daftar grammar resmi tunggal. `family` tetap khusus untuk bentuk sama dengan
  makna berbeda, bukan untuk menautkan pengulangan sense yang sama lintas level.
- **Perbandingan pola mirip adalah data terpisah** (`comparisons.json`), bukan bagian dari tiap
  pola. Isinya milik kelompok, jadi kalau disimpan per pola akan terduplikasi dan saling
  bertentangan. Anggota kelompok ditentukan manusia, isinya dirancang AI, dan hanya yang sudah
  ditinjau yang terbit.
- **Sambungan (接続) terstruktur**, memakai bentuk baku dari taxonomy (`v-ta`, `na-adj-na`, …),
  sehingga bisa ditampilkan sebagai badge dan dipakai sebagai filter.
- **Jenis materi eksplisit** (`pattern`, `particle`, `conjugation`, `foundation`) supaya halaman
  detail dapat memilih tampilan yang sesuai. Konjugasi memakai `formation` terstruktur; materi
  tidak dipaksa mengikuti susunan visual slide sumber.
- **Section pembelajaran eksplisit** lewat `sectionKey` dari taxonomy. Section mengatur kelompok
  navigasi, sedangkan tag tetap menjelaskan fungsi, ragam, dan nuansa linguistik.
- **Tidak dibuat:** klik kanji untuk detail (belum ada data kanji), audio rekaman (memakai TTS
  browser dari modul [study](study.md)), dan full-text search di database. Katalog diperkirakan
  ratusan sampai sekitar seribu pola, jadi pencarian cukup dilakukan di client.
- **Laporan konten:** `ReportTargetType` mendapat `BUNPOU_POINT` dan `BUNPOU_COMPARISON` supaya
  user bisa melaporkan isi yang salah.

## Fase A — Referensi

| Route | Isi |
|---|---|
| `/bunpou` | Jalur per level N5 → N1, dikelompokkan menurut section lalu `order`. Filter jenis materi, fungsi, ragam, nuansa, dan bentuk sambungan. Pencarian di client atas judul, variasi, romaji, kana, dan arti Indonesia/Inggris dari daftar ringkas. |
| `/bunpou/[key]` | Judul berfurigana, level, section, jenis materi, ragam, dan fungsi; tab makna lain dalam family; arti inti; sambungan berupa badge; tabel pembentukan bila ada; penjelasan; contoh kalimat (sorotan pola, furigana on/off lewat `FuriganaScope`, TTS); batasan dan kesalahan umum; ringkasan perbandingan yang memuat pola ini; pola lain dengan fungsi sama. |
| `/bunpou/compare/[key]` | Perbandingan lengkap: tabel nuansa, ragam, dan batasan, ditambah kalimat kontras ○/△/✕. |

Metadata memakai `pageMetadata()`, structured data `LearningResource`, dan halaman masuk sitemap.

### Implementasi

- Query di `src/features/bunpou/queries.ts`. Daftar ringkas seluruh pola dimuat sekali
  (`getBunpouCatalog`) dan dipakai ulang untuk katalog, family, pola terkait, serta navigasi
  sebelum/sesudah. Isi lengkap per pola dan per perbandingan diambil terpisah.
- Semua query memakai `unstable_cache` dengan satu tag `CACHE_TAGS.bunpouCatalog` dan
  `revalidate` 1 jam. `seed:bunpou` berjalan di luar app, jadi setelah seed hasilnya muncul paling
  lambat sejam kemudian, atau segera setelah tag `bunpouCatalog` diinvalidasi di `/admin/ops`.
- Kolom JSONB dibaca lewat skema zod longgar di `schemas.ts`; validasi ketat tetap milik seed.
- Katalog (`components/bunpou-catalog.tsx`) memilih level lewat tombol dan menyimpannya di
  `?level=` dengan `history.replaceState`, sehingga tautan breadcrumb dari halaman detail kembali
  ke level yang sama. Saat ada kata kunci, pencarian berlaku di semua level. Pencocokan dan filter
  ada di `lib/catalog-filter.ts`; katakana pada kata kunci diubah ke hiragana.
- Tab family menampilkan satu entri per `senseLabel`. Makna yang sama di beberapa level diwakili
  pola yang sedang dibuka, atau entri dari level terdekat.
- Halaman detail menampilkan family sebagai tab, sambungan sebagai badge bentuk baku, tabel
  `formation`, penjelasan, contoh dengan sorotan pola dan TTS browser, pitfalls, perbandingan yang
  memuat pola ini, dan sampai enam pola lain dengan tag fungsi yang sama (level terdekat dulu).
  Sebelum/sesudah hanya dalam level yang sama.
- Perbandingan yang salah satu polanya sudah dipensiunkan dianggap tidak ada (404), karena
  tabelnya tidak lagi utuh. Aturan yang sama berlaku bila `content` tidak lolos skema baca atau
  ada anggota tanpa baris tabel. Perakitannya di `lib/comparison.ts` (diuji terhadap seluruh
  fixture): baris tabel diurutkan menurut urutan anggota di `BunpouComparisonPoint`, bukan urutan
  JSON.
- Daftar perbandingan di katalog, halaman pola, dan sitemap memakai aturan anggota yang sama,
  supaya tidak ada tautan ke halaman 404. Katalog mengurutkannya menurut level tersulit
  anggotanya lalu level termudah, dengan badge level dan judul Jepang anggotanya.
- Halaman perbandingan: tabel nuansa/ragam/batasan mulai `md`; di layar sempit setiap pola menjadi
  kartu berlabel, karena tabel empat kolom berisi paragraf tidak terbaca bila digulir menyamping.
  Verdict kalimat kontras selalu tampil sebagai teks (Wajar, Kurang wajar, Salah) di samping
  simbolnya, bukan hanya warna atau `aria-label`. Key opsi boleh berulang dalam satu kontras
  (bentuk benar dan salah dari pola yang sama).
- Bunpou sengaja tanpa `loading.tsx`: halaman dirender dari cache, dan streaming membuat
  `notFound()` menjawab 200 + `noindex` alih-alih status 404.
- Catatan dan diskusi pola dijelaskan di [Catatan dan Diskusi Pola](#catatan-dan-diskusi-pola).
- Tombol "Laporkan pola ini" dan "Laporkan perbandingan ini" (target `BUNPOU_POINT` dan
  `BUNPOU_COMPARISON`) tampil bila `FEATURES_REPORT` aktif; detailnya di
  [report.md](report.md). Home menampilkan kartu Bunpou yang mengikuti flag.

## Catatan dan Diskusi Pola

Memakai modul catatan soal ([question-comment.md](question-comment.md)) dengan target
`bunpouPointId`, di balik flag `FEATURES_BUNPOU_DISCUSSION`. Tabel, tombstone, balasan, mention,
moderasi, laporan `COMMENT`, anonimisasi akun, dan rate limit-nya sama.

- **Target per pola** (entri katalog = satu makna di satu level). Makna yang sama di level berbeda
  (`de-tempat` N5, `de-tempat-aktivitas` N4) punya diskusi masing-masing.
- **Halaman pola:** tombol **Diskusi (n)** di samping "Laporkan pola ini" melompat ke section
  Diskusi; **Catatanku** tampil setelah bagian "Perhatikan"; section **Diskusi** tampil setelah pola
  terkait. Guest melihat ajakan masuk; `next` membawa anchor `#catatanku`/`#diskusi`.
- **Dirender server dan diindeks.** Thread publik ikut di HTML halaman supaya terindeks bersama isi
  polanya. Karena halaman sudah membaca session untuk thread (tombol milik sendiri), Catatanku ikut
  dirender server, bukan dimuat client seperti rencana awal. Katalognya tetap di-cache;
  catatan dan thread tidak.
- **Indeks** `/bunpou/discussion`: pola dengan aktivitas diskusi terbaru, juga tab ketiga di
  `/discussion` dan `/flashcard/discussion`.
- **Pengalih** `/bunpou/discussion/<pointId>[?comment=<id>]` menerjemahkan id ke
  `/bunpou/<key>#diskusi` atau `#comment-<id>`, untuk tautan dari moderasi, Catatanku, dan permalink
  lama `/discussion/<id>`.
- Pola yang dipensiunkan 404 beserta diskusinya; catatannya tetap tersimpan.
- Perbandingan belum punya catatan/diskusi; ditambahkan setelah data perbandingan ada.

## Fase B — Tautan ke Soal JLPT Asli

Fixture bank soal memuat 1.065 soal bunpou, semuanya sudah berpembahasan. Namun `keyPoints`-nya
teks bebas yang tidak konsisten (`"partikel で"`, `"~てしまう"`, `"{接続詞|せつぞくし}"`), dan
kecocokan langsungnya ke judul katalog hanya sekitar 53%, tanpa membedakan makna (〜で punya
sembilan entri). `gen:bunpou-links` memakai pipeline dua tahap: model menyebut pola yang diuji tanpa
melihat katalog, script mencarinya di seluruh katalog lintas level, lalu model memilih makna dari
kandidat yang sempit. Kontrak lengkapnya di
[seed-bunpou.md](../seed-bunpou.md#langkah-4--tautan-ke-soal-jlpt-genbunpou-links-fase-b).

- **B1, soal bunpou** (`BUNPOU_GRAMMAR`, `BUNPOU_SENTENCE_COMPOSITION`, `BUNPOU_TEXT_GRAMMAR`):
  peran `tested` dan `distractor`. Dimulai dari paket N5 dan N4 (5 Oktober 2026).
- **B2, bacaan dokkai**: peran `appears`, ditautkan per bacaan (`QuestionContext`), bukan per soal,
  maksimal lima pola penting per bacaan. Kontraknya sudah ditetapkan, generatornya menyusul B1.
- Choukai tidak ditautkan (tidak ada transkrip), moji-goi juga tidak (yang diuji kosakata).
- Di halaman pola, bagian "Muncul di JLPT asli" (B1) dan "Contoh di bacaan JLPT asli" (B2)
  menautkan ke mode baca paket.
- Di result detail, mode baca paket, dan latihan cepat (setelah soal dijawab), muncul "Pola yang
  diuji" di bawah pembahasan: chip level + judul + arti yang menaut ke `/bunpou/<key>`. Datanya
  diambil lewat `QUESTION_BUNPOU_LINKS_SELECT` (`src/lib/question-bunpou-links.ts`) di query yang
  sama dengan pembahasan; mode baca memakai cache terpisah bertag `bunpouCatalog` karena
  tautannya berubah lewat `seed:bunpou`, bukan lewat paket soal. Bila `FEATURES_BUNPOU` mati,
  daftarnya kosong.
- Tautan diperlakukan seperti pembahasan: tidak pernah terkirim di mode ujian atau sebelum soal
  latihan dijawab.
- Hanya tautan dari soal `confidence: high` yang tampil. Data pengecoh tidak tampil ke user dan
  menjadi bahan usulan kelompok perbandingan. Akurasi per pola di analytics bisa menyusul.

## Fase C — SRS Bunpou

- **Terpisah dari flashcard di level data**, dengan tabel kartu dan revlog sendiri. Scheduler
  FSRS, logika antrean, tombol rating, dan undo dari `src/features/flashcard/lib/` dipakai ulang.
  Alasan tidak digabung:
  - Kartu flashcard ber-PK `userId + vocabId` dengan FK ke `FlashcardVocab`.
  - Batas harian flashcard (20 kartu baru) berlaku global, sedangkan grammar butuh batas jauh
    lebih kecil.
  - Bentuk kartunya berbeda.
- **Batas harian sendiri**, usulan bawaannya 5 pola baru per hari.
- **Kartu kalimat rumpang** dari `examples`:
  - Depan: terjemahan Indonesia dan kalimat Jepang dengan bagian `__…__` dikosongkan.
  - Belakang: kalimat lengkap dan tautan ke halaman pola.
  - Penilaian sendiri dengan Again/Hard/Good/Easy.
  - Satu pola = satu kartu; contoh kalimatnya digilir tiap review supaya yang dihafal polanya,
    bukan kalimatnya.
- Deck (level, fungsi) dan tampilan hitungan review gabungan di dashboard ditentukan saat Fase C
  dikerjakan. Pilihan ganda dengan pengecoh dari family atau perbandingan ditunda, karena
  berisiko punya lebih dari satu jawaban benar (から dan ので sama-sama wajar di banyak kalimat).

## Rencana Tabel

Skema final ditulis saat implementasi. Migration ditulis tangan lalu `migrate deploy`, karena
`migrate dev` tidak bisa dipakai dengan Supabase di project ini.

| Tabel | Fase | Isi |
|---|---|---|
| `BunpouPoint` | A | Seperti `FlashcardVocab`: `key` unik; level, order, kind, sectionKey, family; judul (markup, polos, bacaan, romaji); meaning dan search text; `content` JSONB tervalidasi untuk sambungan, formation, variasi, penjelasan, contoh, dan pitfalls; tag; provenance/audit AI dan review manusia; `retiredAt`. Tidak pernah dihapus. Unique `(level, order)`, index `(level, sectionKey, order)` dan `family`, serta GIN pada tag. |
| `BunpouComparison` + `BunpouComparisonPoint` | A | Kelompok perbandingan dan urutan kolomnya. |
| `QuestionBunpouLink` | B1 | `questionId`, `pointId`, peran `TESTED`/`DISTRACTOR`, `confidence`. |
| `ContextBunpouLink` | B2 | `questionContextId`, `pointId`, kutipan kalimat, `confidence`. Terpisah dari tautan soal karena identitas dan maknanya berbeda. |
| `BunpouCard`, `BunpouRevlog`, pengaturan | C | Mengikuti `FlashcardCard`/`FlashcardRevlog`. |
