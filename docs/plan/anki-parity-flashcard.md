# Analisa & Desain: Modul Flashcard Paritas Anki (FSRS)

Status: **desain, belum ada implementasi.**
Revisi 2 — 3 September 2026 (keputusan scope sudah dikunci).
Rujukan kode: `src/features/vocabulary/*`, `prisma/schema.prisma` (204-362), `docs/module/vocabulary.md`.

---

## 0. Keputusan Scope (terkunci)

| # | Keputusan | Dampak |
|---|---|---|
| 1 | Import lewat **CSV/TXT** (format teks Anki), bukan `.apkg` di v1 | Menghapus dependensi zstd/protobuf/sql.js; muat di limit Vercel |
| 2 | **Tidak ada custom card template.** Tata letak ditentukan aplikasi, user hanya memetakan field | Menghapus parser/renderer template + risiko XSS + risiko rusaknya UI neo-brutalism |
| 3 | **FSRS adalah prioritas utama** — harus semirip mungkin dengan Anki | Fokus effort di scheduler + queue, bukan di editor konten |
| 4 | Deploy **Vercel** | Import harus muat di 4.5 MB body / 300s duration |
| 5 | Deck bawaan bebas sumber, dikirim lewat **script seed** | Mengikuti pola `docs/seed.md` yang sudah ada |
| 6 | Guest = **mode coba**, tidak masuk history | Tidak perlu koleksi/DB untuk guest — murni state client |
| 7 | Modul vocabulary lama **dihapus** | Tidak perlu namespace paralel; nama `Flashcard*` bisa dipakai ulang |

Konsekuensi penamaan dari #7: rencana namespace `Anki*` di revisi 1 **dibatalkan**. Model `Flashcard*` lama di-drop dan namanya dipakai ulang untuk model baru. Satu namespace, tidak ada dua jalur kode.

Konsekuensi definisi dari #2: "1:1 dengan Anki" sekarang berarti **paritas pada scheduler, queue, dan deck options** — bukan paritas pada sistem presentasi kartu. Ini pertukaran yang tepat: bagian Anki yang benar-benar sulit ditiru dan bernilai adalah penjadwalannya, sementara sistem template-nya justru bagian yang paling bermasalah untuk di-host multi-user.

---

## 1. Penilaian atas Tiap Keputusan

### 1.1 CSV/TXT — benar, dan lebih dari sekadar "cukup"

Anki memang mendukung impor teks secara native (Anki 2.1.54+ dengan header `#key:value`), dan format ini menangkap **hampir semua** yang kita butuhkan: field, deck tujuan, tags, note type, dan GUID untuk dedup. Yang hilang cuma media dan template — dua hal yang memang sudah kita buang dari scope.

Bonus yang tidak kelihatan: ekosistem deck teks jauh lebih ramah. User bisa ekspor dari Anki sendiri (Notes in Plain Text), dari Excel, dari Google Sheets, dari jisho list, atau menulis manual. Tidak ada gatekeeping format biner.

### 1.2 Vercel — bukan masalah sama sekali untuk teks

Limit resmi per 24 Agustus 2026 (Fluid compute, default untuk project baru):

| Limit | Hobby | Pro |
|---|---|---|
| Request/response body | **4,5 MB** | 4,5 MB |
| Max duration | **300s** (default & maksimum) | 300s default, 800s maksimum |
| Memory | 2 GB | 2-4 GB |

CSV 4,5 MB ≈ 50.000-100.000 baris. Deck terbesar yang wajar (Core 6k) cuma ~6.000 baris ≈ 1-2 MB. **Muat dengan margin besar.**

Meski begitu desain yang saya rekomendasikan tetap **parse di browser, kirim per batch**:

```
Browser: baca File → parse header + CSV → preview 20 baris → user map kolom
      → kirim POST /api/flashcard/import/chunk  (batch 500 baris JSON)
Server: validasi zod → dedup by guid/first-field → createMany → balas progress
Browser: ulangi sampai habis → finalize
```

Alasannya bukan limit body, tapi: (a) progress bar nyata, (b) user bisa melihat preview dan memperbaiki mapping sebelum satu baris pun masuk DB, (c) file 20 MB tetap jalan tanpa perubahan arsitektur, (d) tidak ada satu pun request yang mendekati 300s.

### 1.3 Tanpa custom template — setuju, tapi perlu diganti konsep yang tepat

Membuang template Anki **tidak berarti membuang konsep note type.** Note type harus tetap ada, karena dari situlah datang hal yang penting untuk FSRS: **satu note bisa menghasilkan beberapa kartu**, dan kartu-kartu bersaudara itulah dasar fitur *burying*.

