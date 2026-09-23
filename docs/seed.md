# Seed dan Import Data

## Artikel publik

Fixture artikel berada di `src/features/article/data/article-seed.json` dan diimpor dengan:

```bash
npm run seed:articles
```

- Seed melakukan upsert artikel dan tag berdasarkan stable slug.
- Relasi tag artikel dibangun ulang agar sesuai fixture terbaru tanpa menduplikasi row.
- `bodyText` dibuat otomatis dari blok body untuk search server-side.
- Seed aman dijalankan ulang dan tidak mereset `viewCount`, `favoriteCount`, atau interaction user.
- Baseline Fase 5 berisi 6 artikel terbit dan 16 tag terkurasi.

## Deck flashcard bawaan

Kontrak lengkapnya ada di [`seed-flashcard.md`](seed-flashcard.md). Ringkasnya: satu file JSON
per deck di `src/flashcard-deck-data/`, diimpor dengan:

```bash
npm run seed:flashcard-deck
```

- Idempoten by `slug`; note yang dihapus dari file ikut hilang dari katalog.
- Tidak menyentuh koleksi user, karena deck bawaan **disalin** saat user menambahkannya.
- `npm run seed:flashcard-deck:check` memvalidasi tanpa menulis ke database.

## Import bank soal dari scraping

Dokumen ini adalah kontrak data untuk tool/AI eksternal yang melakukan scraping soal JLPT
asli, supaya hasilnya bisa langsung diimpor ke database lewat script seed di bawah.

Kalau kamu (AI/tool lain) yang membaca dokumen ini: tugasmu adalah menulis file JSON baru di
folder `src/test-package-data/` (satu file = satu paket tes) yang valid sesuai schema di
dokumen ini, lalu jalankan script importnya. Jangan mengubah script seed kecuali memang
diminta.

## Satu File = Satu Paket Tes

Setiap paket tes JLPT ditulis sebagai **satu file JSON terpisah** di folder
`src/test-package-data/`, bukan digabung jadi satu file besar — mengingat isi satu paket
(puluhan soal, semua text/markup/gambar/audio) bisa sangat panjang.

- Lokasi: `src/test-package-data/<nama-file>.json`
- Konvensi nama file: `<level-lowercase>-<tahun>-<bulan 2 digit>.json`, mis.
  `n2-2019-12.json` untuk paket JLPT N2 bulan Desember 2019. Nama file bebas asal deskriptif
  dan tidak bentrok — yang jadi kunci deduplikasi sebenarnya adalah field `name` di **dalam**
  isi JSON-nya (lihat di bawah), bukan nama filenya.
- Root tiap file **langsung berupa satu object `SeedTestPackage`** (lihat schema di bawah) —
  TIDAK dibungkus array/`testPackages`.
- File kosong (0 byte) otomatis di-skip dengan aman (tidak error) — jadi boleh nyicil, bikin
  file placeholder kosong dulu lalu isi belakangan.
- Script import otomatis scan **semua** file `*.json` di folder ini setiap kali dijalankan.

## Cara Import

```bash
npm run seed:test-package:check
npm run seed:test-package
```

- Script memakai `DATABASE_URL` dari environment atau file `.env` lokal.
- `seed:test-package:check` memvalidasi seluruh fixture tanpa membuka transaksi write.
- Seluruh file harus valid sebelum import dimulai. Satu package diimpor dalam satu transaksi:
  bila context, item, question, atau choice gagal dibuat, seluruh package di-rollback.
- Package existing hanya di-skip jika struktur dan jumlah datanya sesuai fixture. Package parsial
  dilaporkan sebagai error, bukan di-skip diam-diam.
- Untuk memvalidasi atau mengimpor satu file saja, tambahkan `-- --file <nama.json>`.
- Untuk mengganti package existing, gunakan
  `npm run seed:test-package -- --file <nama.json> --replace-existing`. Replacement ditolak jika
  package sudah memiliki attempt, dan delete+create berada dalam transaksi yang sama.
