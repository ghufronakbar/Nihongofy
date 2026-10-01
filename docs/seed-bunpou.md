# Data Bunpou: Slide → Katalog Pola → Database

Kontrak data katalog pola kalimat (文法) untuk `/bunpou`. Rancangan modulnya ada di
[module/bunpou.md](module/bunpou.md). Katalog ini milik aplikasi (lisensi: **Nihongofy**); user
tidak bisa menambah konten sendiri.

> **Status (1 Oktober 2026):** kontrak disepakati, script belum ada. Nama perintah, flag, env,
> dan bawaan angka di bawah adalah rencana. Dokumen ini diperbarui bila implementasi berbeda.

Slide hanya **acuan**: dari slide diambil daftar pola, level, makna yang dimaksud, dan
sambungannya. Penjelasan dan contoh kalimat di slide tidak pernah tampil di aplikasi; isi yang
tampil ditulis ulang AI, sama seperti `.apkg` di flashcard yang dipakai hanya sebagai daftar kata.

```bash
npm run bunpou:extract
```

```bash
npm run gen:bunpou
```

```bash
npm run seed:bunpou:check
```

```bash
npm run seed:bunpou
```

| Langkah | Membaca | Menulis | Database | Fase |
|---|---|---|---|---|
| `bunpou:extract` | `data/bunpou/slides/` + `slides.json` + fixture pola | fixture pola (entri baru), `slides.json` | tidak | A |
| `gen:bunpou` | fixture pola + taxonomy | fixture pola (`content`, `ai`) | tidak | A |
| `bunpou:doubts` | fixture pola | — | tidak | A |
| `gen:bunpou-comparisons` | `comparisons.json` + fixture pola | `comparisons.json` (`content`, `ai`) | tidak | A |
| `gen:bunpou-links` | `src/test-package-data/` + fixture pola | `question-links/*.json` | tidak | B |
| `seed:bunpou` | taxonomy + semua file di atas | — | ya | A/B |

Semua langkah AI memakai gateway yang sama dengan generator lain (`EXPLANATION_BASE_URL`,
`EXPLANATION_API_KEY`):

| Env | Dipakai oleh | Pilihan saat ini |
|---|---|---|
| `BUNPOU_EXTRACT_MODEL` | `bunpou:extract` (butuh input gambar) | `ag/gemini-3.8-flash` |
| `BUNPOU_MODEL` | `gen:bunpou`, `gen:bunpou-comparisons`, `gen:bunpou-links` | `cx/gpt-5.6-terra` |

`--reasoning-effort` bawaannya `high` untuk semua langkah. **Belum diverifikasi:** gateway
meneruskan input gambar (`image_url` berisi data URL base64) ke `BUNPOU_EXTRACT_MODEL`. Uji dengan
2–3 slide sebelum script ekstraksi dibangun penuh.

## Struktur File

```
data/bunpou/slides/<level>/<deck>/<nomor>.png   ← diisi pemilik project, di-gitignore
src/bunpou-data/
  taxonomy.json                  ← satu-satunya daftar tag dan bentuk sambungan
  slides.json                    ← catatan slide yang sudah diekstraksi
  points/n5.json … n1.json       ← katalog pola, satu file per level
  comparisons.json               ← perbandingan pola mirip
  question-links/<paket>.json    ← tautan soal JLPT → pola (Fase B)
```

## Menyiapkan Slide (untuk pengumpul data)

- **Level ditentukan oleh folder**, bukan oleh AI: `data/bunpou/slides/n3/...` berarti semua pola
  di dalamnya N3. Nama folder level: `n5`, `n4`, `n3`, `n2`, `n1`.
- **Satu deck per subfolder**, mis. `data/bunpou/slides/n3/deck-a/`. Nama deck bebas
  (huruf kecil, angka, `-`).
- **Nama file menentukan urutan.** Pakai nomor dengan nol di depan: `001.png`, `002.png`, ….
  Urutan ini menjadi urutan belajar pola di level tersebut.
- Format PNG, JPG, atau WebP; **satu slide per gambar** (PowerPoint: *File → Export → PNG*).
  Lebar minimal ±1280 px supaya furigana kecil tetap terbaca.
- Slide sampul, daftar isi, latihan soal, atau kuis boleh ikut. Ekstraksi melewatinya dan
  mencatat alasannya di `slides.json`.
