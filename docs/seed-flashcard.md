# Data Flashcard: Daftar Kata → Isi Kartu AI → Database

Kontrak data katalog kosakata flashcard. Katalog ini milik aplikasi (lisensi: **Nihongofy**);
user tidak bisa menambah konten sendiri. Desain modulnya ada di
[module/flashcard.md](module/flashcard.md).

```bash
npm run flashcard:extract
```

```bash
npm run gen:flashcard
```

```bash
npm run seed:flashcard:check
```

```bash
npm run seed:flashcard
```

| Langkah | Membaca | Menulis | Database |
|---|---|---|---|
| `flashcard:extract` | `data/anki/exported_anki.apkg` | `src/flashcard-data/vocab/<level>.json` | tidak |
| `gen:flashcard` | fixture + taxonomy | fixture (field `content` dan `ai`) | tidak |
| `flashcard:doubts` | fixture | — | tidak |
| `fix:flashcard-doubts` | fixture + taxonomy | rencana, lalu fixture (`--apply`) | tidak |
| `seed:flashcard` | fixture + taxonomy | — | ya |

## Taxonomy Tag

`src/flashcard-data/taxonomy.json` adalah **satu-satunya** daftar tag yang sah. Prompt AI,
validator, seed, dan aplikasi membacanya langsung, jadi tag cukup diubah di satu tempat.

| Dimensi | Diisi oleh | Jumlah per kata | Contoh slug |
|---|---|---|---|
| `level` | ekstraksi (bukan AI) | tepat 1 | `n5` … `n1` |
| `pos` (kelas kata) | AI | 1-2 | `noun`, `verb-godan`, `verb-suru`, `na-adjective`, `counter`, `expression` |
| `register` (ragam bahasa) | AI | 0-2 | `formal`, `polite`, `honorific`, `humble`, `casual`, `written` |
| `category` (kategori) | AI | 0-2 | `onomatopoeia`, `idiom`, `yojijukugo`, `loanword`, `usually-kana` |
| `topic` (topik) | AI | 0-3 | `food`, `family`, `work`, `health`, `economy`, `law`, … (39 topik) |

- Slug huruf kecil berbahasa Inggris dan unik lintas dimensi; `label` (Indonesia) dan `labelJa`
  untuk tampilan; `description` dibaca AI sebagai kriteria pemakaian tag.
- Tag dengan `deck: true` menjadi deck bawaan (semua level, semua topik, dan sebagian
  kategori). Deck tampil bila kata terbitnya minimal `deckMinNotes` (10).
- Mengganti atau menghapus slug membuat kata yang sudah memakainya gagal validasi seed. Generate
  ulang kata-kata itu (`--key` atau `--overwrite`) setelah mengubah taxonomy.

## Langkah 1 — Ekstraksi Daftar Kata

`.apkg` dipakai **hanya sebagai daftar kata**: tulisan kata, bacaan, level, dan urutan belajarnya.
Arti, contoh kalimat, dan audio dari deck sumber dibuang. Glos bahasa Inggrisnya hanya diteruskan
ke AI sebagai `hints` untuk menunjukkan makna mana yang dimaksud.

- Format modern: zip berisi `collection.anki21b` (SQLite terkompresi zstd). `collection.anki2`
  di dalamnya hanya stub. Note type harus punya field `word` dan `wordFurigana`; `wordEng`
  opsional.
- Furigana format Anki (`考[かんが]える`) diubah menjadi bacaan. Kasus sumber yang ditangani:
  nomor makna `[1]`, bacaan alternatif `人気[じんき<br>にんき]`, anotasi `(する)`/`（おかねを）`,
  penanda kelas kata di luar kurung (`駄目[だめ]な`), kana yang tertelan (`口[くち]が軽[かる]い`),
  furigana yang sudah mencakup kana awal (`お茶[おちゃ]`, `あっという 間[あっというま]`,
  `ヶ月[かげつ]`), dan `中[なか]々`.
- `[×なに]` di tulisan kata berarti "bukan dibaca なに"; ini diteruskan sebagai petunjuk.
- **Penggabungan**: satu entri per pasangan (tulisan, bacaan). Kata yang muncul di beberapa level
  masuk ke **level termudah**, dan beberapa makna digabung menjadi satu kartu.
- **Homograf** (tulisan sama, bacaan beda, mis. 今日 きょう/こんにち) tetap kata terpisah, dan
  bacaan lainnya dicatat di `homographs` supaya AI menyebutnya di catatan.