Gantinya: **note type didefinisikan aplikasi** (bukan user), masing-masing punya set field tetap dan tata letak neo-brutalism yang sudah didesain:

| Note type | Field | Kartu yang dihasilkan |
|---|---|---|
| `BASIC` | Front, Back | 1 (Front → Back) |
| `BASIC_REVERSED` | Front, Back | 2 (Front→Back, Back→Front) |
| `VOCAB_JP` | Kata, Bacaan, Arti, Contoh, Audio, Catatan | 2 (Kata→Arti, Arti→Kata) |
| `KANJI` | Kanji, Onyomi, Kunyomi, Arti, Contoh | 2-3 (arti, bacaan) |
| `CLOZE` | Teks (`{{c1::...}}`), Catatan | N sesuai jumlah `c1..cN` |

User saat import memilih note type, lalu memetakan kolom CSV → field. Tata letak, font Jepang, furigana, tombol audio, semuanya milik aplikasi dan konsisten.

Yang tetap perlu di-sanitize: isi field itu sendiri. Deck Anki sering menyimpan HTML di dalam field (`<b>`, `<br>`, `<ruby>`, `<img>`, `[sound:...]`). Rencana: allowlist ketat — `b i u em strong br ruby rt rb span div` — sisanya di-strip; `[sound:x]` dan `<img src=x>` diubah jadi teks polos di v1 karena tidak ada media. Tidak ada `<script>`, `<style>`, atribut `on*`, atau `style=` yang lolos, jadi UI tidak bisa dirusak dari data import.

Konsekuensi jujur yang perlu diterima: **round-trip ke Anki jadi tidak sempurna.** Deck yang diimpor ke sini lalu diekspor lagi tidak akan membawa template aslinya. Ini konsekuensi wajar dari keputusan #2.

### 1.4 Prioritas FSRS — setuju, ini memang inti masalahnya

Detail teknis dan definisi "mirip Anki" ada di §3. Ringkasnya: paritas realistis untuk semua kecuali satu hal — **parameter optimizer**.

### 1.5 Deck bawaan lewat seed — setuju

Pola `docs/seed.md` sudah terbukti untuk bank soal (50 fixture, satu file per paket). Pola yang sama diterapkan: satu file per deck di `src/flashcard-deck-data/`, script `npm run seed:flashcard-deck`, idempoten by slug. Detail di §6.

### 1.6 Guest sebagai mode coba — setuju, dan ini menyederhanakan banyak hal

Model Anki mengasumsikan satu koleksi per user; guest tidak punya tempat di sana. Menjadikan guest murni ephemeral (state di React, hilang saat refresh, tidak ada revlog) menghapus seluruh kelas masalah.

Satu hal yang **harus diperbaiki**: `docs/module/vocabulary.md` mencatat bahwa copy UI sekarang bisa mengatakan progress guest "tersimpan" padahal tidak. Di modul baru, UI guest harus eksplisit: banner "Mode coba — progres tidak disimpan" + CTA daftar.

### 1.7 Hapus modul lama — setuju, biayanya nol

Data existing: 32 kartu, 6 deck, 0 attempt/review dari user. Tidak ada yang perlu dimigrasikan. Migration cukup `DROP` model lama lalu `CREATE` model baru. Yang perlu ikut dibersihkan: route `/vocab/*` dan `/flashcard-settings`, `src/features/vocabulary/`, `prisma/seed-learning.mjs` (bagian vocab), `CACHE_KEYS.vocabulary*`, `CACHE_TAGS.vocabulary*`, dan entri `FlashcardDeckKind`/`FlashcardLearningState` lama di schema.

Satu-satunya yang layak diselamatkan: 13 nilai di `FlashcardSetting` milik user existing bisa jadi nilai awal preset "Default" (opsional; dengan 1 user di DB dev, ini bisa dilewati).

---

## 2. Kondisi Aktual yang Diganti

`src/features/vocabulary/lib/scheduler.ts` (180 baris) adalah SM-2 sederhana dengan beberapa penyimpangan dari Anki:

- Learning vs relearning dibedakan lewat heuristik `repetitions === 0 && lapses === 0`, bukan state eksplisit — rapuh, dan kartu yang pernah lapse dianggap relearning selamanya.
- `HARD` di learning = step ×1.5; Anki memakai rata-rata step sekarang dan berikutnya.
- `clampInterval` menerapkan `minimumIntervalDays` ke **semua** interval; di Anki itu hanya berlaku setelah lapse.
- Tidak ada state `RELEARNING`, tidak ada fuzz, leech, suspend, bury.