- Pola yang sama di dua deck atau dua level tidak masalah; ekstraksi menandainya sebagai calon
  duplikat untuk ditinjau.
- Folder `data/bunpou/` tidak di-commit.

## Langkah 1 — Ekstraksi Slide (`bunpou:extract`)

Model vision menyalin isi slide **apa adanya** ke `source`, lalu memecahnya menjadi entri pola.

- Satu request berisi beberapa slide berurutan dari satu deck (bawaan 6). Deck diproses paralel,
  sedangkan slide di dalam satu deck berurutan, dan model menerima daftar pola yang sudah
  diekstraksi dari deck itu. Dengan begitu pola yang berlanjut ke slide berikutnya digabung ke
  entri yang sama alih-alih menjadi entri baru.
- Satu slide boleh menghasilkan beberapa entri (mis. ながら "sambil" dan "meskipun" dalam satu
  slide), dan satu entri boleh berasal dari beberapa slide.
- Slide dikenali dari isi filenya (sha256) di `slides.json`. Slide yang sudah tercatat dilewati,
  termasuk bila filenya dipindah atau diganti nama, jadi script aman dijalankan berulang setelah
  slide baru ditambahkan.
- Model mengusulkan `key`, `family`, dan `title` baku. Script memastikan key unik dan sah.
- `source` hanya berisi apa yang tertulis di slide. Model tidak boleh menambah informasi dari
  pengetahuannya sendiri di langkah ini; itu tugas langkah 2.
- `extract.doubt` diisi bila slide tidak terbaca, isinya janggal, atau polanya tampak bukan level
  folder tersebut. Level tetap mengikuti folder.
- **Calon duplikat**: bila judul yang dinormalisasi (tanpa `〜`/`～`, spasi, kurung, dan `・`)
  sama dengan entri lain di level mana pun, `extract.doubt` menyebut key entri itu. Selesaikan
  sebelum seed pertama dengan salah satu cara:
  - **Gabung** bila maknanya sama: pindahkan `source.slides` ke entri yang levelnya **lebih
    rendah** (sama dengan aturan kata lintas level di flashcard), lalu hapus entri satunya.
  - **Pisahkan** bila maknanya berbeda: beri keduanya `family` yang sama dan `content.senseLabel`
    yang berbeda.

| Flag | Fungsi |
|---|---|
| `--level N3` | Satu level saja |
| `--deck n3/deck-a` | Satu deck saja |
| `--batch-size 6` | Slide per request (1-10) |
| `--concurrency 4` | Deck yang diproses paralel |
| `--dry-run` | Cetak prompt dan daftar slide tanpa memanggil model |
| `--reasoning-effort high` | Diteruskan ke model |

Untuk mengulang sebuah slide sebelum seed pertama, hapus catatannya di `slides.json` beserta
entri pola yang hanya berasal dari slide itu, lalu jalankan ulang.

## Langkah 2 — Generate Isi (`gen:bunpou`)

Model teks menulis `content` dari identitas pola, `source`, dan taxonomy. Hanya entri yang
`content`-nya masih `null` yang diproses.

- Model juga menerima entri lain dengan `family` yang sama atau judul ternormalisasi yang sama
  (key, judul, level, `source.meaning`). Tujuannya supaya setiap makna ditulis berbeda dan
  `senseLabel`-nya tidak tumpang tindih.
