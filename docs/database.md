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
- User baru wajib memiliki normalized email. `email` nullable hanya untuk akun legacy yang belum menjalani flow pengisian email.
- `username` nullable dan unique untuk compatibility login akun legacy; jangan membuat username sintetis untuk user baru.
- Semua tabel aplikasi pada schema `public` memakai RLS tanpa policy Data API. Runtime Prisma memakai koneksi server `postgres` dan tetap wajib melakukan ownership check di aplikasi.

## User dan Auth Rate Limit

- `User.displayName` wajib dan menjadi nama yang ditampilkan pada sidebar/catatan.
- `User.email` unique bila terisi. PostgreSQL mengizinkan beberapa nilai `NULL`, sehingga akun legacy tetap dapat dipertahankan.
- `User.avatarUrl` hanya menerima URL upload Cloudinary aplikasi pada action profile; file binary tidak disimpan di database.
- `AuthRateLimit.keyHash` menyimpan HMAC-SHA256 dari scope dan subject. Jangan simpan email atau alamat IP mentah pada tabel rate limit.
- Update bucket rate limit harus atomik dengan `INSERT ... ON CONFLICT DO UPDATE`, bukan pola select lalu update.
- Update profile dan password selalu mengambil user dari `session.userId`. Ganti password wajib membandingkan current password, memakai bcrypt cost 12 untuk hash baru, lalu membuat ulang cookie session.

## Struktur Data (hierarki)

```
TestPackage (1 paket ujian, mis. "JLPT N2 - Juli 2025")
└── TestPackageItem (1 blok mondai, mis. 問題1 漢字読み)
    └── Question (1 soal)
        └── QuestionChoice (pilihan 1-4)

QuestionContext (bacaan/audio/gambar yang dipakai >1 soal, terikat ke TestPackage)
Attempt (1 sesi pengerjaan) └── AttemptAnswer (jawaban per soal)

PracticeSession (latihan cepat per user)
└── PracticeAnswer (assignment soal + jawaban dan feedback state)

Article
├── ArticleTagLink ── ArticleTag
└── ArticleInteraction (save, favorite, dan last-view per user)
```

### Kana dan vocabulary

```text
KanaProgress (aktivitas kana per user + stable fixture key)

FlashcardDeck
└── FlashcardDeckItem ── Flashcard
                         ├── FlashcardTagLink ── FlashcardTag
                         ├── FlashcardProgress (satu row per user + kartu)
                         └── FlashcardReviewLog (riwayat setiap rating)

User
└── FlashcardSetting (satu row preference scheduler per user)
```

- `Flashcard.key`, `FlashcardDeck.slug`, dan `FlashcardTag.slug` adalah stable seed identity.
- Progress vocabulary bersifat global per kartu, bukan per deck. Kartu yang sudah dipelajari dari satu deck tidak kembali dianggap baru di deck lain.
- Queue review mengutamakan progress dengan `dueAt <= now()`, lalu kartu baru menurut `FlashcardDeckItem.order`.
- Rating SRS hanya menerima `AGAIN`, `HARD`, `GOOD`, atau `EASY`. Mutation selalu membuat review log dan memperbarui progress dalam satu transaksi.
- `FlashcardProgress.learningStep` menyimpan posisi kartu pada learning/relearning steps. `FlashcardReviewLog.wasNew` membedakan konsumsi batas kartu baru dan review harian.
- `FlashcardSetting` menyimpan batas harian, learning/relearning steps dalam menit, interval lulus/Easy, ease awal, lapse retention, interval minimum/maksimum, serta multiplier Hard/Easy/global.
- Learning/relearning steps harus berisi 1-4 nilai positif yang meningkat, maksimal 30 hari per langkah. Form string seperti `1m 10m 1h` diparse server-side sebelum masuk database.
- Batas harian dihitung sejak pukul 00.00 Asia/Jakarta. Action rating memeriksa ulang limit dan `dueAt`; UI queue bukan satu-satunya guard.
- Semua range scheduler dijaga oleh Zod dan CHECK constraint database. Setting invalid tidak boleh diteruskan ke `scheduleFlashcard`.
- `KanaProgress` tidak menyimpan duplikat content kana; `kanaKey` harus cocok dengan fixture yang dikenal aplikasi.
- Seluruh query progress/log wajib berawal dari `session.userId`. `userId` dari client tidak pernah diterima sebagai sumber otorisasi.
- Seed vocabulary dijalankan melalui `npm run seed:learning` dan wajib tetap idempotent.

### Latihan cepat

- `PracticeSession` menyimpan satu konfigurasi level, section, mondai, jumlah soal, status, dan timestamp latihan milik user.
- `PracticeAnswer` dibuat saat session dimulai sehingga membership dan urutan soal tetap stabil setelah refresh.
- `selectedAnswer`, `isCorrect`, dan `answeredAt` tetap null sebelum soal dijawab, lalu diisi bersama saat feedback pertama diproses.
- Unique `(practiceSessionId, questionId)` mencegah satu soal muncul dua kali dalam session. Unique `(practiceSessionId, order)` menjaga urutan assignment.
- Kunci jawaban dan explanation hanya boleh diambil server-side untuk soal yang sedang disubmit atau sudah dijawab. Payload awal session tidak boleh memuat field tersebut.
- Latihan cepat tidak memakai `Attempt`, sehingga akurasi practice tidak bercampur dengan proyeksi skor mock JLPT.
- Seluruh query dan mutation practice wajib memverifikasi `PracticeSession.userId` terhadap `session.userId`.

### Artikel publik

- `Article.slug` dan `ArticleTag.slug` menjadi stable identity untuk route dan seed.
- Artikel hanya tampil publik bila `status = PUBLISHED` dan `publishedAt <= now()`.
- `Article.body` menyimpan array blok JSON terstruktur; HTML mentah tidak boleh disimpan atau dirender.
- `Article.bodyText` adalah teks pencarian yang diturunkan dari body, bukan content source kedua.
- `ArticleTagLink` unique pada `(articleId, tagId)` dan seluruh foreign key memiliki index.
- `ArticleInteraction` unique pada `(userId, articleId)` serta selalu diakses dengan `session.userId`.
- `viewCount` bertambah sekali pada first-view user login. `favoriteCount` berubah atomik saat
  favorite ditambah/dihapus dan tidak boleh bernilai negatif.
- Search publik hanya memakai field content published. State save/favorite user tidak boleh masuk
  cache list/detail global.
- Seed artikel dijalankan melalui `npm run seed:articles` dan wajib tetap idempotent berdasarkan slug.

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