Masalah di layer queue (`actions.ts`) yang juga harus ditutup, bukan diwarisi:
- Queue dibangun saat server render → kartu ber-rating `Again` tidak kembali tanpa reload.
- Daily limit **global lintas deck**, karena review log tidak menyimpan `deckId`.
- Cek limit dan write review terpisah → race antar tab bisa melewati limit.
- Batas hari memakai 00:00 Asia/Jakarta; Anki memakai rollover jam 04:00.

---

## 3. FSRS: Definisi "Mirip Anki"

### 3.1 Algoritma

FSRS-6 memodelkan memori dengan tiga besaran:
- **S (Stability)** — hari sampai retrievability turun ke 90%.
- **D (Difficulty)** ∈ [1, 10].
- **R (Retrievability)** = `(1 + factor · t/S)^(-w20)`, `factor = 0.9^(-1/w20) - 1`.

`w20` (decay) menjadi parameter terlatih di FSRS-6 — ini pembeda utama dari FSRS-4.5.

Interval berikutnya = menyelesaikan persamaan di atas untuk `t` pada `R = desired_retention`. Karena itu **`desired retention` adalah setting terpenting**, dan `starting ease` / `easy bonus` / `interval modifier` menjadi tidak relevan saat FSRS aktif.

21 parameter default FSRS-6:
```
[0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666,
 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
```
Same-day review: `S' = S · e^(w17·(G-3+w18)) · S^(-w19)`.

### 3.2 Yang sering disalahpahami

**FSRS tidak menggantikan learning steps.** Steps tetap berjalan sebagai lapisan intraday; FSRS mengambil alih begitu kartu lulus ke review. Anki bahkan menyarankan steps dibuat pendek (< 1 hari) saat FSRS aktif. `ts-fsrs` sudah mendukung `learning_steps` / `relearning_steps` secara native, jadi ini tidak perlu ditambal manual.

### 3.3 Checklist paritas

| Aspek | Cara mencapai | Paritas |
|---|---|---|
| Rumus DSR + interval | `ts-fsrs` (FSRS-6, Node ≥ 20) | Penuh |
| 21 parameter | Default FSRS-6, per preset, bisa di-paste manual | Penuh |
| Desired retention | Setting per preset (default 0.90) | Penuh |
| Learning/relearning steps | `learning_steps` / `relearning_steps` di `ts-fsrs` | Penuh |
| Fuzz | `enable_fuzz: true` | Penuh |
| Same-day review | `enable_short_term: true` | Penuh |
| Maximum interval | `maximum_interval` (36500) | Penuh |
| Day cutoff jam 04:00 | Implementasi sendiri (`lib/scheduler/day.ts`) | Penuh |
| Sort ascending retrievability | `get_retrievability()` saat build queue | Penuh |
| Reschedule on change | `reschedule()` dari `ts-fsrs` | Penuh |
| **Optimize FSRS Parameters** | **Tidak ada di `ts-fsrs`** | **Gap** |
| **Learning step antar-hari (`1d`)** | **ts-fsrs mengembalikannya sebagai `State.Review`** | **Gap** |
| **Learning step dalam detik (`30s`)** | **ts-fsrs membulatkan ke 0 menit lalu mengabaikan semua step** | **Gap** |

### 3.4 Satu-satunya gap nyata: optimizer

Anki mengoptimasi 21 parameter dari review history user memakai gradient descent di Rust. `ts-fsrs` **tidak** menyediakan ini.

Tiga opsi:
1. **Pakai default parameters saja.** Default FSRS-6 sudah dilatih atas jutaan review dan performanya baik untuk mayoritas user. Nol effort.
2. **Sediakan kolom paste-parameter.** User yang sudah pakai Anki bisa menyalin 21 angka hasil optimasi Anki mereka ke sini. Effort ~nol, dan menutup 90% kebutuhan power user.
3. **Port optimizer.** Butuh gradient descent atas ribuan revlog — berat untuk Node, dan 300s Vercel jadi ketat. Fase jauh.

**Rekomendasi: 1 + 2 untuk v1.** Ini gap yang jujur dan kecil; sampaikan di UI apa adanya ("parameter default FSRS-6; jika kamu punya parameter hasil optimasi dari Anki, paste di sini").

---

## 4. Format Import CSV/TXT

Mengikuti spesifikasi Anki agar file ekspor Anki bisa langsung dipakai.

### 4.1 Header

Baris `#key:value` di awal file:

| Header | Arti |
|---|---|
| `#separator:Tab` | Pemisah: `Comma`, `Semicolon`, `Tab`, `Space`, `Pipe`, `Colon`, atau literal |
| `#html:true` | Isi field diperlakukan sebagai HTML |
| `#columns:Front Back Extra` | Nama kolom, sekaligus menentukan jumlah field |
| `#notetype:Basic` | Note type default untuk semua baris |
| `#deck:Core::N3` | Deck tujuan default |
| `#tags:jlpt n3` | Tag yang ditambahkan ke semua baris |
| `#notetype column:1` | Kolom yang berisi nama note type per baris |
| `#deck column:2` | Kolom yang berisi nama deck per baris |
| `#tags column:5` | Kolom yang berisi tags per baris |
| `#guid column:1` | Kolom GUID, untuk dedup lintas import |

### 4.2 Aturan parsing

- UTF-8 wajib. Pemisah dideteksi otomatis bila header tidak ada.
- Jumlah field ditentukan baris non-komentar pertama; field kurang = kosong, field lebih = diabaikan.
- Field multi-baris: dibungkus tanda kutip ganda; kutip di dalam di-escape dengan `""`.
- Alternatif HTML: `<br>` (butuh `#html:true`).

### 4.3 Dedup & update

Ini bagian yang sering diremehkan tapi menentukan apakah import terasa "seperti Anki":

- **Dengan `guid column`**: matching persisten lintas import, bahkan setelah field pertama diedit.
- **Tanpa GUID**: matching lewat **field pertama** dalam note type yang sama.
- Mode: **Update** (default — note dicocokkan diperbarui, **jadwal dipertahankan**), **Ignore duplicates**, **Import as new**.

Yang wajib benar: **update tidak boleh mereset progress.** Ini alasan `AnkiNote.guid` dan `checksum` ada di skema.

### 4.4 Note type mapping

Kolom CSV → field note type aplikasi. Contoh untuk `VOCAB_JP`:

```
kolom 1 → Kata      kolom 4 → Contoh
kolom 2 → Bacaan    kolom 5 → (abaikan)
kolom 3 → Arti      kolom 6 → Tags
```

UI mapping wajib ada — CSV pihak ketiga tidak akan pernah cocok urutannya. Preview 20 baris pertama dengan hasil render kartu, sebelum import dijalankan.

### 4.5 `.apkg` — nanti, dan caranya sudah jelas

Karena template dan media dibuang dari scope, importer `.apkg` menyusut jadi "unzip → baca SQLite → ambil `notes.flds` → map ke note type kita". Dan solusinya untuk Vercel elegan: **kerjakan seluruhnya di browser.**

```
Browser: fflate (unzip) → fzstd (anki21b) → sql.js WASM (baca notes/cards/decks)
      → kirim batch JSON ke server, persis seperti jalur CSV
```

Server tidak pernah melihat file `.apkg`-nya sama sekali, jadi limit 4,5 MB tidak berlaku. Media (jika suatu saat didukung) di-upload langsung browser → Cloudinary lewat signed upload. **Simpan ini untuk fase G; jalur batch-import di v1 harus didesain supaya `.apkg` tinggal menumpang belakangan.**

---

## 5. Skema Database

Model `Flashcard*` lama di-drop, namanya dipakai ulang.

```prisma
model FlashcardCollection {        // 1:1 dengan User
  userId       Int      @id
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAtDay DateTime          // anchor hari
  rolloverHour Int      @default(4)
  timeZone     String
}

enum FlashcardNoteTypeKind { BASIC BASIC_REVERSED VOCAB_JP KANJI CLOZE }

model FlashcardDeck {
  id         Int    @id @default(autoincrement())
  userId     Int
  name       String                       // hierarkis: "Core::N3::Verbs"
  presetId   Int
  collapsed  Boolean @default(false)
  sourceKind FlashcardDeckSource          // SYSTEM | IMPORTED | MANUAL
  sourceRef  String?                      // slug deck bawaan / nama file import
  @@unique([userId, name])
  @@index([userId])
}

model FlashcardPreset {
  id     Int    @id @default(autoincrement())
  userId Int
  name   String
  config Json   @db.JsonB                 // seluruh deck options, divalidasi zod
  @@unique([userId, name])
}

model FlashcardNote {
  id         BigInt @id                   // epoch ms, dipertahankan dari sumber
  userId     Int
  noteType   FlashcardNoteTypeKind
  guid       String                       // dedup lintas import
  fields     String[]                     // urutan sesuai definisi note type
  tags       String[]
  checksum   Int                          // checksum field pertama
  @@unique([userId, guid])
  @@index([userId, noteType, checksum])
}

enum FlashcardCardType  { NEW LEARNING REVIEW RELEARNING }
enum FlashcardCardQueue { NEW LEARNING REVIEW DAY_LEARN SUSPENDED BURIED_USER BURIED_SIBLING }

model FlashcardCard {
  id     BigInt @id
  userId Int
  noteId BigInt
  deckId Int
  ord    Int                              // index kartu dalam note (sibling)

  type  FlashcardCardType  @default(NEW)
  queue FlashcardCardQueue @default(NEW)
  due   DateTime                          // timestamp absolut, bukan day-number
  position Int                            // urutan queue new

  intervalDays   Int @default(0)
  reps           Int @default(0)
  lapses         Int @default(0)
  remainingSteps Int @default(0)
  flags          Int @default(0)

  stability        Float?                 // FSRS
  difficulty       Float?
  desiredRetention Float?
  easeFactor       Float?                 // fallback SM-2

  @@unique([noteId, ord])
  @@index([userId, deckId, queue, due])
  @@index([userId, queue, due])
}

model FlashcardRevlog {
  id       BigInt @id                     // epoch ms — sekaligus idempotency key
  userId   Int
  cardId   BigInt
  deckId   Int                            // disimpan agar daily limit bisa per deck
  reviewedAt DateTime
  rating   Int                            // 1..4
  intervalDays     Int
  lastIntervalDays Int
  stability  Float?
  difficulty Float?
  takenMs    Int
  kind       FlashcardRevlogKind          // LEARN REVIEW RELEARN MANUAL RESCHEDULED
  @@index([userId, reviewedAt])
  @@index([cardId, reviewedAt])
  @@index([userId, deckId, reviewedAt])
}

model FlashcardImportJob {
  id        String @id @default(cuid())
  userId    Int
  status    FlashcardImportStatus         // PENDING PARSING IMPORTING DONE FAILED
  fileName  String
  totalRows Int    @default(0)
  doneRows  Int    @default(0)
  stats     Json?                         // {added, updated, skipped, errors}
  error     String?
  @@index([userId, status])
}
```

