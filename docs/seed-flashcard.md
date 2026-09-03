# Kontrak Data Deck Flashcard Bawaan

Dokumen ini adalah kontrak untuk siapa pun — termasuk tool/AI eksternal — yang ingin menambah
deck bawaan aplikasi. Deck bawaan adalah katalog konten milik aplikasi; user menambahkannya
lewat **Flashcard → Tambah deck**, dan saat itu isinya **disalin** ke koleksi mereka.

Kalau kamu (AI/tool lain) yang membaca dokumen ini: tugasmu adalah menulis file JSON baru di
`src/flashcard-deck-data/`, satu file per deck, lalu menjalankan script validasi. Jangan mengubah
script seed kecuali memang diminta.

## Satu File = Satu Deck

- Lokasi: `src/flashcard-deck-data/<slug>.json`
- Root file **langsung berupa satu object deck**, tidak dibungkus array.
- File kosong (0 byte) dilewati dengan aman, jadi boleh menyicil.
- Kunci deduplikasi adalah `slug` di **dalam** file, bukan nama filenya.

```bash
npm run seed:flashcard-deck:check
```

```bash
npm run seed:flashcard-deck
```

Seed bersifat idempoten: menjalankan ulang memperbarui deck dan note yang ada, menambah yang
baru, dan **menghapus note yang sudah tidak ada di file**. File adalah sumber kebenaran.

Mengubah katalog **tidak** menyentuh koleksi user yang sudah menambahkan deck itu — karena isinya
sudah disalin. Menambahkan ulang deck yang isinya bertambah hanya membawa note barunya; note yang
sudah ada dilewati sehingga progres belajarnya tidak tereset.

## Bentuk File

```jsonc
{
  "slug": "jlpt-n4-kosakata",       // wajib: huruf kecil/angka/strip, 3-120 karakter, unik
  "name": "JLPT N4::Kosakata",      // wajib: hierarkis, dipisah "::" seperti Anki
  "description": "Kosakata inti N4.",
  "jlptLevel": "N4",                // opsional: N5 | N4 | N3 | N2 | N1
  "noteType": "VOCAB_JP",           // wajib: lihat tabel di bawah
  "license": "Konten asli Tanoshii Japanese.",  // wajib, DITAMPILKAN di UI
  "order": 20,                      // opsional: urutan di katalog
  "isPublished": true,              // opsional, default true
  "notes": [
    {
      "guid": "n4-vocab-0000",      // wajib: unik dalam deck, maks 48 karakter, STABIL
      "fields": ["続ける", "つづける", "melanjutkan", "勉強を続ける。", "Melanjutkan belajar.", ""],
      "tags": ["n4", "kosakata"],
      "order": 0
    }
  ]
}
```

### `guid` harus stabil

`guid` adalah kunci deduplikasi. Deck yang ditambahkan user menyimpan note dengan guid
`sys:<slug>:<guid>`. Mengubah guid sebuah note = note lama dihapus dari katalog dan note baru
dibuat, sehingga user yang menambahkan ulang akan mendapat kartu duplikat dengan progres kosong.
Perbaiki isi `fields`-nya, jangan guid-nya.

### `license` wajib

Kolom ini ditampilkan di halaman Tambah Deck. Sumber seperti JMdict/KANJIDIC2 (CC BY-SA 4.0,
EDRDG), Tatoeba (CC BY 2.0 FR), dan KanjiVG (CC BY-SA 3.0) mewajibkan atribusi, dan lebih murah
dipatuhi sejak awal daripada dibersihkan belakangan. Untuk konten sendiri, tulis apa adanya.

## Note Type dan Urutan Field

`fields` adalah array string dengan **panjang tepat** sesuai note type, dan urutannya mengikuti
tabel ini. Field opsional tetap harus ada sebagai string kosong `""`.

| noteType | Urutan `fields` | Wajib terisi | Kartu per note |
|---|---|---|---|
| `BASIC` | front, back | keduanya | 1 |
| `BASIC_REVERSED` | front, back | keduanya | 2 |
| `VOCAB_JP` | word, reading, meaning, example, exampleMeaning, note | word, meaning | 2 |
| `KANJI` | kanji, onyomi, kunyomi, meaning, example | kanji, meaning | 2 |
| `KANA` | char, romaji, example | char, romaji | 2 |
| `CLOZE` | text, note | text | 1 per nomor `{{cN::}}` |

Definisi kanonnya ada di `src/features/flashcard/note-types.ts`. Kalau tabel di atas dan file itu
berbeda, file itu yang benar — dan `prisma/seed-flashcard-deck.mjs` harus ikut diperbarui.

### Cloze

`fields[0]` wajib memuat minimal satu `{{c1::jawaban}}`. Hint opsional: `{{c1::jawaban::hint}}`.
Satu note menghasilkan satu kartu per **nomor unik**, jadi `{{c1::A}} ... {{c1::B}}` tetap satu
kartu, sedangkan `{{c1::A}} ... {{c2::B}}` menjadi dua.

## Isi Field

- HTML di dalam field disanitasi dengan allowlist ketat saat dirender: hanya
  `b strong i em u br ruby rt rp rb sub sup` yang lolos, dan **semua atribut dibuang**. Jangan
  mengandalkan `style`, `class`, `<div>`, `<span>`, atau `<img>`.
- Penanda media Anki `[sound:...]` dibuang — media belum didukung.
- Tata letak kartu ditentukan aplikasi, bukan file ini. Tulis isi field saja.

## Katalog Saat Ini

| Slug | Deck | Note type | Note |
|---|---|---|---|
| `kana-hiragana` | Kana::Hiragana | KANA | 71 |
| `kana-katakana` | Kana::Katakana | KANA | 71 |
| `jlpt-n5-kosakata` | JLPT N5::Kosakata | VOCAB_JP | 113 |
| `jlpt-n5-kanji` | JLPT N5::Kanji | KANJI | 80 |

N4 sampai N1 belum ada. Menambahkannya cukup dengan membuat file baru sesuai kontrak di atas —
tidak ada kode yang perlu diubah.
