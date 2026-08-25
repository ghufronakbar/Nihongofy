# Database Rules

Aturan dan konteks database untuk project JLPT practice platform multi-user.
Stack: Next.js + Prisma + PostgreSQL (Supabase).

## Prinsip Umum

- Schema ada di `prisma/schema.prisma`. Jangan mengubah schema tanpa diminta eksplisit.
- Semua perubahan schema HARUS lewat migration (`prisma migrate dev`), jangan `db push` kecuali diminta.
- Supabase: `DATABASE_URL` = pooled connection (pgbouncer) untuk runtime, `DIRECT_URL` = direct connection untuk migration. Jangan menukar keduanya.
- Semua data pribadi wajib di-scope dengan `userId` dari session. Jangan pernah menerima `userId` client sebagai sumber otorisasi.
- Role dan permission bertingkat belum menjadi scope, tetapi isolation antar-user tetap wajib.
- Jangan pernah menulis password plaintext — selalu hash (bcrypt/argon2) sebelum insert ke `User.password`.

## Struktur Data (hierarki)

```
TestPackage (1 paket ujian, mis. "JLPT N2 - Juli 2025")
└── TestPackageItem (1 blok mondai, mis. 問題1 漢字読み)
    └── Question (1 soal)
        └── QuestionChoice (pilihan 1-4)

QuestionContext (bacaan/audio/gambar yang dipakai >1 soal, terikat ke TestPackage)
Attempt (1 sesi pengerjaan) └── AttemptAnswer (jawaban per soal)
```

## Aturan Penempatan Konten

- `Question.questionText` HANYA berisi stem soal (mis. 「筆者の考えに合うものはどれか」). JANGAN menaruh bacaan panjang di sini.
- Bacaan/audio/gambar yang dipakai lebih dari satu soal → `QuestionContext`. Konten yang hanya untuk satu soal → kolom di `Question` (`questionImage`, `questionAudio`).
- **Khusus audio CHOUKAI**: default-nya SATU `QuestionContext.storyAudio` per `TestPackageItem` (mondai), dipakai bersama oleh SEMUA soal dalam mondai itu — walaupun tiap soal secara narasi independen (mis. 課題理解 yang isinya 5 dialog terpisah). Ini karena audio JLPT diputar tanpa jeda per mondai (tidak bisa diulang), dan sumber file audio biasanya memang dipotong per mondai (問題1.mp3, 問題2.mp3, dst.), bukan per butir soal. Jangan pakai `Question.questionAudio` individual untuk choukai kecuali memang ada file terpisah per soal. Gambar (`questionImage`) tetap per soal seperti biasa kalau memang cuma 1 soal yang butuh gambar (mis. 発話表現, atau soal visual-matching di 課題理解).
- `QuestionContext` harus terikat ke `TestPackage` yang sama dengan soal yang memakainya. Jangan membuat context lintas paket.
- `questionText` dan `answerText` boleh string kosong (bukan null) untuk soal/pilihan yang hanya berupa audio (mis. 即時応答).
- `Question.explanation` = penjelasan "resmi" (hasil AI, dikurasi). `QuestionComment` = catatan belajar pribadi user. Jangan mencampur keduanya.

## Markup Teks Jepang

Semua kolom teks soal (`questionText`, `answerText`, `storyText`, `instruction`, `explanation`) memakai markup ringan berikut. JANGAN menyimpan HTML mentah di database.

| Markup | Arti | Render frontend |
|---|---|---|
| `{漢字|かんじ}` | furigana | `<ruby>漢字<rt>かんじ</rt></ruby>` |
| `__teks__` | underline (下線部, kata yang ditanya) | span dengan underline |
| `[_]` | slot kosong (文の組み立て) | garis kosong |
| `[★]` | slot bintang (文の組み立て) | garis dengan ★ |

Aturan tambahan:

- Markup boleh bersarang: `__{勉強|べんきょう}する__` valid.
- `[_]` dan `[★]` TIDAK pernah punya isi — selalu literal persis seperti itu.
- Pada mondai `MOJI_GOI_READ_KANJI`, furigana di dalam segmen `__...__` tidak boleh dirender (itu jawabannya) — ini urusan frontend, data tetap disimpan lengkap dengan furigananya.

## Aturan Kunci Jawaban & Attempt

- `QuestionChoice.codeAnswer` = 1–4. `Question.questionAnswer` dan `AttemptAnswer.selectedAnswer` merujuk ke nilai ini, BUKAN ke `QuestionChoice.id`.
- Soal `BUNPOU_SENTENCE_COMPOSITION` (★): `questionAnswer` = codeAnswer pilihan yang jatuh di posisi ★ (sesuai format JLPT asli). Tidak perlu skema khusus.
- `AttemptAnswer.isCorrect` adalah field denormalized: dihitung sekali saat submit (`selectedAnswer == questionAnswer`), disimpan agar query analitik tidak perlu join kunci jawaban. Jika kunci jawaban dikoreksi setelah ada attempt, `isCorrect` attempt lama HARUS dihitung ulang.
- `selectedAnswer = null` berarti soal dilewati/tidak dijawab (dihitung salah dalam skor, tapi bisa dibedakan di analitik).
- Jawaban per soal di-UPDATE (upsert), bukan insert baru — ditegakkan oleh `@@unique([attemptId, questionId])`.
- `Attempt.sectionScope = null` berarti full test; jika terisi, hanya soal dari section tersebut yang dinilai.
- `Attempt` berstatus `ABANDONED` tidak boleh masuk perhitungan analitik.

## Unique Constraints (jangan dihapus)

Constraint berikut menjaga integritas saat import/ekstraksi soal via AI:

- `TestPackageItem`: `@@unique([testPackageId, mondaiType])` — satu paket tidak boleh punya 2 blok mondai bertipe sama.
- `Question`: `@@unique([testPackageItemId, order])` — nomor soal tidak boleh dobel.
- `QuestionChoice`: `@@unique([questionId, codeAnswer])` — kode pilihan tidak boleh dobel.
- `AttemptAnswer`: `@@unique([attemptId, questionId])` — satu jawaban per soal per attempt.

Saat import data soal, tangani pelanggaran constraint sebagai sinyal error ekstraksi — laporkan, jangan di-skip diam-diam.

## Aturan Query

- Analitik kelemahan per tipe mondai: `AttemptAnswer → Question → TestPackageItem`, group by `mondaiType`. Filter `Attempt.status = COMPLETED`.
- Saat mengambil soal untuk mode attempt, JANGAN mengirim `questionAnswer` dan `explanation` ke client sebelum attempt disubmit.
- Gunakan `include`/`select` eksplisit di Prisma — jangan fetch semua relasi tanpa perlu (bacaan `storyText` bisa panjang).
- Urutan render soal: `TestPackageItem.session` → `TestPackageItem.order` → `Question.order`.

## Data Files & Storage

- File audio/gambar disimpan di kolom `*Audio`/`*Image` di database hanya menyimpan URL/path, bukan binary.

## Timer

- Time limit ujian TIDAK disimpan di database — timer diatur user secara manual di sisi frontend. Jangan menambahkan kolom time limit ke schema tanpa diminta.
- Durasi pengerjaan tetap terekam via `Attempt.startedAt`/`finishedAt` dan `AttemptAnswer.timeSpentSec` (opsional) untuk analitik.
