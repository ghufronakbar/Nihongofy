## Context: Pipeline Import Soal JLPT ke JSON

Saya sedang membuat website pribadi untuk latihan JLPT. Sistem website sudah tersedia; pekerjaan berikutnya adalah memasukkan soal-soal JLPT tahun lalu dari PDF dan audio yang tersimpan di Google Drive.

Repository target:

```text
https://github.com/ghufronakbar/jlpt-exam
```

Dokumen penting:

```text
docs/seed.md
docs/text-parser.md
src/test-package-data/types.ts
src/test-package-data/n2-2014-12.json
data/audio/
```

Gunakan repository dan contoh JSON yang sudah ada sebagai sumber kebenaran struktur data. Jangan membuat schema baru yang berbeda dari repository tanpa alasan jelas.

---

## Tujuan Pipeline

Pipeline yang diinginkan:

```text
Google Drive
→ download PDF/audio
→ OCR dan ekstraksi struktur
→ identifikasi section/mondai/soal
→ crop gambar jika ada
→ transkripsi audio dan penentuan timestamp
→ trim audio per mondai
→ upload image/audio ke Cloudinary
→ generate JSON sesuai schema repository
→ validasi otomatis
→ auto-pass atau review queue
→ simpan ke repository
→ test/build
```

Untuk perubahan repository, gunakan feature branch dan PR. Jangan merge ke production tanpa approval eksplisit.

---

## Format Root JSON

Satu file JSON mewakili satu paket ujian:

```json
{
  "name": "JLPT N2 - Desember 2014",
  "jlptLevel": "N2",
  "questionContexts": [],
  "testPackageItems": []
}
```

Konvensi nama file:

```text
<level-lowercase>-<tahun>-<bulan 2 digit>.json
```

Contoh:

```text
n2-2014-12.json
```

`name` harus unik karena dipakai sebagai kunci deduplikasi saat seed.

---

## Struktur `questionContexts`

Context digunakan untuk konten yang dipakai oleh beberapa soal:

- bacaan dokkai;
- bacaan bunpou;
- audio listening satu mondai;
- gambar bersama jika memang dipakai beberapa soal.

```json
{
  "id": "ctx-dokkai-11-1",
  "storyText": "...",
  "storyImage": null,
  "storyAudio": null
}
```
 Semua field media bersifat opsional. Jika belum ada URL final, gunakan `null` pada JSON final, bukan placeholder palsu.

Untuk soal yang merujuk context:

```json
{
  "questionContextRef": "ctx-dokkai-11-1"
}
```

Reference harus menunjuk ID yang ada dalam `questionContexts` pada paket yang sama.

---

## Struktur `testPackageItems`

Satu item merepresentasikan satu blok mondai:

```json
{
  "mondaiType": "MOJI_GOI_READ_KANJI",
  "section": "MOJI_GOI",
  "session": 1,
  "order": 1,
  "instruction": "...",
  "questions": []
}
```

Satu `testPackageItem` hanya boleh memiliki satu `mondaiType`.

Enum section:

```text
MOJI_GOI
BUNPOU
DOKKAI
CHOUKAI
```

Contoh enum mondai type:

```text
MOJI_GOI_READ_KANJI
MOJI_GOI_WRITE_KANJI
MOJI_GOI_WORD_FORMATION
MOJI_GOI_CONTEXT
MOJI_GOI_SYNONYM
MOJI_GOI_WORD_USAGE

BUNPOU_GRAMMAR
BUNPOU_SENTENCE_COMPOSITION
BUNPOU_TEXT_GRAMMAR

DOKKAI_SHORT_TEXT
DOKKAI_MEDIUM_TEXT
DOKKAI_LONG_TEXT
DOKKAI_INTEGRATED
DOKKAI_MAIN_IDEA
DOKKAI_INFORMATION_RETRIEVAL

CHOUKAI_TASK_BASED
CHOUKAI_MAIN_POINT
CHOUKAI_OUTLINE
CHOUKAI_EXPRESSION
CHOUKAI_QUICK_RESPONSE
CHOUKAI_INTEGRATED
```

Untuk N1/N2:

```text
session 1 = MOJI_GOI + BUNPOU + DOKKAI
session 2 = CHOUKAI
```

Untuk N3/N4/N5:

```text
session 1 = MOJI_GOI
session 2 = BUNPOU + DOKKAI
session 3 = CHOUKAI
```

---