- Jawaban divalidasi per entri ([Aturan Isi](#aturan-isi)). Entri yang gagal diminta ulang dengan
  daftar masalahnya (maksimal 3 percobaan); entri lain dalam batch tetap disimpan.
- Fixture ditulis atomik setelah setiap batch, jadi proses boleh dihentikan kapan saja.
- `ai.doubt` diisi bila `source` janggal: level slide meragukan, sambungan di slide keliru, atau
  makna slide bertentangan dengan pemakaian umum. Model tidak boleh memaksakan isi yang
  diragukannya.

| Flag | Fungsi |
|---|---|
| `--level N3` | Satu level saja |
| `--limit 50` | Maksimal jumlah entri |
| `--key wake-dewa-nai` | Entri tertentu (boleh diulang) |
| `--batch-size 5` | Entri per request (1-10); isi pola jauh lebih panjang dari kartu kosakata |
| `--concurrency 4` | Request paralel (1-16) |
| `--overwrite` | Menimpa entri yang sudah terisi |
| `--only-doubts` | Hanya entri bertanda ragu (pakai bersama `--overwrite`) |
| `--dry-run` | Cetak prompt tanpa memanggil model |
| `--reasoning-effort high` | Diteruskan ke model |

`npm run bunpou:doubts` menampilkan semua `extract.doubt` dan `ai.doubt`. Untuk sementara
perbaikannya manual di fixture; reviewer AI seperti `fix:flashcard-doubts` dibuat bila jumlahnya
banyak.

## Langkah 3 — Perbandingan Pola Mirip (`gen:bunpou-comparisons`)

Perbandingan menjelaskan **bentuk berbeda dengan makna mirip** (から/ので/せいで/おかげで). Ini
berbeda dari `family`, yang mengelompokkan **bentuk sama dengan makna berbeda** (ながら sambil /
ながら meskipun). Satu pola bisa ada di beberapa perbandingan.

1. **Manusia menentukan kelompok**: menulis `key`, `title`, dan `points` dengan `content: null`.
2. `gen:bunpou-comparisons` mengisi `content` (ringkasan, baris tabel, kalimat kontras) untuk
   kelompok yang masih kosong. `--overwrite` menimpa isi dan mengosongkan `reviewedAt`.
3. **Manusia meninjau** lalu mengisi `reviewedAt`. Seed hanya menerbitkan perbandingan yang
   sudah ditinjau dan semua polanya sudah terbit.

Isi perbandingan sengaja tidak terbit tanpa tinjauan, karena tabel nuansa yang salah lebih
menyesatkan daripada tidak ada tabel sama sekali. Contohnya klaim umum "ので tidak boleh dipakai
sebelum 〜てください", padahal `危ないので、下がってください` sangat wajar.

## Langkah 4 — Tautan ke Soal JLPT (`gen:bunpou-links`, Fase B)

Memetakan setiap soal `BUNPOU_GRAMMAR`, `BUNPOU_SENTENCE_COMPOSITION`, dan `BUNPOU_TEXT_GRAMMAR`
di `src/test-package-data/` ke pola yang diujinya.

- Model menerima teks soal, keempat pilihan, kunci jawaban, pembahasan (`summary`, `keyPoints`),
  bacaan bila soal punya `QuestionContext`, dan daftar kandidat pola (key, judul, `senseLabel`,
  arti) dari level paket itu dan level di bawahnya.
- `tested` berisi pola yang diuji jawaban benar, dan `distractors` berisi pola yang muncul di
  pilihan salah. Keduanya boleh kosong: banyak soal menguji partikel, kata sambung, atau bentuk
  keigo yang bukan entri katalog, dan model tidak boleh memaksakan tautan.
- Soal yang sudah tercatat (termasuk yang `tested`-nya kosong) dilewati. `--refresh-empty`
  memproses ulang soal tanpa tautan setelah katalog bertambah; `--overwrite` memproses ulang
  semuanya.
- Soal dikenali lewat nama paket, `mondaiType`, dan `order`, sama dengan
  `seed:question-explanation`, sehingga tautan tetap berlaku walau database diimpor ulang.
- **Aturan bocor jawaban:** tautan ini memberi petunjuk jawaban. Perlakukan sama dengan
  `QuestionExplanation`: tidak pernah ikut terkirim di mode ujian atau di latihan cepat sebelum
  soalnya dijawab (lihat [database.md](database.md)).

| Flag | Fungsi |
|---|---|
| `--package n3-2019-12` | Satu fixture paket saja (nama file tanpa `.json`) |
| `--level N3` | Paket satu level saja |
| `--batch-size 10` | Soal per request |
| `--concurrency 4` | Request paralel |
| `--refresh-empty` | Proses ulang soal yang belum punya tautan |
| `--overwrite` | Proses ulang semua soal |
| `--dry-run` | Cetak prompt tanpa memanggil model |

## Langkah 5 — Seed (`seed:bunpou`)

- Memvalidasi taxonomy, semua fixture pola, perbandingan, dan tautan. Satu pelanggaran
  menggagalkan seed, dan tidak ada yang ditulis.
- Pola diterbitkan bila punya `content` + `ai`, serta `extract.doubt` dan `ai.doubt`-nya kosong.
  Ini lebih ketat dari flashcard karena salah nuansa di grammar lebih merugikan.
- Pola yang hilang dari fixture diberi `retiredAt` dan tidak pernah dihapus, karena URL, kartu
  SRS (Fase C), tautan soal, dan perbandingan merujuknya.
- Diturunkan saat seed, tidak disimpan di fixture: judul tanpa markup, bacaan judul (dari
  furigana `content.title`), romaji (dari bacaan, deterministik, bukan AI), dan teks pencarian.
- Perbandingan hanya terbit bila sudah `reviewedAt` dan semua polanya terbit; selain itu
  dilewati dengan log.
- Tautan soal dicocokkan ke `Question.id` lewat nama paket → `mondaiType` → `order`. Paket yang
  belum ada di database dilewati dengan log (bukan gagal); soal yang tidak ditemukan dicatat
  sebagai `missing`. Tautan ke pola yang belum terbit tidak ikut ditulis.

## Format Fixture

### `points/<level>.json`

```jsonc
{
  "level": "N3",
  "points": [
    {
      "key": "wake-dewa-nai",          // identitas + URL /bunpou/wake-dewa-nai
      "order": 42,                     // urutan belajar di level ini (urutan slide)
      "family": "wake",                // null bila bentuk ini hanya punya satu makna
      "title": "〜わけではない",         // bentuk baku, teks polos tanpa markup
      "source": {                      // hasil bunpou:extract; tidak pernah tampil di aplikasi
        "slides": ["n3/deck-a/042.png"],
        "title": "～わけではない",
        "meaning": "bukan berarti",
        "connection": "普通形（ナA-な・N-な/である）＋わけではない",
        "notes": "Menyangkal sebagian; sering bersama 必ずしも atau 別に.",
        "examples": ["…"]              // contoh di slide, teks polos; hanya rujukan
      },
      "extract": {
        "model": "ag/gemini-3.8-flash",
        "promptVersion": "bunpou-extract-v1",
        "extractedAt": "2026-10-02T00:00:00.000Z",
        "doubt": null
      },
      "content": {                     // null sampai gen:bunpou
        "title": "〜わけではない",       // markup furigana; teks polosnya = title di atas
        "senseLabel": null,            // wajib bila family diisi; label tab, mis. "sambil"
        "meaningId": "Bukan berarti …; tidak selalu …",
        "meaningEn": "It doesn't mean that …; not necessarily …",
        "connections": [
          { "form": "v-plain", "pattern": "わけではない" },
          { "form": "i-adj-plain", "pattern": "わけではない" },
          { "form": "na-adj-na", "pattern": "わけではない" },
          { "form": "n-na", "pattern": "わけではない", "note": "juga Nである dalam tulisan" }
        ],
        "variants": ["わけじゃない", "わけでもない"],
        "explanation": [               // 1-4 paragraf, Indonesia + Jepang bermarkup
          "Menyangkal kesimpulan yang wajar ditarik dari situasi …",
          "…"
        ],
        "examples": [
          {
            "jp": "お{金|かね}があれば{幸|しあわ}せになれる__わけではない__。",
            "id": "Punya uang bukan berarti bisa bahagia.",
            "en": "Having money doesn't mean you can be happy."
          }
        ],
        "pitfalls": [
          "Jangan tertukar dengan 〜わけがない (mustahil): …"
        ],
        "tags": ["negation"]           // tanpa tag level
      },
      "ai": {                          // null sampai gen:bunpou
        "model": "cx/gpt-5.6-terra",
        "promptVersion": "bunpou-content-v1",
        "generatedAt": "2026-10-02T00:00:00.000Z",
        "doubt": null
      }
    }
  ]
}
```

Contoh `family` yang melintasi level: ながら "sambil" di `points/n4.json` dan "meskipun" di
`points/n2.json`.

```jsonc
{ "key": "nagara-sambil",   "family": "nagara", "title": "〜ながら",
  "content": { "senseLabel": "sambil", … } }
{ "key": "nagara-meskipun", "family": "nagara", "title": "〜ながら（も）",
  "content": { "senseLabel": "meskipun", … } }
```

### `slides.json`

```jsonc
{
  "slides": [
    {
      "path": "n3/deck-a/042.png",     // relatif dari data/bunpou/slides/
      "sha256": "…",
      "level": "N3",
      "points": ["wake-dewa-nai"],     // kosong bila dilewati
      "skipped": null,                 // alasan bila dilewati: "sampul", "latihan soal", …
      "model": "ag/gemini-3.8-flash",
      "promptVersion": "bunpou-extract-v1",
      "extractedAt": "2026-10-02T00:00:00.000Z"
    }
  ]
}
```

### `comparisons.json`

```jsonc
{
  "comparisons": [
    {
      "key": "alasan-kara-node",       // identitas + URL /bunpou/compare/alasan-kara-node
      "title": "Menyatakan alasan: から dan ので",
      "points": ["kara-alasan", "node"],   // 2-6 key, juga urutan kolom tabel
      "content": {                     // null sampai gen:bunpou-comparisons
        "summary": "…",
        "rows": [
          { "key": "kara-alasan", "nuance": "…", "register": "…", "restriction": "…" },
          { "key": "node", "nuance": "…", "register": "…", "restriction": "…" }
        ],
        "contrasts": [
          {
            "jp": "{危|あぶ}ない[_]、{下|さ}がってください。",
            "id": "Berbahaya, jadi mundurlah.",
            "options": [
              { "key": "kara-alasan", "text": "から", "verdict": "ok" },
              { "key": "node", "text": "ので", "verdict": "ok",
                "note": "Lebih halus; wajar untuk permintaan sopan." }
            ]
          },
          {
            "jp": "{明日|あした}は{雨|あめ}だろう[_]、{傘|かさ}を{持|も}っていこう。",
            "id": "Besok sepertinya hujan, jadi ayo bawa payung.",
            "options": [
              { "key": "kara-alasan", "text": "から", "verdict": "ok" },
              { "key": "node", "text": "ので", "verdict": "wrong",
                "note": "ので tidak bisa mengikuti だろう/でしょう." }
            ]
          }
        ]
      },
      "ai": null,                      // sama dengan ai di pola
      "reviewedAt": null               // diisi manusia setelah meninjau; hanya yang terisi yang terbit
    }
  ]
}
```

### `question-links/<paket>.json` (Fase B)

Nama file sama dengan fixture paketnya, mis. `question-links/n3-2019-12.json`.

```jsonc
{
  "package": "JLPT N3 - 2019年12月",  // TestPackage.name, sama dengan fixture paket
  "questions": [
    {
      "mondaiType": "BUNPOU_GRAMMAR",
      "order": 5,
      "tested": ["wake-dewa-nai"],     // 0-3 key
      "distractors": ["wake-ga-nai"],  // 0-3 key, tidak boleh sama dengan tested
      "confidence": "high",            // high | low
      "note": null,
      "ai": {
        "model": "cx/gpt-5.6-terra",
        "promptVersion": "bunpou-link-v1",
        "generatedAt": "2026-10-02T00:00:00.000Z"
      }
    }
  ]
}
```

## Aturan Identitas

- **`key`**: `^[a-z0-9]+(-[a-z0-9]+)*$`, maksimal 80 karakter, unik di semua level. Gaya yang
  disarankan adalah romaji Hepburn tanpa makron dari bentuk pola tanpa `〜` (`wake-dewa-nai`,
  `ni-kanshite`, `you-ni-naru`); pola dengan beberapa makna memakai `<family>-<makna>` dalam
  bahasa Indonesia (`nagara-sambil`, `bakari-baru-saja`).
- Key boleh diubah bebas **sampai seed pertama**. Setelah itu key permanen karena dirujuk URL,
  kartu SRS, tautan soal, dan perbandingan. Pola yang dibuang di-retire, bukan diganti key-nya.
  Bila pola yang sudah terbit belakangan ternyata punya makna kedua, key lamanya tetap, cukup
  diberi `family`.
- **`family`**: format sama dengan key. Diisi bila ada entri lain dengan bentuk sama tetapi
  makna berbeda; satu family boleh melintasi level. Family yang hanya berisi satu entri memicu
  peringatan.
- **`level`**: dari folder slide. Pola dengan makna sama di dua level masuk level terendah.
  JLPT tidak punya daftar grammar resmi sejak 2010, jadi slide adalah acuan level satu-satunya.
- **`order`**: bilangan bulat unik per level, diisi ekstraksi dari urutan slide; deck yang
  ditambahkan belakangan mendapat nomor setelahnya. Boleh diubah kapan saja karena tidak dirujuk
  data lain.

## Aturan Isi

Ditegakkan validator yang sama di generator **dan** seed. Semua teks Jepang mengikuti
[Markup Teks Jepang](database.md#markup-teks-jepang) dan diperiksa
`prisma/japanese-markup-check.mjs`: setiap kanji berfurigana, tanpa furigana pada kana atau angka,
tanpa HTML/Markdown.

- **`title`**: teks polos `content.title` sama persis dengan `title`.
- **`senseLabel`**: wajib bila `family` diisi dan harus `null` bila tidak. Isinya frasa
  Indonesia huruf kecil, maksimal 30 karakter, unik dalam satu family.
- **`meaningId`, `meaningEn`**: satu kalimat atau frasa, maksimal 160 karakter, tanpa markup.
- **`connections`**: 1-8 item.
  - `form` adalah slug dari daftar bentuk sambungan di taxonomy.
  - `pattern` adalah bagian pola setelah sambungan, tanpa `〜`, boleh bermarkup.
  - `note` opsional dengan maksimal 80 karakter, dan wajib untuk `form: "other"`.
- **`variants`**: 0-6 item bermarkup: bentuk lisan, bentuk berkanji, atau bentuk lain yang
  setara. Teks polosnya unik dan tidak sama dengan `title`.
- **`explanation`**: 1-4 paragraf, masing-masing maksimal 700 karakter, satu baris, tanpa `__`.
  Disimpan sebagai array paragraf karena `JapaneseText` tidak mempertahankan baris baru.
- **`examples`**: 3-5 contoh. Aturan ini juga menjadi bahan kartu kalimat rumpang di Fase C:
  - `jp` satu baris, dengan `__…__` tepat satu kali.
  - `__…__` membungkus **hanya bagian pola** dalam bentuk konjugasinya di kalimat itu, tanpa kata
    sebelumnya: `{知|し}り__ながら__`, bukan `__{知|し}りながら__`.
  - Konteks kalimat dan terjemahan Indonesia harus cukup jelas sehingga bila bagian `__…__`
    dikosongkan, pola ini adalah jawaban yang wajar.
  - `id` dan `en` berupa teks polos dan tidak kosong.
  - Contoh tidak boleh sama dengan `source.examples`; validator membandingkan teks polos tanpa
    spasi dan tanda baca.
- **`pitfalls`**: 0-4 poin, masing-masing maksimal 300 karakter, bermarkup. Boleh memakai ○/✕
  untuk bentuk benar dan salah.
- **`tags`**: slug dari taxonomy, bukan dimensi `level`, dengan jumlah per dimensi sesuai tabel
  di bawah.
- **Perbandingan**:
  - `points` berisi 2-6 key pola yang ada di fixture.
  - `rows` berisi tepat satu baris per pola, dengan urutan yang sama.
  - Setiap kontras punya 2 opsi atau lebih dengan key dari `points`, dan minimal satu opsi
    `verdict: "ok"`.
  - `verdict` bernilai `ok` (○), `awkward` (△), atau `wrong` (✕).
  - Minimal satu kontras harus punya verdict yang berbeda-beda; kalau semuanya sama, kalimat itu
    tidak mempertentangkan apa pun.
  - Kalimat kontras memakai slot `[_]`.

Perbaikan manual cukup dengan mengedit fixture, menjalankan `npm run seed:bunpou:check`, lalu
`npm run seed:bunpou`.

## Taxonomy (draf)

Daftar ini dipindah ke `src/bunpou-data/taxonomy.json` saat implementasi. Setelah itu file
tersebut menjadi satu-satunya sumber, dan bagian ini diringkas menjadi contoh seperti
[seed-flashcard.md](seed-flashcard.md). Slug ditulis dalam bahasa Inggris huruf kecil dan unik
lintas dimensi. `label` (Indonesia) dan `labelJa` dipakai untuk tampilan, sedangkan `description`
dibaca AI sebagai kriteria pemakaian. Penandaan tag sebagai deck SRS ditentukan di Fase C.

| Dimensi | Diisi oleh | Jumlah per pola |
|---|---|---|
| `level` | folder slide | tepat 1 |
| `function` (fungsi) | AI | 1-2 |
| `register` (ragam) | AI | 0-2; pola netral tanpa tag |
| `nuance` (nuansa) | AI | 0-1 |

### Fungsi

| Slug | Label | 日本語 | Contoh pola |
|---|---|---|---|
| `basics` | Struktur dasar | 基本文型 | 〜は〜です, 〜ます, 〜ませんか |
| `particle` | Partikel | 助詞 | は, が, を, に, で, へ, も |
| `reason` | Alasan & sebab | 理由・原因 | から, ので, ため(に), せいで, おかげで |
| `purpose` | Tujuan | 目的 | ために, ように, のに, べく |
| `condition` | Syarat & pengandaian | 条件・仮定 | と, ば, たら, なら, としたら |
| `concession` | Pertentangan & konsesi | 逆接・譲歩 | のに, ても, ながら(も), ものの, にもかかわらず |
| `contrast` | Kontras & perbandingan | 対比・比較 | より, ほど〜ない, に対して, 一方(で), に比べて |
| `result` | Hasil & akhir | 結果 | 結果, あげく, 末(に) |
| `time` | Waktu & urutan | 時・前後 | 前に, てから, うちに, 際(に), 次第 |
| `simultaneous` | Bersamaan & keadaan penyerta | 同時・付帯 | ながら, つつ, ついでに, まま, ずに |
| `aspect` | Aspek: mulai, sedang, selesai | アスペクト | ている, ところだ, たばかり, かけ, てしまう, たことがある |
| `change` | Perubahan | 変化 | ようになる, くなる, ことになる, 一方だ, つつある |
| `correlation` | Seiring & sebanding | 相関 | につれて, に伴って, ば〜ほど, にしたがって |
| `conjecture` | Dugaan & kepastian | 推量・確信 | だろう, かもしれない, はずだ, に違いない |
| `hearsay` | Kabar & kutipan | 伝聞・引用 | そうだ, らしい, という, とのことだ |
| `appearance` | Kesan & perumpamaan | 様態・比喩 | そうだ, ようだ, みたいだ, っぽい, まるで |
| `tendency` | Kecenderungan | 傾向 | がちだ, 気味, やすい, きらいがある |
| `intention` | Niat & keputusan | 意志・決定 | つもり, (よ)うと思う, ことにする, まい |
| `desire` | Keinginan | 希望 | たい, てほしい, がる |
| `obligation` | Keharusan | 義務・必要 | なければならない, べきだ, ざるを得ない |
| `permission` | Izin & larangan | 許可・禁止 | てもいい, てはいけない, べからず |
| `request` | Permintaan & perintah | 依頼・命令 | てください, なさい, ように言う, こと |
| `suggestion` | Ajakan & saran | 勧誘・助言 | ましょう, たらどう, ほうがいい, ことだ |
| `possibility` | Kemampuan & kemungkinan | 可能・可能性 | ことができる, 得る, かねない, おそれがある |
| `giving-receiving` | Memberi & menerima | 授受 | てあげる, てくれる, てもらう |
| `keigo` | Keigo | 敬語 | お〜になる, お〜する, させていただく |
| `voice` | Pasif & kausatif | 受身・使役 | られる, させる, させられる |
| `topic` | Topik & sudut pandang | 話題・立場 | について, に関して, にとって, として |
| `basis` | Dasar, sarana & acuan | 基準・根拠・手段 | に基づいて, をもとに, によって, を通じて |
| `range` | Rentang & cakupan | 範囲 | から〜にかけて, にわたって, を限りに |
| `degree` | Tingkat & ukuran | 程度 | ほど, くらい, すぎる, きる |
| `limitation` | Pembatasan | 限定 | だけ, しか〜ない, ばかり, に限り, のみ |
| `addition` | Penambahan | 累加 | うえ(に), ばかりか, のみならず, はもとより |
| `emphasis` | Penekanan | 強調 | こそ, さえ, まで, なんて |
| `example` | Contoh & daftar | 例示・列挙 | たり〜たり, とか, など, にしても〜にしても |
| `negation` | Penyangkalan | 否定・部分否定 | わけではない, とは限らない, わけがない, ないことはない |
| `regardless` | Tanpa memandang | 無関係 | にかかわらず, を問わず, もかまわず |
| `feeling` | Perasaan & seruan | 感情・感嘆 | てたまらない, てしょうがない, ことか |
| `judgment` | Penilaian & pendapat | 判断・評価 | にすぎない, というものだ, に越したことはない, ものだ |
| `conjunction` | Kata sambung | 接続詞 | しかし, それで, ところが, そのうえ |

### Ragam dan Nuansa

| Slug | Dimensi | Label | 日本語 | Contoh pola |
|---|---|---|---|---|
| `casual` | register | Santai | くだけた表現 | ちゃう, って, じゃん |
| `polite` | register | Sopan | 丁寧 | ませんか, でしょうか |
| `formal` | register | Resmi & bisnis | 改まった表現 | にあたって, につき |
| `written` | register | Ragam tulisan | 書き言葉 | つつ, べく, ゆえ(に) |
| `literary` | register | Klasik & sastrawi | 文語的 | べからず, んがため, ずとも |
| `negative` | nuance | Bernuansa negatif | マイナス評価 | せいで, くせに, あげく, がち |
| `positive` | nuance | Bernuansa positif | プラス評価 | おかげで, だけあって |

### Bentuk Sambungan

Disimpan di taxonomy sebagai daftar terpisah (`connectionForms`), bukan tag. Seed menurunkan
filter "sambungan" dari `content.connections`.

| Slug | Label | 日本語 | Contoh |
|---|---|---|---|
| `v-dict` | Kata kerja bentuk kamus | V辞書形 | 行く |
| `v-masu` | Kata kerja bentuk ます tanpa ます | Vます形 | 行き |
| `v-te` | Kata kerja bentuk て | Vて形 | 行って |
| `v-ta` | Kata kerja bentuk た | Vた形 | 行った |
| `v-nai` | Kata kerja bentuk ない | Vない形 | 行かない |
| `v-nai-stem` | Bentuk ない tanpa ない | Vない形−ない | 行か |
| `v-ba` | Kata kerja bentuk ば | V仮定形 | 行けば |
| `v-vol` | Kata kerja bentuk ajakan | V意向形 | 行こう |
| `v-plain` | Kata kerja bentuk biasa | V普通形 | 行く・行かない・行った・行かなかった |
| `i-adj` | Kata sifat-i | イA | 高い |
| `i-adj-stem` | Kata sifat-i tanpa い | イA−い | 高 |
| `i-adj-ku` | Kata sifat-i bentuk く | イAく | 高く |
| `i-adj-plain` | Kata sifat-i bentuk biasa | イA普通形 | 高い・高くない・高かった |
| `na-adj-stem` | Kata sifat-na | ナA | 静か |
| `na-adj-na` | Kata sifat-na + な | ナAな | 静かな |
| `na-adj-plain` | Kata sifat-na bentuk biasa | ナA普通形 | 静かだ・静かではない・静かだった |
| `na-adj-de-aru` | Kata sifat-na + である | ナAである | 静かである |
| `n` | Nomina | N | 学生 |
| `n-no` | Nomina + の | Nの | 学生の |
| `n-na` | Nomina + な | Nな | 学生な |
| `n-plain` | Nomina bentuk biasa | N普通形 | 学生だ・学生ではない・学生だった |
| `n-de-aru` | Nomina + である | Nである | 学生である |
| `plain` | Bentuk biasa semua kelas kata | 普通形 | 行く・高い・静かだ・学生だ |
| `plain-mod` | Bentuk biasa, tapi ナA+な dan N+の | 普通形（ナAな・Nの） | 行く・高い・静かな・学生の |
| `sentence` | Kalimat atau klausa utuh | 文 | termasuk bentuk sopan |
| `question-word` | Kata tanya | 疑問詞 | 何, どこ, いつ |
| `quantity` | Bilangan & jumlah | 数量詞 | 三人, 一度 |
| `other` | Lainnya (wajib `note`) | — | — |

`plain` dan `plain-mod` adalah singkatan untuk pola yang menerima keempat kelas kata. Bila
sambungan satu kelas kata berbeda dari singkatan itu, tulis bentuknya satu per satu.
