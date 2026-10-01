# Modul Bunpou (文法, pola kalimat)

## Status Aktual

**Rancangan, belum diimplementasi (1 Oktober 2026).** Data slide sedang dikumpulkan. Kontrak
datanya ada di [seed-bunpou.md](../seed-bunpou.md); keputusan di bawah disepakati dalam diskusi
desain dan menjadi acuan implementasi.

## Keputusan

- **Route `/bunpou`** di route group `(public)`. Semua halaman referensi bisa dibaca guest dan
  diindeks mesin pencari, seperti artikel. Login hanya dibutuhkan untuk fitur per user (Fase C).
- **Feature flag `FEATURES_BUNPOU`**, mengikuti aturan umum di [index](index.md#feature-flag).
- **Katalog bawaan milik aplikasi** (lisensi Nihongofy), diisi dari fixture lewat seed seperti
  flashcard. Slide hanya acuan untuk daftar pola dan levelnya. Penjelasan dan contoh ditulis
  ulang AI dalam dua langkah: ekstraksi slide dengan model vision, lalu generate isi dengan model
  teks.
- **Satu entri = satu makna.** Pola dengan bentuk sama tetapi makna berbeda (ばかり, ながら, ところ,
  わけ) dipecah menjadi beberapa entri yang masing-masing punya level dan URL sendiri, lalu
  dikelompokkan lewat `family`. Level disimpan per makna karena たばかり (N4) dan ばかりだ (N2)
  berbeda level.
- **Perbandingan pola mirip adalah data terpisah** (`comparisons.json`), bukan bagian dari tiap
  pola. Isinya milik kelompok, jadi kalau disimpan per pola akan terduplikasi dan saling
  bertentangan. Anggota kelompok ditentukan manusia, isinya dirancang AI, dan hanya yang sudah
  ditinjau yang terbit.
- **Sambungan (接続) terstruktur**, memakai bentuk baku dari taxonomy (`v-ta`, `na-adj-na`, …),
  sehingga bisa ditampilkan sebagai badge dan dipakai sebagai filter.
- **Tidak dibuat:** klik kanji untuk detail (belum ada data kanji), audio rekaman (memakai TTS
  browser dari modul [study](study.md)), dan full-text search di database. Katalog diperkirakan
  ratusan sampai sekitar seribu pola, jadi pencarian cukup dilakukan di client.
- **Laporan konten:** `ReportTargetType` mendapat `BUNPOU_POINT` dan `BUNPOU_COMPARISON` supaya
  user bisa melaporkan isi yang salah.

## Fase A — Referensi

| Route | Isi |
|---|---|
| `/bunpou` | Jalur per level N5 → N1 (urutan `order`). Filter fungsi, ragam, nuansa, dan bentuk sambungan. Pencarian di client atas judul, variasi, romaji, kana, dan arti Indonesia/Inggris dari daftar ringkas. |
| `/bunpou/[key]` | Judul berfurigana, level, ragam, dan fungsi; tab makna lain dalam family; arti inti; sambungan berupa badge; penjelasan; contoh kalimat (sorotan pola, furigana on/off lewat `FuriganaScope`, TTS); batasan dan kesalahan umum; ringkasan perbandingan yang memuat pola ini; pola lain dengan fungsi sama. |
| `/bunpou/compare/[key]` | Perbandingan lengkap: tabel nuansa, ragam, dan batasan, ditambah kalimat kontras ○/△/✕. |

Metadata memakai `pageMetadata()`, structured data `LearningResource`, dan halaman masuk sitemap.

## Fase B — Tautan ke Soal JLPT Asli

Fixture bank soal memuat 1.065 soal bunpou, semuanya sudah berpembahasan. Namun `keyPoints`-nya
teks bebas yang tidak konsisten (`"partikel で"`, `"~てしまう"`, `"{接続詞|せつぞくし}"`).
`gen:bunpou-links` memetakan setiap soal ke key pola yang diuji (`tested`) dan pola yang muncul
sebagai pengecoh (`distractors`).

- Di halaman pola, bagian "Muncul di JLPT asli" menautkan ke mode baca paket.
- Di review hasil, result detail, dan latihan cepat (setelah soal dijawab), muncul "Pola yang
  diuji".
- Tautan diperlakukan seperti pembahasan: tidak pernah terkirim di mode ujian atau sebelum soal
  latihan dijawab.
- Data pengecoh menjadi bahan usulan kelompok perbandingan. Akurasi per pola di analytics bisa
  menyusul.

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
| `BunpouPoint` | A | Seperti `FlashcardVocab`: `key` unik, level, order, family, judul (markup, polos, bacaan, romaji), isi, tag, audit AI, `retiredAt`. Tidak pernah dihapus. |
| `BunpouComparison` + `BunpouComparisonPoint` | A | Kelompok perbandingan dan urutan kolomnya. |
| `QuestionBunpouLink` | B | `questionId`, `pointId`, peran `TESTED`/`DISTRACTOR`. |
| `BunpouCard`, `BunpouRevlog`, pengaturan | C | Mengikuti `FlashcardCard`/`FlashcardRevlog`. |