## Struktur Pertanyaan

```json
{
  "order": 1,
  "questionText": "...",
  "questionImage": null,
  "questionAudio": null,
  "questionAnswer": 2,
  "explanation": null,
  "questionContextRef": null,
  "questionChoices": [
    {
      "codeAnswer": 1,
      "answerText": "...",
      "answerImage": null
    },
    {
      "codeAnswer": 2,
      "answerText": "...",
      "answerImage": null
    },
    {
      "codeAnswer": 3,
      "answerText": "...",
      "answerImage": null
    },
    {
      "codeAnswer": 4,
      "answerText": "...",
      "answerImage": null
    }
  ]
}
```

Aturan:

- `questionChoices` harus tepat empat pilihan. 
- `codeAnswer` harus unik dan terdiri dari `1, 2, 3, 4`.
- `questionAnswer` adalah nilai `codeAnswer` yang benar, bukan array index.
- `questionText` hanya berisi stem soal, bukan seluruh passage.
- `questionText` boleh `""` untuk soal audio-only.
- `answerText` boleh `""` untuk pilihan audio-only.
- `questionImage` digunakan untuk gambar yang terkait satu soal.
- `answerImage` digunakan jika setiap pilihan memiliki gambar terpisah.
- `storyImage` digunakan untuk gambar context bersama.

---

## Markup Jepang

Jangan menggunakan HTML mentah. Gunakan markup ringan repository:

```text
{学校|がっこう}
```

untuk furigana.

```text
__teks__
```

untuk underline.

```text
[_]
```

untuk slot kosong.

```text
[★]
```

untuk slot bintang.

Contoh:

```text
明日、__{学校|がっこう}__に行きます。
```

Untuk `MOJI_GOI_READ_KANJI`, furigana tetap harus dimasukkan meskipun frontend dapat menyembunyikannya saat latihan.

Untuk `BUNPOU_SENTENCE_COMPOSITION`, `questionAnswer` tetap berisi `codeAnswer` pilihan yang berada pada posisi `[★]`.

---

## Format `storyText` Dokkai

`docs/text-parser.md` menjelaskan bahwa `storyText` bukan sekadar teks satu baris.

Pertahankan:

- newline antarbaris;
- blank line antarparagraf;
- marker `【A】` dan `【B】`;
- tabel Markdown jika dokumen berbentuk tabel.

Contoh:

```text
次のAとBの文章を読んで、後の問いに答えなさい。

【A】
文章 bagian A...

【B】
文章 bagian B...
```

Tabel dapat ditulis:

```md
| 項目 | 詳細 |
|---|---|
| 日時 | ... |
| 会場 | ... |
```

Passage harus disimpan sebagai satu context jika digunakan oleh beberapa soal.

---

## Format Listening

Audio listening utama biasanya berupa:

```text
n2-2014-12.mp3
```

Lalu dipotong per mondai menjadi:

```text
n2-2014-12-01.mp3
n2-2014-12-02.mp3
n2-2014-12-03.mp3
n2-2014-12-04.mp3
n2-2014-12-05.mp3
```

Target pipeline adalah **satu audio per mondai**, bukan satu audio per nomor soal.

Contoh context:

```json
{
  "id": "ctx-choukai-1",
  "storyAudio": "https://res.cloudinary.com/.../n2-2014-12-01.mp3"
}
```
 Semua pertanyaan pada `CHOUKAI_TASK_BASED` mondai 1 menunjuk:

```json
"questionContextRef": "ctx-choukai-1"
```

Audio harus diproses dengan:

```text
ASR/transkripsi Jepang bertimestamp
→ deteksi penanda 問題1, 問題2, dan seterusnya
→ analisis silence/VAD
→ tentukan boundary
→ beri padding secukupnya
→ trim dengan FFmpeg
→ validasi audio hasil
```

Jangan membagi audio menjadi bagian sama panjang. Gunakan isi ucapan dan batas akustik.

Transkrip audio digunakan untuk:

- menentukan timestamp;
- mengetahui batas antar-mondai;
- QA;
- mendeteksi audio terpotong atau boundary meragukan.

Transkrip tidak otomatis dimasukkan ke `questionText` jika soal aslinya memang audio-only.

---

## Jenis Listening Audio-only

Beberapa tipe listening memang tidak memiliki teks atau pilihan tercetak:

```text
CHOUKAI_OUTLINE
CHOUKAI_QUICK_RESPONSE
sebagian CHOUKAI_INTEGRATED
```