Keputusan desain yang menyimpang dari Anki, beserta alasannya:

- **`due` sebagai `DateTime` absolut.** Anki memakai integer relatif `col.crt` dengan satuan berbeda per queue (posisi untuk new, epoch detik untuk learning, nomor hari untuk review) — warisan SQLite. Timestamp absolut membuat satu query melayani semua queue: `WHERE due <= now()`. Konversi hanya di boundary import/export.
- **`fields` sebagai `String[]`**, bukan string ber-separator `0x1F`.
- **`id` BigInt mempertahankan epoch ms.** Ini yang memungkinkan re-import mendedup dan mempertahankan progress.
- **`FlashcardRevlog.deckId` disimpan.** Menutup langsung bug "daily limit global lintas deck" yang ada sekarang.
- **`FlashcardRevlog.id` sebagai idempotency key.** Menutup race daily-limit antar tab tanpa lock.
- **Preset config sebagai JSONB tervalidasi zod**, bukan ~40 kolom — tidak ada satu pun setting yang perlu di-query/index, dan daftarnya akan terus bertambah.

---

## 6. Deck Options (paritas penuh)

Preset dipakai bersama beberapa deck, seperti Anki — bukan setting global per user seperti `FlashcardSetting` sekarang.

**Daily Limits** — `new/day` (20), `max reviews/day` (200), `new cards ignore review limit` (off), `limits start from top` (off).

**New Cards** — `learning steps` (`1m 10m`), `graduating interval` (1d), `easy interval` (4d), `insertion order` (sequential/random).

**Lapses** — `relearning steps` (`10m`), `minimum interval` (1d), `leech threshold` (8), `leech action` (tag only / suspend).

**Burying** — `bury new siblings`, `bury review siblings`, `bury interday learning siblings`.

**FSRS** — `enable FSRS` (on), `desired retention` (0.90), `FSRS parameters` (21 angka, bisa di-paste), `reschedule cards on change`, `historical retention` (0.90).

**Display Order** — `new card gather order`, `new card sort order`, `new/review order`, `interday learning/review order`, `review sort order`.

**Timers** — `maximum answer seconds` (60), `show on-screen timer`, `stop timer on answer`.

**Auto Advance** — `seconds to show question`, `seconds to show answer`, `answer action`.

**Advanced (hanya aktif bila FSRS dimatikan)** — `maximum interval` (36500), `starting ease` (2.50), `easy bonus` (1.30), `interval modifier` (1.00), `hard interval` (1.20), `new interval` (0.00).

**Sengaja tidak ditiru:** `custom scheduling` (eval JavaScript arbitrer di scheduler — risiko keamanan yang tidak sebanding), `optimize parameters` (lihat §3.4).

---

## 7. Deck Bawaan (via seed)

Alur: **Tambah Deck** → pilih dari katalog bawaan atau upload CSV → deck masuk ke koleksi user.