- Seed demo untuk testing internal dapat dijalankan dengan
  `npm run seed:demo-test-package`.
- Import bersifat **idempotent per `TestPackage.name`** (field `name` di dalam JSON, bukan nama
  file): package lengkap dengan struktur yang sama di-skip, sedangkan package parsial diblokir.
  Fixture yang isinya berubah tetapi strukturnya tetap sama dapat diperbarui secara eksplisit
  dengan `--replace-existing` setelah dipastikan belum memiliki attempt.
- Validasi mencakup field wajib, enum, relasi `mondaiType`/`section`/`session`, duplikasi order,
  pilihan jawaban, context kosong, context duplikat, dan `questionContextRef`. Error validasi
  menghentikan proses sebelum database diubah.
- Ringkasan `{ packagesSeeded, packagesReplaced, packagesSkipped, packagesBlocked,
  questionsSeeded, errors }` dan log (`CREATE`/`REPLACE`/`SKIP`/`ERROR`/`DONE`) tercetak di
  terminal dengan prefix `[seed:test-package]`. Script keluar dengan status gagal jika ada
  error validasi, package parsial, atau kegagalan transaksi.

## Struktur Isi Tiap File

### `SeedTestPackage`

```ts
type SeedTestPackage = {
  name: string; // WAJIB unik — kunci deteksi duplikat. Pakai nama deskriptif,
                // mis. "JLPT N3 - Desember 2023" (bukan generik seperti "Paket 1")
  jlptLevel: "N5" | "N4" | "N3" | "N2" | "N1";
  questionContexts?: SeedQuestionContext[]; // bacaan/audio yang dipakai >1 soal
  testPackageItems: SeedTestPackageItem[];  // blok-blok mondai (問題)
};
```

### `SeedQuestionContext`

Bacaan panjang, gambar brosur, atau audio yang dipakai bersama oleh beberapa soal (mis. dokkai
文章, choukai 統合理解). Kalau konten cuma dipakai 1 soal, JANGAN buat context — taruh langsung
di `questionImage`/`questionAudio` milik `SeedQuestion`.

**Pengecualian khusus CHOUKAI**: SEMUA mondai choukai (`CHOUKAI_TASK_BASED`,
`CHOUKAI_MAIN_POINT`, `CHOUKAI_OUTLINE`, `CHOUKAI_QUICK_RESPONSE`, `CHOUKAI_INTEGRATED`) pakai
**satu `SeedQuestionContext` per mondai** (per `SeedTestPackageItem`) untuk `storyAudio`, dipakai
bareng oleh SEMUA soal di mondai itu — walaupun tiap soal isinya independen (dialog/skenario
beda-beda). Ini bukan pengecualian dari "1 soal = jangan buat context", tapi memang konvensi
khusus choukai: audio JLPT diputar tanpa jeda per mondai (tidak bisa diulang di ujian asli), dan
biasanya file audio yang tersedia memang sudah dipotong per mondai, bukan per butir soal. Jangan
isi `questionAudio` individual per soal choukai kecuali memang ada file terpisah per soal.
`questionImage` tetap per soal seperti biasa (mis. soal visual-matching di 課題理解).

```ts
type SeedQuestionContext = {
  id: string; // local reference id, BEBAS tapi harus unik dalam satu testPackage
              // (mis. "ctx-1"). Ini BUKAN id database — cuma dipakai untuk
              // menghubungkan context ke soal lewat `questionContextRef`.
  storyText?: string | null;  // markup ringan, lihat bagian "Markup Teks" di bawah
  storyImage?: string | null; // URL gambar (isi setelah upload; kosongkan/null kalau belum ada)
  storyAudio?: string | null; // URL audio
};
```

### `SeedTestPackageItem`