- `readingUncertain: true` bila bacaan sumber tidak bisa dipercaya (bacaan alternatif, kanji
  tidak tertutup furigana, angka). Validator tidak membandingkan bacaan kata seperti ini.
- **Key** (`"食事|しょくじ"`) adalah identitas kata yang dirujuk progres user. Ekstraksi ulang
  mempertahankan `content`/`ai` kata yang sama, dan bila key berubah, key lama dipakai lagi lewat
  `sourceGuids`. Jangan mengubah key secara manual.

Hasil ekstraksi deck sumber (7.718 note): 6.697 kata — N5 1.051, N4 703, N3 1.788, N2 1.453,
N1 1.702; 594 kata muncul di lebih dari satu level, 76 entri homograf, 140 bacaan tidak pasti.

## Langkah 2 — Generate Isi Kartu (AI)

Mengikuti pola `gen:explanation`: memakai gateway `EXPLANATION_BASE_URL` dan
`EXPLANATION_API_KEY`, dengan model `FLASHCARD_MODEL` (fallback `EXPLANATION_MODEL`). Hanya kata
yang `content`-nya masih `null` yang diproses, jadi script aman dijalankan berulang.

| Flag | Fungsi |
|---|---|
| `--level N5` | Satu level saja |
| `--limit 100` | Maksimal jumlah kata |
| `--key "食事\|しょくじ"` | Kata tertentu (boleh diulang) |
| `--batch-size 20` | Kata per request (1-30, bawaan 20); prompt taxonomy cukup panjang, jadi batch besar menghemat token input |
| `--concurrency 6` | Request paralel (1-16, bawaan 6), dipakai bersama oleh semua level |
| `--overwrite` | Menimpa kata yang sudah terisi |
| `--only-doubts` | Hanya kata bertanda ragu (pakai bersama `--overwrite`) |
| `--dry-run` | Cetak prompt tanpa memanggil model |
| `--reasoning-effort low` | Diteruskan ke model reasoning |

- Prompt ada di `prisma/flashcard-vocab-prompt.mjs` (`PROMPT_VERSION`). Daftar tag di prompt
  dibangun dari taxonomy.
- Jawaban diminta sebagai JSON di dalam teks (bukan `response_format`), lalu divalidasi per kata.
  Kata yang gagal diminta ulang dengan daftar masalahnya (maksimal 3 percobaan); kata lain dalam
  batch tetap disimpan.
- Fixture ditulis atomik setelah setiap batch, jadi proses boleh dihentikan kapan saja.
- Log per batch menampilkan progres dan perkiraan sisa waktu. Baris `DITOLAK` berisi alasan kata
  ditolak validator dan diminta ulang otomatis dalam run yang sama; baris `LOLOS` menandai kata
  yang akhirnya lolos dan sudah tersimpan, sedangkan `FAIL` menandai kata yang tetap gagal setelah
  3 percobaan (hanya kata ini yang perlu run ulang). Setiap percobaan ulang menambah satu request
  penuh, jadi alasan yang sering muncul adalah tanda aturan prompt perlu dipertegas.
- Batch yang gagal (mis. 429 dari gateway setelah 4 kali dicoba ulang oleh SDK) hanya membuat
  katanya tetap kosong. Jalankan ulang perintah yang sama, atau turunkan `--concurrency`.
- `doubt` diisi AI bila masukan janggal (bacaan sumber keliru, salah ketik). Tinjau dengan
  `npm run flashcard:doubts`, lalu selesaikan dengan `fix:flashcard-doubts` (di bawah).

### Kecepatan dan Percobaan Ulang

Satu kata yang gagal validasi membuat batch-nya mengirim request kedua (berisi percakapan
sebelumnya, jadi token inputnya kira-kira dua kali lipat), walau yang ditulis ulang hanya kata
yang gagal. Dengan batch 20, tingkat gagal 10% per kata sudah membuat hampir setiap batch
mengulang. Diukur 1 Oktober 2026 dengan `ag/gemini-3.8-flash`:

| Setelan | Hasil |
|---|---|
| batch 10, paralel 2, prompt v1 | 50 kata ±56 detik; 4 dari 5 batch mengulang |
| batch 10, paralel 6, prompt v2 | 60 kata 22 detik; 3 kata mengulang; 67k token input |
| batch 20, paralel 3, prompt v2 | 60 kata 19 detik; 3 kata mengulang; 31k token input |
| batch 20, paralel 12, prompt v2, `--reasoning-effort high` | 2×200 kata; 28 dan 21 kata mengulang (8-9 dari 10 batch); 158k dan 141k token input |
| batch 20, paralel 12, prompt v3, `--reasoning-effort high` | 200 kata 28 detik; 4 kata mengulang (2 dari 10 batch); 112k token input |

- Prompt v1: model menukar penanda `__` dengan kurung furigana pada kata berawalan お
  (`__痛|いた__` alih-alih `__{痛|いた}__`). Prompt v2 menyebut bentuk benar dan salahnya.
- Prompt v2: sekitar dua pertiga kegagalan adalah kanji tanpa furigana pada kata lain di contoh
  atau notes, terutama kanji umum seperti 私, 何, 一緒. Sisanya `{明日}` tanpa bacaan, furigana
  pada kana/angka (`{よん|よん}`, `{1|いち}`), dan aksara Tionghoa (`买`). Prompt v3 menambahkan
  aturan untuk masing-masing, daftar periksa di akhir system prompt, dan pengingat di setiap
  prompt batch.
- Dengan bawaan (batch 20, paralel 6), seluruh katalog diperkirakan selesai dalam ±20-30 menit.

### Meninjau Kata Ragu

`prisma/fix-flashcard-doubts.mjs` meninjau setiap kata ber-`doubt` satu per satu (bawaan
`--reasoning-effort high`). Model membaca data sumber, kartu yang ada, alasan ragunya, dan entri
lain dengan tulisan/bacaan sama, lalu memilih satu keputusan:

| Keputusan | Arti | Yang berubah saat `--apply` |
|---|---|---|
| `keep` | Kartu sudah benar; hanya data sumbernya janggal (mis. bacaan frasa yang hanya mencatat kata kerjanya) | `doubt` dikosongkan |
| `revise` | Tulisan tetap, isi kartu diperbaiki (bacaan, arti, catatan) | `content` diganti |
| `replace` | Entri sumber rusak (mis. 空オケ, 介護士/介護士さん); kartu dibuat ulang untuk bentuk bakunya | `word`/`reading` note dan `content` diganti; key tetap |
| `retire` | Entri ini duplikat rusak dari kata lain yang sudah punya kartu (mis. 鼻が高い\|はながたい → 鼻が高い\|はながたかい). Dipilih model dengan `duplicateOf`, atau otomatis bila `keep`/`replace` menghasilkan kartu kembar (mis. 鍛える。 → 鍛える di N2) | `doubt` dikosongkan, `doubtResolution.duplicateOf` diisi; seed tidak menerbitkannya dan memberi `retiredAt` |
| `escalate` | Model tidak yakin | tidak ada; tinjau manual |

```bash
npm run fix:flashcard-doubts                       # tinjau -> .flashcard-doubt-plan.json
npm run fix:flashcard-doubts -- --level N4 --key "吃驚|きっきょう" --model <model lain>
npm run fix:flashcard-doubts -- --apply            # terapkan rencana ke fixture
```

- Peninjauan hanya menulis rencana (`.flashcard-doubt-plan.json`, tidak di-commit). Baca dulu;
  hapus entri yang tidak disetujui atau ubah `action`-nya menjadi `escalate`, lalu `--apply`.
  Peninjauan per level/key digabung ke rencana yang sama.
- Kartu `revise`/`replace` divalidasi dengan aturan yang sama seperti generator (dengan percobaan
  ulang). `revise`/`replace` ber-confidence `low` otomatis menjadi `escalate`.
- Kartu kembar dicegah: `replace` (atau `keep`) yang menghasilkan tulisan + bacaan kata lain
  menjadi `retire` (atau `escalate` bila kata tujuannya belum digenerate), dan `revise` yang
  begitu ditolak lalu diminta ulang (mis. 分別|ふんべつ
  tidak boleh menjadi kartu ぶんべつ karena 分別|ぶんべつ sudah ada).
- `--apply` menolak entri rencana yang kartunya sudah berubah sejak ditinjau.
- Hasilnya dicatat di `ai.doubtResolution` (keputusan, alasan, doubt lama, tulisan/bacaan sumber,
  dan `override`). Bila bacaan sumber yang pasti ternyata keliru, `reading` note disesuaikan dan
  ikut dicatat sebagai `override`.