Deck bawaan di-**copy penuh** ke koleksi user saat dipilih, bukan di-share. Setelah itu deck sepenuhnya milik user — bisa di-rename, ganti preset, suspend kartu, tanpa memengaruhi user lain. Alternatif copy-on-write lebih hemat storage tapi melanggar semantik Anki dan memaksa dua jalur kode di setiap fitur editing.

Copy 5.000 kartu = `createMany` batch dalam satu transaksi. Dengan 300s Vercel ini aman, tapi tetap lewat `FlashcardImportJob` supaya UI punya progress.

Kontrak seed mengikuti pola `docs/seed.md`:

```
src/flashcard-deck-data/<slug>.json     satu file = satu deck bawaan
npm run seed:flashcard-deck             idempoten by slug
npm run seed:flashcard-deck:check       validate-only
```

```jsonc
{
  "slug": "jlpt-n5-kosakata",
  "name": "JLPT N5::Kosakata",
  "description": "...",
  "jlptLevel": "N5",
  "noteType": "VOCAB_JP",
  "license": "CC BY-SA 4.0 — JMdict/EDICT, Electronic Dictionary Research Group",
  "notes": [
    { "guid": "n5-0001", "fields": ["食べる", "たべる", "makan", "ご飯を食べる。"], "tags": ["verb", "ichidan"] }
  ]
}
```

Katalog awal: `Kana (Hiragana/Katakana)`, `JLPT N5-N1 Kosakata`, `Kanji per level`, `Tata Bahasa N5-N1`. Ini sekaligus menutup gap konten yang tercatat di `docs/module/vocabulary.md` (belum ada N3/N2/N1).

Sumber dengan lisensi jelas: **JMdict/JMnedict** dan **KANJIDIC2** (CC BY-SA 4.0, EDRDG), **Tatoeba** (CC BY 2.0 FR) untuk kalimat contoh, **KanjiVG** (CC BY-SA 3.0) untuk urutan goresan. Field `license` di atas wajib diisi dan ditampilkan di halaman deck — atribusi CC BY-SA mengikat.

---

## 8. Arsitektur Modul

```
src/features/flashcard/
├── schemas.ts                    zod: preset config, rating, import payload
├── note-types.ts                 definisi 5 note type + field + jumlah kartu
├── lib/
│   ├── scheduler/
│   │   ├── fsrs.ts               wrapper ts-fsrs ↔ FlashcardCard
│   │   ├── sm2.ts                fallback saat FSRS dimatikan
│   │   └── day.ts                day cutoff rollover 04:00
│   ├── queue/
│   │   ├── gather.ts             intraday → interday → review → new
│   │   ├── sort.ts               display order, ascending retrievability
│   │   ├── limits.ts             daily limit per deck + pewarisan subdeck
│   │   └── bury.ts               sibling burying
│   ├── render/
│   │   ├── sanitize.ts           allowlist HTML ketat
│   │   ├── furigana.ts           parsing 漢字[かんじ] → <ruby>
│   │   └── cloze.ts              {{c1::...}} → N kartu
│   └── import/
│       ├── parse-text.ts         header #key:value, separator, quoting
│       ├── detect.ts             auto-detect separator & kolom
│       ├── map.ts                kolom → field note type
│       └── dedup.ts              guid / first-field matching
├── actions.ts                    answer, bury, suspend, undo, add/remove deck
├── import-actions.ts             create job, chunk, finalize, poll
└── components/                   reviewer, deck tree, deck options, import wizard
```

Route:
- `/flashcard` — pohon deck + tombol **Tambah Deck**
- `/flashcard/add` — katalog deck bawaan / upload CSV
- `/flashcard/import` — wizard: preview → mapping → progress
- `/flashcard/[deckId]` — overview
- `/flashcard/[deckId]/study` — reviewer
- `/flashcard/[deckId]/options` — deck options (preset)
- `/flashcard/browse`, `/flashcard/stats` — fase lanjut

**Reviewer harus client-side dengan queue di-prefetch**, bukan server-render per kartu. Ini menutup langsung bug "kartu Again tidak kembali tanpa reload". Rating dikirim optimistic dengan `revlog.id` (epoch ms) sebagai idempotency key.

**Guest**: reviewer yang sama, tapi queue dari deck bawaan yang dibaca read-only dan state scheduler hanya di memori React. Tidak ada `FlashcardCollection`, tidak ada revlog. Banner "Mode coba — progres tidak disimpan" wajib tampil.

---

## 9. Dependency Baru

| Paket | Untuk | Catatan |
|---|---|---|
| `ts-fsrs` | FSRS-6 | Node ≥ 20 (project sudah `@types/node` ^20) |
| `isomorphic-dompurify` | Sanitasi field | Jalan di server & client |
| (parser CSV sendiri) | ~150 baris | Format Anki punya aturan quoting sendiri; library CSV generik tidak menangani header `#key:value` |