Satu blok mondai (問題), mis. "問題1 漢字読み". **Satu `testPackageItem` = satu `mondaiType`.**
Tidak boleh ada 2 item dengan `mondaiType` sama dalam 1 paket (constraint database).

```ts
type SeedTestPackageItem = {
  mondaiType: MondaiType;   // lihat daftar nilai di bawah
  section: JlptSection;     // "MOJI_GOI" | "BUNPOU" | "DOKKAI" | "CHOUKAI"
  session: number;          // 1 | 2 | 3 — lihat "Aturan Penomoran Sesi" di bawah, WAJIB benar
  order: number;            // urutan mondai di dalam sesi (問題1, 問題2, ... dalam sesi yang sama)
  instruction?: string | null; // instruksi resmi mondai, mis. "＿＿の言葉の読み方として..."
  questions: SeedQuestion[];
};
```

### `SeedQuestion`

```ts
type SeedQuestion = {
  order: number; // nomor soal di dalam mondai ini, mulai dari 1
  questionText: string; // HANYA stem soal (lihat database.md) — boleh string kosong
                         // kalau soal murni audio (mis. 即時応答)
  questionImage?: string | null;
  questionAudio?: string | null;
  questionAnswer: number; // codeAnswer (1-4) pilihan yang BENAR — bukan index/id pilihan
  explanation?: SeedQuestionExplanation | string | null; // pembahasan soal, lihat di bawah
  questionContextRef?: string | null; // isi dengan `id` dari questionContexts kalau soal ini
                                       // pakai bacaan/audio bersama; null/kosongkan kalau tidak
  questionChoices: SeedQuestionChoice[]; // WAJIB tepat 4 pilihan
};
```

### `SeedQuestionChoice`

```ts
type SeedQuestionChoice = {
  codeAnswer: number; // 1-4, harus unik dalam satu soal (4 pilihan = codeAnswer 1,2,3,4)
  answerText: string; // boleh string kosong kalau pilihan murni audio
  answerImage?: string | null;
};
```

### `SeedQuestionExplanation`

Pembahasan soal. Disimpan di database sebagai relasi 1:1 (`QuestionExplanation`) dengan alasan
tiap pilihan sebagai baris tersendiri, bukan sebagai blok JSON.

```ts
type SeedQuestionExplanation = {
  summary: string;              // WAJIB. Inti: kenapa kunci jawaban benar
  detail?: string | null;       // pembahasan menyeluruh
  translation?: string | null;  // terjemahan kalimat kunci ke bahasa Indonesia
  keyPoints?: string[];         // kosakata/pola grammar yang diuji
  choices?: {                   // bila diisi, WAJIB tepat 4 item (codeAnswer 1-4, unik)
    codeAnswer: number;
    reason: string;             // kenapa pilihan ini benar/salah
  }[];
  answerKeyDoubt?: boolean;         // true bila kunci fixture dinilai keliru
  answerKeyDoubtNote?: string | null;
  meta?: {
    source?: "AI" | "HUMAN" | "IMPORTED"; // default AI
    aiModel?: string | null;
    promptVersion?: string | null;
    generatedAt?: string | null;          // ISO-8601
  };
};
```

Bentuk lama `explanation` berupa satu string masih diterima dan dipetakan ke `summary` dengan
`source: "IMPORTED"` — fixture lama tidak perlu ditulis ulang. Seluruh kolom teks di sini memakai
markup ringan yang sama dengan kolom soal (lihat "Markup Teks").

Isi pembahasan **tidak** diimpor oleh `npm run seed:test-package`. Lihat "Generate dan Import
Pembahasan" di bawah.

## Daftar Nilai Enum

### `jlptLevel`

`N5` · `N4` · `N3` · `N2` · `N1`

### `section`

`MOJI_GOI` · `BUNPOU` · `DOKKAI` · `CHOUKAI`

### `mondaiType`