Untuk kasus tersebut, struktur dapat tetap seperti:

```json
{
  "questionText": "",
  "questionChoices": [
    { "codeAnswer": 1, "answerText": "" },
    { "codeAnswer": 2, "answerText": "" },
    { "codeAnswer": 3, "answerText": "" },
    { "codeAnswer": 4, "answerText": "" }
  ]
}
```

Jangan mengarang teks dari transcript jika teks tersebut tidak tersedia di lembar soal. Transcript hanya menjadi data internal/QA kecuali memang diperlukan oleh format website.

---

## OCR dan Ekstraksi PDF

PDF dapat berupa:

- PDF text-based;
- scan image;
- halaman dengan kombinasi teks dan gambar.

Gunakan Gemini multimodal atau OCR Jepang yang sesuai untuk membaca halaman. Hasil OCR harus direkonstruksi ke struktur JSON repository, bukan hanya plain text.

Perhatikan:

- nomor soal;
- batas mondai;
- instruksi;
- stem;
- empat pilihan;
- jawaban benar;
- passage/context;
- underline;
- furigana;
- gambar soal;
- gambar pilihan;
- tabel;
- marker `【A】`, `【B】`;
- anotasi `(注1)`, `(注2)`;
- slot `(50)`, `(51)`, dan `[★]`.

OCR yang meragukan harus masuk review queue.

---

## Crop Gambar
 Gambar dapat menjadi:

1. `questionImage`
2. `answerImage`
3. `storyImage`

Pipeline perlu menentukan relasinya berdasarkan layout halaman, bukan sekadar mengekstrak semua gambar.

Setiap crop perlu memiliki:

- source PDF;
- nomor halaman;
- bounding box;
- tipe relasi;
- target JSON path;
- status confidence;
- URL Cloudinary setelah upload.

Jika crop ambigu, jangan auto-pass.

---

## Auto-pass dan Review

Gunakan dua status:

```text
auto_pass
needs_review
```

Auto-pass hanya jika:

- JSON valid;
- semua field wajib ada;
- pilihan tepat empat;
- jawaban valid;
- nomor soal berurutan;
- section/mondai/session konsisten;
- context reference valid;
- markup valid;
- crop tidak ambigu;
- audio boundary cukup yakin;
- URL Cloudinary berhasil di-upload dan dibaca kembali.

Masuk `needs_review` jika:

- OCR karakter Jepang meragukan;
- furigana tidak jelas;
- pilihan atau urutan soal ambigu;
- gambar terpotong atau relasinya tidak jelas;
- audio boundary meragukan;
- transcript dan struktur PDF bertentangan;
- jumlah soal tidak sesuai pola;
- ada data yang terlihat seperti typo atau metadata salah.

Review item idealnya menampilkan:

```text
halaman asli
hasil OCR
JSON usulan
crop gambar
transcript/audio boundary
alasan review
```

---

## Catatan Validasi Referensi

`n2-2014-12.json` terlihat sebagai contoh paket lengkap dengan:

- 17 contexts;
- 19 test package items;
- 107 questions;
- lima audio context listening;
- Dokkai dan Bunpou context;
- semua soal yang diperiksa memiliki empat pilihan valid.

`n2-2014-07.json` perlu dicek ulang karena metadata dan isinya tampak tidak konsisten:

- nama file menyebut Juli 2014;
- field `name` menyebut Desember 2014;
- paketnya parsial;
- tidak memiliki Dokkai dan Choukai.

Jangan langsung menganggap data lama benar. Lakukan crosscheck dengan sumber asli/PDF sebelum menjadikan paket tersebut sebagai ground truth.

---

## Prinsip Utama

1. Repository adalah sumber kebenaran format. 
2. Jangan mengarang teks yang tidak ada di sumber.
3. Jangan menyamakan pembagian audio dengan pembagian durasi.
4. Jangan menganggap OCR berhasil hanya karena JSON berhasil diparse.
5. Semua hasil perlu divalidasi secara deterministik.
6. Hasil meragukan masuk review queue.
7. Media harus diverifikasi setelah upload.
8. Perubahan code/data dilakukan di feature branch dan PR.
9. Jangan merge atau deploy production tanpa approval eksplisit.
10. Jika data lama tampak salah, tandai sebagai anomali dan minta crosscheck—jangan diam-diam memperbaikinya sebagai fakta.