Fase G (`.apkg`, opsional): `fflate`, `fzstd`, `sql.js` — semuanya client-side, tidak menambah bundle server.

---

## 10. Rencana Fase

| Fase | Isi | Depends |
|---|---|---|
| **A. Bersih-bersih + fondasi** ✅ | Hapus modul vocabulary lama & route-nya; migration skema baru; `note-types.ts`; `FlashcardPreset` + zod config lengkap | — |
| **B. Scheduler** ✅ | `ts-fsrs` FSRS-6, learning/relearning steps, day cutoff 04:00, fuzz, SM-2 fallback, **unit test scheduler** | A |
| **C. Queue & Reviewer** ✅ | Gather/sort/limit/bury, reviewer client-side, undo, answer idempoten, suspend/leech | B |
| **D. Deck Options UI** ✅ | Halaman preset 1:1 dengan Anki, per-deck assignment, reschedule on change | B |
| **E. Deck bawaan + seed** ✅ | Kontrak `src/flashcard-deck-data/`, script seed, katalog kana + N5-N1, halaman Tambah Deck | A, C |
| **F. Import CSV/TXT** ✅ | Parser header Anki, wizard preview/mapping, chunked upload, dedup guid/first-field, update tanpa reset progress | A, C |
| **G. Lanjutan** ⬜ sebagian | `.apkg` client-side, card browser, statistik (true retention, forecast), export CSV, filtered deck | C-F |

**Fase B wajib punya unit test.** Ini satu-satunya bagian di seluruh project yang logikanya murni, deterministik, dan mahal kalau salah — `docs/module/index.md` mencatat belum ada test suite sama sekali, dan scheduler adalah tempat pertama yang layak mendapatkannya.

### Progres

- **Fase A selesai (3 September 2026).** Modul vocabulary lama dihapus (`src/features/vocabulary/`,
  route `/vocab/*` dan `/flashcard-settings`, `prisma/seed-learning.mjs`, script `seed:learning`);
  migration `20260903190000_flashcard_anki_parity_foundation` men-drop 8 tabel lama dan membuat
  7 tabel baru; `note-types.ts` dan `schemas.ts` (deck options + FSRS-6) ditulis; `ts-fsrs@5.4.2`
  terpasang. `npm run verify` lulus. Route `/flashcard` belum ada — tautan di sidebar, dashboard,
  profile, landing, sitemap, dan public header sudah diarahkan ke sana dan akan 404 sampai Fase C/E.

- **Fase B selesai (3 September 2026).** `ts-fsrs` terpasang sebagai satu-satunya sumber
  matematika DSR; `scheduleReview()` menjadi pintu masuk tunggal dengan fallback SM-2 penuh.
  Batas hari memakai jam rollover 04:00, bukan tengah malam. 49 unit test ditambahkan dan
  `npm run verify` sekarang menjalankannya.

  Dua batasan `ts-fsrs` ditemukan saat implementasi dan sekarang ditahan di schema (lihat
  §3.4): satuan detik dibulatkan jadi 0 menit lalu seluruh array step diabaikan, dan step
  ≥ 1 hari dikembalikan sebagai `State.Review`. Keduanya gagal diam-diam kalau tidak dijaga.
  Konsekuensinya konfigurasi Anki yang populer seperti `1m 10m 1d` tidak bisa ditiru persis —
  step antar-hari harus dibuang. Kalau ini dianggap wajib, jalan keluarnya adalah menangani
  step interday sendiri di atas ts-fsrs, dan itu pekerjaan tersendiri.

- **Fase C selesai (3 September 2026).** Queue v3 lengkap (gather order, daily limit per deck
  dengan pewarisan subtree, seluruh display order, sibling burying), reviewer client-side dengan
  pintasan keyboard, serta answer/bury/suspend/undo/leech dan CRUD deck. 91 unit test.

  Dua bug ditemukan lewat test dan diperbaiki saat implementasi:
  1. Burying awalnya dijalankan pada urutan TAMPIL, bukan urutan PENGAMBILAN. Dengan
     `newReviewOrder: "mix"`, kartu baru yang kebetulan tampil lebih dulu akan mem-bury kartu
     review sibling-nya — kebalikan dari aturan Anki.
  2. Idempotency review semula memakai primary key revlog yang ditentukan client. Karena PK
     revlog global, satu user bisa mengklaim id lebih dulu dan memblokir review user lain.
     Dipindah ke `@@unique([userId, clientToken])`.

  Diverifikasi end-to-end lewat dev server dengan session sungguhan: pohon deck me-roll-up
  hitungan dari subdeck (7 baru / 3 ulang di deck induk), antrean study memuat 10 kartu dengan
  preview interval per tombol, dan constraint idempotency menolak submit ganda (P2002).