| Nilai | Nama Jepang | Section |
|---|---|---|
| `MOJI_GOI_READ_KANJI` | 漢字読み | MOJI_GOI |
| `MOJI_GOI_WRITE_KANJI` | 表記 | MOJI_GOI |
| `MOJI_GOI_WORD_FORMATION` | 語形成 | MOJI_GOI |
| `MOJI_GOI_CONTEXT` | 文脈規定 | MOJI_GOI |
| `MOJI_GOI_SYNONYM` | 言い換え類義 | MOJI_GOI |
| `MOJI_GOI_WORD_USAGE` | 用法 | MOJI_GOI |
| `BUNPOU_GRAMMAR` | 文法形式の判断 | BUNPOU |
| `BUNPOU_SENTENCE_COMPOSITION` | 文の組み立て (jawaban = posisi ★, lihat "Markup Teks") | BUNPOU |
| `BUNPOU_TEXT_GRAMMAR` | 文章の文法 | BUNPOU |
| `DOKKAI_SHORT_TEXT` | 内容理解（短文） | DOKKAI |
| `DOKKAI_MEDIUM_TEXT` | 内容理解（中文） | DOKKAI |
| `DOKKAI_LONG_TEXT` | 内容理解（長文） | DOKKAI |
| `DOKKAI_INTEGRATED` | 統合理解 | DOKKAI |
| `DOKKAI_MAIN_IDEA` | 主張理解 | DOKKAI |
| `DOKKAI_INFORMATION_RETRIEVAL` | 情報検索 | DOKKAI |
| `CHOUKAI_TASK_BASED` | 課題理解 | CHOUKAI |
| `CHOUKAI_MAIN_POINT` | ポイント理解 | CHOUKAI |
| `CHOUKAI_OUTLINE` | 概要理解 | CHOUKAI |
| `CHOUKAI_EXPRESSION` | 発話表現 (biasanya ada gambar) | CHOUKAI |
| `CHOUKAI_QUICK_RESPONSE` | 即時応答 (audio-only, `questionText`/`answerText` boleh kosong) | CHOUKAI |
| `CHOUKAI_INTEGRATED` | 統合理解 | CHOUKAI |

`section` pada `SeedTestPackageItem` HARUS konsisten dengan `mondaiType`-nya (lihat kolom
Section di tabel atas).

## Aturan Penomoran Sesi (`session`)

Mengikuti struktur ujian JLPT asli — jumlah sesi beda per level:

- **N1, N2** (2 sesi): sesi 1 = `MOJI_GOI` + `BUNPOU` + `DOKKAI` (digabung), sesi 2 = `CHOUKAI`.
- **N3, N4, N5** (3 sesi): sesi 1 = `MOJI_GOI` saja, sesi 2 = `BUNPOU` + `DOKKAI` (digabung),
  sesi 3 = `CHOUKAI`.

Jadi untuk N3/N4/N5, item dengan `section: "MOJI_GOI"` selalu `session: 1`; item dengan
`section: "BUNPOU"` atau `"DOKKAI"` selalu `session: 2`; item dengan `section: "CHOUKAI"`
selalu `session: 3`. Untuk N1/N2, `MOJI_GOI`/`BUNPOU`/`DOKKAI` semua `session: 1`, dan
`CHOUKAI` adalah `session: 2`.

## Markup Teks (berlaku di `questionText`, `answerText`, `storyText`, `instruction`, `explanation`)

JANGAN pernah menulis HTML mentah. Pakai markup ringan ini saja:

| Markup | Arti | Contoh |
|---|---|---|
| `{漢字\|かんじ}` | Furigana | `{学校\|がっこう}` |
| `__teks__` | Underline (下線部, kata yang ditanya) | `__{学校\|がっこう}__に行きます` |
| `[_]` | Slot kosong (khusus `BUNPOU_SENTENCE_COMPOSITION`) | selalu literal, tidak pernah ada isi |
| `[★]` | Slot bintang (khusus `BUNPOU_SENTENCE_COMPOSITION`) | selalu literal, tidak pernah ada isi |

