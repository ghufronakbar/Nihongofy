# Data Bunpou: Slide → Katalog Pola → Database

Kontrak data katalog pola kalimat (文法) untuk `/bunpou`. Rancangan modulnya ada di
[module/bunpou.md](module/bunpou.md). Katalog ini milik aplikasi (lisensi: **Nihongofy**); user
tidak bisa menambah konten sendiri.

> **Status (2 Oktober 2026):** kontrak dan pipeline Phase A sudah diimplementasikan. Seluruh 36
> slide N5 telah diekstraksi dan ditulis menjadi 90 point tervalidasi tanpa doubt/pending.
> Migration belum diterapkan dan `seed:bunpou` belum dijalankan ke database.

Slide hanya **acuan**: dari slide diambil daftar pola, level, makna yang dimaksud, dan
sambungannya. Penjelasan dan contoh kalimat di slide tidak pernah tampil di aplikasi; isi yang
tampil ditulis ulang AI, sama seperti `.apkg` di flashcard yang dipakai hanya sebagai daftar kata.

```bash
npm run bunpou:extract
```

```bash
npm run bunpou:import-text
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
| `bunpou:extract` | `data/bunpou/raw_images/` + `slides.json` + fixture pola | fixture pola (entri baru), `slides.json` | tidak | A |
| `bunpou:import-text` | `text-sources/*.json` + taxonomy + fixture pola | fixture pola (identitas dan source ternormalisasi) | tidak | A |
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

`--reasoning-effort` bawaannya `high` untuk semua langkah. Gateway telah diverifikasi meneruskan
input gambar (`image_url` berisi data URL base64) ke `BUNPOU_EXTRACT_MODEL`; ekstraksi N5 selesai
tanpa kegagalan batch.

## Struktur File

```
data/bunpou/raw_images/<deck>/<deck>-<nomor>.<ext>  ← diisi pemilik project, di-gitignore
src/bunpou-data/
  taxonomy.json                  ← daftar section, tag, dan bentuk sambungan
  slides.json                    ← catatan slide yang sudah diekstraksi
  text-sources/*.json            ← indeks teks/video, URL, timestamp, dan guidance manusia
  points/n5.json … n1.json       ← katalog pola, satu file per level
  comparisons.json               ← perbandingan pola mirip
  question-links/<paket>.json    ← tautan soal JLPT → pola (Fase B)
```

## Menyiapkan Slide (untuk pengumpul data)

- **Satu deck per subfolder langsung di bawah `raw_images/`**, mis.
  `data/bunpou/raw_images/n5-bunpou/`. Nama folder deck berupa slug huruf kecil, angka, dan `-`,
  serta wajib diawali level: `n5-`, `n4-`, `n3-`, `n2-`, atau `n1-`.
- **Level ditentukan oleh awalan folder deck**, bukan oleh AI. Semua gambar dalam
  `raw_images/n5-bunpou/` adalah sumber N5. Nama folder lengkap (`n5-bunpou`) menjadi identitas
  deck di manifest dan flag CLI.
- **Nama file mengikuti `<deck>-<nomor>.<ext>`**, mis. `n5-bunpou-1.png`,
  `n5-bunpou-2.png`, …. Prefix file harus sama dengan nama folder deck. Script mengambil
  bilangan terakhir sebelum ekstensi dan mengurutkannya secara numerik; nol di depan boleh
  dipakai tetapi tidak diwajibkan. Nomor yang sama dalam satu deck adalah error.
- Format PNG, JPG, atau WebP; **satu slide per gambar** (PowerPoint: *File → Export → PNG*).
  Lebar minimal ±1280 px supaya furigana kecil tetap terbaca.
- Slide sampul, daftar isi, latihan soal, atau kuis boleh ikut. Ekstraksi melewatinya dan
  mencatat alasannya di `slides.json`.
- Pola yang sama di dua deck atau dua level tidak masalah. Duplikasi dalam level yang sama diaudit,
  sedangkan kemunculan lintas level boleh tetap menjadi entri terpisah.
- Folder `data/bunpou/raw_images/` tidak di-commit. Path yang disimpan di fixture selalu relatif
  dari root tersebut, mis. `n5-bunpou/n5-bunpou-7.png`.

## Langkah 1 — Ekstraksi Slide (`bunpou:extract`)

Model vision menyalin isi slide **apa adanya** ke `source`, lalu memecahnya menjadi entri pola.

- Satu request berisi beberapa slide target berurutan dari satu deck (bawaan 6). Deck diproses
  paralel, sedangkan slide di dalam satu deck berurutan, dan model menerima daftar pola yang sudah
  diekstraksi dari deck itu. Opsi `--context-size` turut mengirim beberapa slide tepat sebelum
  batch sebagai referensi visual tanpa mengekstraknya ulang. Dengan begitu pola yang melintasi
  batas batch tetap dapat memakai key dan entri yang sama.
- Satu slide boleh menghasilkan beberapa entri (mis. ながら "sambil" dan "meskipun" dalam satu
  slide), dan satu entri boleh berasal dari beberapa slide.
- Slide yang hanya berupa daftar kosakata tidak dipaksakan menjadi pola. Slide sistem dasar
  seperti konjugasi boleh menjadi entri `foundation` atau `conjugation` bila memang dibutuhkan
  sebagai materi referensi.
- Slide dikenali dari isi filenya (sha256) di `slides.json`. Slide yang sudah tercatat dilewati,
  termasuk bila filenya dipindah atau diganti nama, jadi script aman dijalankan berulang setelah
  slide baru ditambahkan.
- Urutan deck dicatat permanen di `slides.json` saat pertama ditemukan. Deck baru ditempatkan
  setelah deck terakhir pada level yang sama; urutan tidak bergantung pada hasil pembacaan folder
  filesystem.
- Model mengusulkan `key`, `kind`, `sectionKey`, `family`, dan `title` baku. Script memastikan
  identitasnya sah dan `sectionKey` ada di taxonomy.
- `source` hanya berisi apa yang tertulis di slide. Model tidak boleh menambah informasi dari
  pengetahuannya sendiri di langkah ini; itu tugas langkah 2.
- `extract.doubt` diisi bila slide tidak terbaca, isinya janggal, atau polanya tampak bukan level
  folder tersebut. Level tetap mengikuti folder.
- **Calon duplikat dalam level yang sama** diaudit sebelum generation. Bila bentuk dan maknanya
  sama, gabungkan evidence slide ke satu entri. Bila bentuknya sama tetapi maknanya berbeda,
  pisahkan menjadi beberapa entri dengan `family` dan `content.senseLabel` yang berbeda.
- Kemunculan pola yang sama pada level berbeda **bukan duplikat yang harus digabung**. Setiap
  entri tetap mengikuti level slide sumber karena pembagian bunpou per JLPT tidak memiliki acuan
  resmi tunggal dan UI menampilkan katalog berdasarkan level. Gunakan `key` global yang berbeda;
  jangan menciptakan perbedaan makna hanya agar kedua entri tampak berbeda.

| Flag | Fungsi |
|---|---|
| `--level N3` | Satu level saja |
| `--deck n5-bunpou` | Satu deck saja |
| `--limit 3` | Maksimal jumlah slide baru; berguna untuk uji gateway awal |
| `--batch-size 6` | Slide per request (1-10) |
| `--context-size 0` | Slide sebelumnya sebagai konteks visual (0-10); tidak diekstrak ulang |
| `--concurrency 4` | Deck yang diproses paralel |
| `--dry-run` | Cetak prompt dan daftar slide tanpa memanggil model |
| `--reasoning-effort high` | Diteruskan ke model |

Untuk mengulang sebuah slide sebelum seed pertama, hapus catatannya di `slides.json` beserta
entri pola yang hanya berasal dari slide itu, lalu jalankan ulang.

## Langkah 2 — Generate Isi (`gen:bunpou`)

Sebelum generation, point dapat berasal dari ekstraksi slide atau importer teks. Source teks memakai
`evidenceScope: "identity-only"`: URL dan timestamp membuktikan cakupan serta urutan materi, sedangkan
judul baku, pemisahan sense, dan sambungan dinormalisasi model dengan guidance manusia. Importer tidak
menghasilkan konten publik.

```bash
npm run bunpou:import-text -- --source n2-48-days --limit 4 --batch-size 1 --concurrency 3
```

Importer aman dijalankan ulang karena item yang sudah direferensikan fixture dilewati. Gunakan
`--overwrite` untuk menormalisasi ulang item yang dipilih, serta `--day` atau `--key` untuk membatasi
source. Setelah identitas diaudit, jalankan `gen:bunpou` seperti biasa.

Model teks menulis `content` dari identitas pola, `source`, dan taxonomy. Hanya entri yang
`content`-nya masih `null` yang diproses.

- Model juga menerima entri lain dengan `family` yang sama atau judul ternormalisasi yang sama
  (key, judul, level, `source.meaning`). Anggota dengan makna berbeda harus memiliki penjelasan dan
  `senseLabel` yang tidak tumpang tindih. Entri pada level berbeda boleh menjelaskan sense yang
  sama dan memakai `senseLabel` yang sama; model tidak boleh menciptakan perbedaan tanpa dukungan
  source.
- Jawaban divalidasi per entri ([Aturan Isi](#aturan-isi)). Entri yang gagal diminta ulang dengan
  daftar masalahnya (maksimal 3 percobaan); entri lain dalam batch tetap disimpan.
- Fixture ditulis atomik setelah setiap batch, jadi proses boleh dihentikan kapan saja.
- Generation ulang mengosongkan `review`, sehingga hasil yang berubah tidak tetap terlihat sudah
  ditinjau.
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

`npm run bunpou:doubts` menampilkan semua `extract.doubt` dan `ai.doubt`. Penyelesaiannya manual:
perbaiki identitas/content bila perlu, kosongkan doubt setelah ditinjau, lalu isi `review` dengan
waktu dan catatan keputusan. Perubahan source atau generation ulang akan mengosongkan review.

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
- Retirement hanya berlaku pada level yang memiliki deck di `slides.json`, sehingga seed N5
  bertahap tidak memensiunkan katalog N4-N1 yang belum sedang diproses.
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
      "kind": "pattern",               // pattern | particle | conjugation | foundation
      "sectionKey": "sentence-patterns", // kelompok belajar dari taxonomy.sections
      "family": "wake",                // null bila bentuk ini hanya punya satu makna
      "title": "〜わけではない",         // bentuk baku, teks polos tanpa markup
      "source": {                      // hasil bunpou:extract; tidak pernah tampil di aplikasi
        "slides": ["n3-bunpou/n3-bunpou-42.png"],
        "title": "～わけではない",
        "meaning": "bukan berarti",
        "connection": "普通形（ナA-な・N-な/である）＋わけではない",
        "formation": [],               // aturan/perubahan yang tertulis di slide; teks polos
        "notes": "Menyangkal sebagian; sering bersama 必ずしも atau 別に.",
        "examples": ["…"]              // contoh di slide, teks polos; hanya rujukan
      },
      "extract": {
        "model": "ag/gemini-3.8-flash",
        "promptVersion": "bunpou-extract-v2",
        "extractedAt": "2026-10-02T00:00:00.000Z",
        "doubt": null
      },
      "content": {                     // null sampai gen:bunpou
        "title": "〜わけではない",       // markup furigana; teks polosnya = title di atas
        "senseLabel": "penyangkalan sebagian", // wajib karena family diisi
        "meaningId": "Bukan berarti …; tidak selalu …",
        "meaningEn": "It doesn't mean that …; not necessarily …",
        "connections": [
          { "form": "v-plain", "pattern": "わけではない" },
          { "form": "i-adj-plain", "pattern": "わけではない" },
          { "form": "na-adj-na", "pattern": "わけではない" },
          { "form": "n-na", "pattern": "わけではない", "note": "juga Nである dalam tulisan" }
        ],
        "formation": [],               // aturan transformasi; biasanya kosong untuk pattern biasa
        "variants": ["わけじゃない", "わけでもない"],
        "explanation": [               // 1-4 paragraf, Indonesia + Jepang bermarkup
          "Menyangkal kesimpulan yang wajar ditarik dari situasi …",
          "…"
        ],
        "examples": [                  // contoh dipersingkat; fixture nyata wajib 3-5
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
        "promptVersion": "bunpou-content-v4",
        "generatedAt": "2026-10-02T00:00:00.000Z",
        "doubt": null
      },
      "review": null                   // atau { reviewedAt, note } setelah koreksi manusia
    }
  ]
}
```

Contoh entri sistem konjugasi yang membutuhkan `formation`:

```jsonc
{
  "key": "potential-form",
  "order": 36,
  "kind": "conjugation",
  "sectionKey": "verb-forms",
  "family": null,
  "title": "可能形",
  "content": {
    "title": "{可能形|かのうけい}",
    "senseLabel": null,
    "meaningId": "Bentuk kata kerja untuk menyatakan kemampuan atau kemungkinan.",
    "meaningEn": "A verb form expressing ability or possibility.",
    "connections": [],
    "formation": [
      {
        "label": "Godan berakhiran く",
        "input": "{書|か}く",
        "rule": "く → ける",
        "output": "{書|か}ける",
        "note": null
      },
      {
        "label": "Ichidan",
        "input": "{食|た}べる",
        "rule": "る → られる",
        "output": "{食|た}べられる",
        "note": null
      }
    ],
    "variants": [],
    "explanation": ["…"],
    "examples": [                      // contoh dipersingkat; fixture nyata wajib 3-5
      {
        "jp": "{私|わたし}は{漢字|かんじ}が__{読|よ}める__。",
        "id": "Saya bisa membaca kanji.",
        "en": "I can read kanji."
      }
    ],
    "pitfalls": [],
    "tags": ["possibility"]
  }
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
  "decks": [
    {
      "key": "n5-bunpou",
      "level": "N5",
      "order": 1
    }
  ],
  "slides": [
    {
      "path": "n5-bunpou/n5-bunpou-7.png", // relatif dari data/bunpou/raw_images/
      "sha256": "…",
      "level": "N5",
      "deck": "n5-bunpou",
      "sequence": 7,
      "points": ["ni-location", "de-location"], // kosong bila dilewati
      "skipped": null,                 // alasan bila dilewati: "sampul", "latihan soal", …
      "model": "ag/gemini-3.8-flash",
      "promptVersion": "bunpou-extract-v2",
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
  peringatan. `senseLabel` wajib unik dalam family pada level yang sama, tetapi boleh sama pada
  level berbeda ketika slide memang mengulang sense yang sama.
- **`kind`**: bentuk materi dan kontrak rendering detail:
  - `pattern`: pola kalimat atau ungkapan dengan sambungan tertentu.
  - `particle`: satu fungsi dari sebuah partikel; fungsi lain menjadi entri lain dalam `family`
    yang sama.
  - `conjugation`: sistem perubahan bentuk yang membutuhkan `formation`.
  - `foundation`: konsep dasar yang tetap berguna sebagai referensi tetapi bukan satu pola,
    misalnya sistem predikat adjektiva. Daftar kosakata murni tidak masuk katalog.
- **`sectionKey`**: slug dari `taxonomy.sections`. Ini kelompok belajar/navigasi, bukan tag
  semantik. Semua entri wajib punya tepat satu section.
- **`level`**: dari folder slide. Pola dengan makna sama boleh memiliki entri terpisah bila muncul
  pada slide level berbeda. JLPT tidak punya daftar grammar resmi sejak 2010, jadi slide adalah
  acuan penempatan level dan UI dapat menyajikan katalog berdasarkan level yang dipilih pengguna.
- **`order`**: bilangan bulat unik per level. Urutan gambar dalam deck memakai `sequence` numerik
  dari nama file. Urutan pola diturunkan ulang dari `decks[].order`, `slides[].sequence`, lalu
  posisi key dalam `slides[].points`; untuk entri yang muncul di beberapa slide dipakai kemunculan
  pertama. Hasil akhirnya dinomori berurutan mulai 1 per level. `order` boleh berubah saat sumber
  ditambah karena tidak dirujuk data lain.
- **`review`**: `null` untuk hasil yang belum membutuhkan koreksi manusia, atau objek
  `{ reviewedAt, note }` untuk menyimpan keputusan ketika doubt telah diselesaikan. Audit ini ikut
  disimpan ke database, tetapi tidak menjadi konten publik.

## Aturan Isi

Ditegakkan validator yang sama di generator **dan** seed. Semua teks Jepang mengikuti
[Markup Teks Jepang](database.md#markup-teks-jepang) dan diperiksa
`prisma/japanese-markup-check.mjs`: setiap kanji berfurigana, tanpa furigana pada kana atau angka,
tanpa HTML/Markdown.

- **`title`**: teks polos `content.title` sama persis dengan `title`.
- **`senseLabel`**: wajib bila `family` diisi dan harus `null` bila tidak. Isinya frasa
  Indonesia huruf kecil, maksimal 30 karakter, unik dalam satu family.
- **`meaningId`, `meaningEn`**: satu kalimat atau frasa, maksimal 160 karakter, tanpa markup;
  `meaningId` wajib Indonesia dan `meaningEn` wajib Inggris.
- **`connections`**: 0-8 item; wajib minimal satu untuk `kind: "pattern"`, boleh kosong untuk
  `particle`, `conjugation`, atau `foundation` bila konsepnya tidak mempunyai sambungan pola.
  - `form` adalah slug dari daftar bentuk sambungan di taxonomy.
  - `pattern` adalah bagian pola setelah sambungan, tanpa `〜`, boleh bermarkup.
  - `note` opsional dengan maksimal 120 karakter, dan wajib untuk `form: "other"`.
- **`formation`**: 0-24 baris aturan transformasi. Wajib minimal satu untuk
  `kind: "conjugation"`; biasanya kosong untuk `pattern` dan `particle`.
  - `label`: kelas atau nama transformasi, maksimal 80 karakter, teks polos.
  - `input`, `rule`, `output`: wajib dan masing-masing maksimal 120 karakter; `input` dan
    `output` memakai markup Jepang, sedangkan `rule` berupa deskripsi ringkas seperti
    `く → ける`.
  - `note`: opsional, maksimal 160 karakter, boleh bermarkup.
  - `source.formation` memakai field yang sama tetapi berupa teks polos yang hanya menyalin
    informasi pada slide. `content.formation` adalah versi baku bermarkup yang boleh memperjelas
    notasi tanpa mengubah aturan sumber.
- **`variants`**: 0-6 item bermarkup: bentuk lisan, bentuk berkanji, atau bentuk lain yang
  setara. Teks polosnya unik dan tidak sama dengan `title`.
- **`explanation`**: 1-6 paragraf, masing-masing maksimal 700 karakter, satu baris, tanpa `__`.
  Disimpan sebagai array paragraf karena `JapaneseText` tidak mempertahankan baris baru.
- **`usage`**: objek opsional dengan kelompok `nuance`, `register`, `restrictions`, dan
  `typicalContexts`. Field ini wajib untuk N2/N1 agar nuansa pragmatis tidak tercampur ke penjelasan
  umum tanpa struktur.
- **`examples`**: 3-7 contoh. N2/N1 wajib minimal 5. Aturan ini juga menjadi bahan kartu kalimat rumpang di Fase C:
  - `jp` satu baris, dengan `__…__` tepat satu kali.
  - `__…__` membungkus **hanya bagian pola** dalam bentuk konjugasinya di kalimat itu, tanpa kata
    sebelumnya: `{知|し}り__ながら__`, bukan `__{知|し}りながら__`.
  - Konteks kalimat dan terjemahan Indonesia harus cukup jelas sehingga bila bagian `__…__`
    dikosongkan, pola ini adalah jawaban yang wajar.
  - `id` dan `en` berupa teks polos dan tidak kosong.
  - Contoh tidak boleh sama dengan `source.examples`; validator membandingkan teks polos tanpa
    spasi dan tanda baca.
- **`pitfalls`**: 0-5 poin, masing-masing maksimal 300 karakter, bermarkup. N2/N1 wajib minimal 2.
  Boleh memakai ○/✕
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

Daftar section, tag, dan bentuk sambungan ini dipindah ke `src/bunpou-data/taxonomy.json` saat
implementasi. Setelah itu file tersebut menjadi satu-satunya sumber, dan bagian ini diringkas
menjadi contoh seperti [seed-flashcard.md](seed-flashcard.md). Slug ditulis dalam bahasa Inggris
huruf kecil dan unik lintas dimensi. `label` (Indonesia) dan `labelJa` dipakai untuk tampilan,
sedangkan `description` dibaca AI sebagai kriteria pemakaian. Penandaan tag sebagai deck SRS
ditentukan di Fase C.

### Section Pembelajaran

Section menentukan kelompok dan navigasi materi, bukan makna linguistik. Urutan entri tetap
memakai `order`; setiap item taxonomy section menyimpan `key`, `order`, `label`, `labelJa`, dan
`description` agar UI dan prompt tidak menebaknya dari tag.

| Key | Label | 日本語 |
|---|---|---|
| `foundations` | Dasar kalimat | 基礎 |
| `adjectives` | Kata sifat | 形容詞・形容動詞 |
| `verb-forms` | Bentuk kata kerja | 動詞活用 |
| `particles` | Partikel | 助詞 |
| `question-expressions` | Ungkapan tanya | 疑問表現 |
| `time-and-sequence` | Waktu dan urutan | 時間・順序 |
| `comparison` | Perbandingan | 比較 |
| `conjunctions-adverbs` | Kata sambung dan adverbia | 接続詞・副詞 |
| `sentence-patterns` | Pola kalimat | 文型 |

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