- **Fase E selesai (3 September 2026).** Katalog deck bawaan (tabel `FlashcardSystemDeck`/
  `FlashcardSystemNote`), kontrak data `docs/seed-flashcard.md`, script seed idempoten, halaman
  `/flashcard/add`, dan clone-to-user. Katalog awal 4 deck / 335 note (kana lengkap + N5 kosakata
  dan kanji). Note type `KANA` ditambahkan. 114 unit test.

  Satu bug penting ditemukan lewat pengujian dengan data nyata: **limit deck induk membatasi
  tiap subdeck secara terpisah, bukan total subtree.** Deck `JLPT N5` berlimit 20 dengan dua
  subdeck menghasilkan 40 kartu. Penyebabnya satu kartu hanya memakan jatah deck-nya sendiri;
  di Anki ia memakan jatah deck itu DAN seluruh leluhurnya. `computeDeckBudgets` sekarang juga
  mengembalikan rantai deck, dan allocator memotong seluruh rantai. Dua test mengunci perilaku ini.

  Konten katalog sengaja berhenti di N5. Menambah N4-N1 cukup dengan menulis file JSON baru
  sesuai kontrak — tidak ada kode yang perlu diubah.

- **Fase D selesai (3 September 2026).** Halaman deck options dengan 11 bagian dan 41 kontrol,
  manajemen preset (buat, ganti, terapkan ke subdeck, hapus), dan reschedule-on-change. 128 test.

  Reschedule dihitung dari `stability` yang tersimpan lewat `next_interval()` milik ts-fsrs,
  bukan dengan memutar ulang review history — itu yang dilakukan Anki dan jauh lebih murah.
  Diverifikasi dengan data nyata: menurunkan desired retention dari 90% ke 80% memanjangkan
  interval kartu ber-stability 10 dari 10 hari menjadi 35 hari, dan due dihitung ulang konsisten
  dari `lastReviewedAt`.

- **Fase F selesai (3 September 2026).** Impor CSV/TXT format Anki: parser header `#key:value`,
  deteksi separator, quoting dan field multi-baris, pemetaan kolom, tiga mode duplikat, dan
  pengiriman per batch 500 baris dari browser. 169 test.

  Dua masalah ditemukan lewat pengujian dengan file bergaya ekspor Anki sungguhan:
  1. **Kolom bernama "GUID" dan "Tags" dijejalkan ke field konten** yang kebetulan masih kosong,
     karena saran pemetaan hanya mencocokkan nama field. Sekarang nama kolom khusus dikenali,
     dan file yang menyebutkan `#columns:` tidak lagi ditebak-tebak — kolom yang tidak cocok
     dibiarkan diabaikan daripada menaruh data di tempat yang salah tanpa user sadar.
  2. **Mode "impor sebagai baru" gagal** bila file punya kolom GUID: note-nya bentrok dengan yang
     sudah ada, `skipDuplicates` membuangnya diam-diam, lalu kartunya melanggar foreign key dan
     seluruh transaksi jatuh. Mode ini sekarang mengabaikan guid dari file, guid dalam satu batch
     ikut didedup, dan `skipDuplicates` dibuang supaya masalah semacam ini tidak lagi tersembunyi.

  Diverifikasi end-to-end di browser untuk ketiga mode. Yang terpenting: mengimpor ulang file
  dengan isi yang diubah memperbarui note **tanpa menyentuh jadwal** — kartu ber-interval 21 hari
  dengan 7 repetisi tetap utuh setelah impor ulang.

- **Fase G sebagian selesai (3 September 2026).** Mode coba guest, card browser dengan aksi
  massal, statistik (true retention, forecast, riwayat, sebaran interval), dan export teks
  format Anki. 186 test.

  Export sengaja menghasilkan file yang bisa diimpor kembali lewat jalur impor yang sama,
  termasuk kolom GUID — sehingga export lalu import memperbarui note, bukan menggandakannya.
  Diuji round-trip dengan field yang memuat tab, newline, dan tanda kutip.

  **Impor `.apkg` belum dikerjakan.** Desainnya sudah jelas dan jalur batch impor sudah siap
  ditumpangi, tapi implementasinya (unzip + zstd + sql.js di browser, penanganan schema 11 dan
  18, media) adalah pekerjaan tersendiri yang setara satu fase penuh.

Urutan yang saya sarankan: **A → B → C → E → D → F → G.** Fase E (deck bawaan) didahulukan dari D dan F karena memberi nilai langsung ke user dan tidak bergantung pada UI options yang rumit; import CSV bisa menyusul setelah alur inti terbukti jalan.