Markup boleh bersarang: `__{勉強|べんきょう}する__` valid (underline yang isinya ada furigana).

Untuk `BUNPOU_SENTENCE_COMPOSITION` (文の組み立て): `questionAnswer` diisi dengan `codeAnswer`
pilihan yang jatuh di posisi `[★]` sesuai urutan kalimat yang benar — bukan skema khusus, tetap
pakai field `questionAnswer` biasa.

Untuk `MOJI_GOI_READ_KANJI`: tetap sertakan furigana lengkap di dalam `__..._` sesuai data asli
(frontend yang akan menyembunyikannya saat render, supaya jawaban tidak bocor) — jangan
dihilangkan dari data.

## Validasi & Hal yang Sering Salah

- `questionAnswer` merujuk ke `codeAnswer` (1-4), **bukan** posisi array atau id.
- Setiap `SeedQuestion.questionChoices` harus tepat 4 item dengan `codeAnswer` 1,2,3,4 (unik).
- Satu `testPackageItem` = satu `mondaiType`; jangan buat 2 item dengan `mondaiType` sama
  dalam satu paket (bikin item baru dengan `order` beda kalau mondai yang sama muncul lagi
  — ini seharusnya jarang terjadi di JLPT asli).
- `order` soal dalam satu mondai tidak boleh dobel (mis. dua soal `order: 1` di item yang sama).
- `questionContextRef` harus cocok dengan salah satu `id` di `questionContexts` milik
  **paket yang sama** — tidak bisa merujuk context dari paket lain.
- `questionText`/`answerText` boleh string kosong `""` (bukan `null`) untuk soal/pilihan
  audio-only (mis. `CHOUKAI_QUICK_RESPONSE`).
- Field gambar/audio (`questionImage`, `questionAudio`, `storyImage`, `storyAudio`,
  `answerImage`) isi `null` kalau belum ada asetnya — jangan taruh placeholder string kosong.
- Field opsional (`instruction`, `explanation`, `questionContextRef`, gambar/audio) boleh
  dihilangkan dari JSON sepenuhnya atau diisi `null` — dua-duanya valid.
- Cek ejaan key top-level `questionContexts` (bukan `qustionContexts` atau typo lain) —
  kalau key-nya salah ketik, script cuma menganggap array itu kosong (tidak error saat
  parse JSON, karena key yang tidak dikenal memang diabaikan begitu saja), tapi SEMUA
  `questionContextRef` di paket itu akan gagal dengan pesan "tidak ditemukan di
  questionContexts" — kejadian nyata pas import salah satu paket.
- Kalau question stem menyebut `その〜`, angka bertanda (①②...), atau `下線部`, pastikan frasa
  yang sama muncul dengan underline `__..._` di `storyText` — tanpa itu soal tetap bisa
  dikerjakan tapi kehilangan petunjuk visual yang ada di ujian asli.

## Contoh Lengkap

Isi file `src/test-package-data/n5-2024-07.json` (root langsung `SeedTestPackage`, tanpa
pembungkus `testPackages`):