- `flashcard:extract` mengembalikan `word`/`reading` ke data sumber, sehingga kartu hasil
  `replace` gagal `seed:flashcard:check`. Jalankan `npm run fix:flashcard-doubts -- --apply`
  (tanpa rencana pun) untuk memasangnya lagi dari `override`.
- `gen:flashcard --overwrite` menimpa `ai`, termasuk `doubtResolution`. Kata `retire` dilewati
  `--overwrite` (kecuali dipilih dengan `--key`) supaya tidak terbit lagi.
- `retire` bisa juga ditulis manual di rencana: `"action": "retire"` plus `"duplicateOf": "<key>"`.

## Langkah 3 — Seed

- Memvalidasi taxonomy dan seluruh fixture. Satu kata yang melanggar aturan menggagalkan seed,
  dan tidak ada yang ditulis.
- Deck dibuat atau diperbarui dari taxonomy; deck yang sudah tidak ada disembunyikan, bukan
  dihapus.
- Hanya kata dengan `content` + `ai` yang diterbitkan. Kata yang belum digenerate dilewati.
- Kata yang hilang dari fixture diberi `retiredAt`. Kata tidak pernah dihapus karena kartu user
  merujuknya (FK `Restrict`).
- `wordPlain`, `reading`, dan tag level diturunkan saat seed, tidak disimpan di fixture.

## Format Fixture

Satu file per level, `src/flashcard-data/vocab/n5.json` … `n1.json`:

```jsonc
{
  "level": "N5",
  "notes": [
    {
      "key": "食事|しょくじ",          // identitas stabil, jangan diubah
      "order": 12,                    // urutan di daftar sumber (insertion order "sequential")
      "word": "食事",                 // tulisan kata, tanpa markup
      "reading": "しょくじ",
      "readingUncertain": false,
      "hints": ["meal", "anotasi sumber: (する)"],
      "homographs": [],               // bacaan lain untuk tulisan yang sama
      "sourceLevels": ["N5", "N4"],
      "sourceGuids": ["..."],
      "content": {                    // null sampai digenerate
        "word": "{食事|しょくじ}",
        "meaningsId": ["makan", "makanan", "santapan"],
        "meaningsEn": ["meal", "dining"],
        "examples": [
          {
            "jp": "{家族|かぞく}と__{食事|しょくじ}__をします。",
            "id": "Saya makan bersama keluarga.",
            "en": "I have a meal with my family."
          }
        ],
        "notes": "Bisa dipakai sebagai kata kerja: {食事|しょくじ}する.",
        "tags": ["noun", "verb-suru", "food"]   // tanpa tag level
      },
      "ai": {                         // null sampai digenerate
        "model": "…",
        "promptVersion": "flashcard-vocab-v3",
        "generatedAt": "2026-10-01T00:00:00.000Z",
        "doubt": null
      }
    }
  ]
}
```

## Aturan Isi Kartu

Ditegakkan oleh `vocabContentProblems` (`prisma/flashcard-vocab.mjs`) di generator **dan** seed:

- `word`: tulisan masukan persis, ditambah furigana `{漢字|かな}` pada kanjinya. Bacaan furigana
  harus sama dengan `reading`, kecuali `readingUncertain` atau `doubt` diisi.
- Semua teks Jepang (`word`, contoh, `notes`) mengikuti [Markup Teks Jepang](database.md#markup-teks-jepang):
  setiap kanji berfurigana, tanpa furigana pada teks tanpa kanji, tanpa HTML/markdown.
- `meaningsId` dan `meaningsEn`: 1-8 item, masing-masing tidak kosong, tanpa `;`, tanpa
  markup, tanpa duplikat. Arti kata kerja dalam bahasa Indonesia tidak boleh berbentuk
  "untuk ...". Di aplikasi item digabung dengan "; ".
- `examples`: 1-2 contoh. `jp` satu baris dengan kata target ditandai `__...__` tepat satu
  kali; `id` dan `en` berupa teks polos.
- `notes`: opsional, maksimal 600 karakter. Kata dengan `homographs` sebaiknya menyebut bacaan
  lainnya; ini hanya peringatan karena daftar homograf bisa memuat salah ketik sumber.
- `tags`: slug dari taxonomy, bukan dimensi `level`, dan jumlah per dimensi sesuai aturan di atas.

Perbaikan manual cukup dengan mengedit `content` di fixture, menjalankan
`npm run seed:flashcard:check`, lalu `npm run seed:flashcard`.