```json
{
  "name": "JLPT N5 - Contoh Paket",
  "jlptLevel": "N5",
  "questionContexts": [
    {
      "id": "ctx-1",
      "storyText": "わたしは まいにち 7じに おきます。あさごはんを たべてから、がっこうに いきます。"
    }
  ],
  "testPackageItems": [
    {
      "mondaiType": "MOJI_GOI_READ_KANJI",
      "section": "MOJI_GOI",
      "session": 1,
      "order": 1,
      "instruction": "＿＿の言葉の読み方として最もよいものを、1・2・3・4から一つえらびなさい。",
      "questions": [
        {
          "order": 1,
          "questionText": "明日、__{学校|がっこう}__に 行きます。",
          "questionAnswer": 1,
          "explanation": {
            "summary": "Yang ditanyakan cara baca __{学校|がっこう}__ (sekolah), yaitu がっこう.",
            "detail": "Kalimat 明日、__{学校|がっこう}__に 行きます。 berarti \"Besok saya pergi ke sekolah.\" Bacaan {学校|がっこう} memakai sokuon っ.",
            "translation": "Besok saya pergi ke sekolah.",
            "keyPoints": ["bacaan {学校|がっこう}", "sokuon っ"],
            "choices": [
              { "codeAnswer": 1, "reason": "Bacaan yang tepat untuk {学校|がっこう}." },
              { "codeAnswer": 2, "reason": "Kehilangan sokuon っ, bukan bacaan yang benar." },
              { "codeAnswer": 3, "reason": "Vokal panjang こう hilang." },
              { "codeAnswer": 4, "reason": "Bacaan がいこう dipakai untuk {外交|がいこう} (diplomasi)." }
            ]
          },
          "questionChoices": [
            { "codeAnswer": 1, "answerText": "がっこう" },
            { "codeAnswer": 2, "answerText": "がこう" },
            { "codeAnswer": 3, "answerText": "がっこ" },
            { "codeAnswer": 4, "answerText": "がいこう" }
          ]
        }
      ]
    },
    {
      "mondaiType": "DOKKAI_SHORT_TEXT",
      "section": "DOKKAI",
      "session": 2,
      "order": 1,
      "instruction": "つぎの文章を読んで、質問に答えてください。",
      "questions": [
        {
          "order": 1,
          "questionText": "「わたし」は 何時に おきますか。",
          "questionAnswer": 1,
          "questionContextRef": "ctx-1",
          "questionChoices": [
            { "codeAnswer": 1, "answerText": "7じ" },
            { "codeAnswer": 2, "answerText": "8じ" },
            { "codeAnswer": 3, "answerText": "8じはん" },
            { "codeAnswer": 4, "answerText": "15ふん" }
          ]
        }
      ]
    }
  ]
}
```

Contoh mondai CHOUKAI (satu context di-share seluruh soal dalam mondai, lihat pengecualian di
atas):

```json
{
  "id": "ctx-choukai-task-based",
  "storyAudio": "https://res.cloudinary.com/.../choukai-mondai1.mp3"
}
```

```json
{
  "mondaiType": "CHOUKAI_TASK_BASED",
  "section": "CHOUKAI",
  "session": 2,
  "order": 1,
  "instruction": "問題1 では、まず質問を聞いてください。それから話を聞いて、問題用紙の1から4の中から、最もよいものを一つ選んでください。",
  "questions": [
    {
      "order": 1,
      "questionText": "女の人は壊れたパソコンをどうしますか?",
      "questionAnswer": 2,
      "questionContextRef": "ctx-choukai-task-based",
      "questionChoices": [
        { "codeAnswer": 1, "answerText": "アパートの指定場所に出す。" },
        { "codeAnswer": 2, "answerText": "メーカーに送る。" },
        { "codeAnswer": 3, "answerText": "買った店に持っていく。" },
        { "codeAnswer": 4, "answerText": "市の回収箱に入れる。" }
      ]
    }
  ]
}
```

## Note

Untuk soal yang ada image maupun audio, tetap tuliskan keynya, namun untuk valuenya isi dengan `"TODO: url audio xxx"` agar memudahkan.

## Generate dan Import Pembahasan

Pembahasan soal punya jalur sendiri, terpisah dari import struktur soal.

```bash
npm run gen:explanation -- --file n5-2018-07.json --limit 5   # tulis pembahasan ke file JSON
npm run seed:question-explanation:check                        # validasi tanpa menulis database
npm run seed:question-explanation                              # impor pembahasan ke database
```

**Kenapa terpisah dari `seed:test-package`.** Script paket hanya membandingkan *struktur*
(jumlah item, section, session, order, jumlah soal). Fixture yang isinya berubah tetapi
strukturnya tetap sama akan di-`SKIP`, jadi pembahasan yang baru ditulis tidak akan pernah masuk
dari sana. Satu-satunya jalur di script itu adalah `--replace-existing`, yang menghapus lalu
membuat ulang seluruh paket sehingga `Question.id` berubah dan comment/attempt/practice milik
user ikut terhapus. `seed:question-explanation` hanya menyentuh tabel pembahasan, dicocokkan
lewat (nama paket → `mondaiType` → `order` soal), sehingga aman dijalankan pada paket yang sudah
dikerjakan user dan idempotent bila dijalankan ulang.

### Generator (`prisma/generate-question-explanation.mjs`)

- Tidak menyentuh database sama sekali: ia hanya membaca dan menulis file di
  `src/test-package-data/`.
- Satu soal = satu permintaan ke model, lengkap dengan konteks bacaan bila soal memakainya.
- Soal yang sudah punya `explanation` dilewati kecuali dipakai `--overwrite`, jadi proses boleh
  dihentikan kapan saja dan dilanjutkan lagi. File ditulis setiap satu mondai selesai.
- Soal `CHOUKAI` dilewati secara bawaan: fixture hanya menyimpan URL audio tanpa transkrip,
  sehingga model tidak punya bahan dan hanya akan mengarang. Pakai `--include-choukai` bila
  transkrip sudah tersedia di `storyText`.
- Keluaran model divalidasi sebelum ditulis (label lengkap, markup furigana/underline seimbang,
  tanpa HTML/markdown, tepat satu pilihan ditandai benar). Keluaran yang melanggar diminta ulang
  sekali, lalu dilaporkan sebagai gagal tanpa merusak file.
- Model wajib menandai `KUNCI_MERAGUKAN` bila menilai kunci jawaban fixture keliru, alih-alih
  mengarang pembenaran. Soal bertanda ini dicetak di log dan tersimpan sebagai `answerKeyDoubt`.

Flag yang tersedia: `--file`, `--level`, `--mondai`, `--limit`, `--concurrency`, `--overwrite`,
`--include-choukai`, `--reasoning-effort minimal|low|medium|high`, dan `--dry-run` (mencetak
prompt tanpa memanggil model).

`--reasoning-effort low` sangat menentukan pada model reasoning: pada uji coba,
satu soal turun dari 119-213 detik (5.000-6.500 token reasoning) menjadi 19-37 detik. Tanpa itu,
permintaan untuk soal panjang kerap diputus gateway dengan HTTP 524. Flag ini hanya dikirim bila
diisi, karena model non-reasoning menolak permintaan yang memuat parameter tak dikenal.

Environment yang dibutuhkan (lihat `.env.example`): `EXPLANATION_BASE_URL`,
`EXPLANATION_API_KEY`, `EXPLANATION_MODEL`. Ketiganya hanya dibaca script offline ini dan tidak
pernah dipakai aplikasi saat runtime.

## Referensi Lain

- `prisma/seed-test-package.mjs` — script import struktur soal dari fixture JSON ke database.
- `prisma/test-package-fixture.mjs` — kontrak fixture (schema zod + loader) yang dipakai bersama
  oleh seluruh script di atas.
- `prisma/seed-question-explanation.mjs` — import pembahasan saja, aman untuk paket yang sudah
  dipakai user.
- `prisma/generate-question-explanation.mjs` + `prisma/explanation-prompt.mjs` — generator
  pembahasan dan prompt-nya.
- `src/test-package-data/types.ts` — source of truth TypeScript untuk kontrak JSON di atas.
- `docs/database.md` — aturan schema & markup lengkap (dokumen ini adalah ringkasannya,
  dikhususkan untuk konteks import).
- `prisma/seed-demo-test-package.mjs` — contoh seed sederhana (hardcoded, bukan dari
  JSON) untuk kebutuhan testing internal, bukan untuk data produksi.
