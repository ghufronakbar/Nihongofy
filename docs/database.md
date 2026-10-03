# Database Rules

Aturan dan konteks database untuk project JLPT practice platform multi-user.
Stack: Next.js + Prisma + PostgreSQL (Supabase).

## Prinsip Umum

- Schema ada di `prisma/schema.prisma`. Jangan mengubah schema tanpa diminta eksplisit.
- Semua perubahan schema HARUS lewat migration (`prisma migrate dev`), jangan `db push` kecuali diminta.
- Supabase: `DATABASE_URL` = pooled connection (pgbouncer) untuk runtime, `DIRECT_URL` = direct connection untuk migration. Jangan menukar keduanya.
- Semua data pribadi wajib di-scope dengan `userId` dari session. Jangan pernah menerima `userId` client sebagai sumber otorisasi.
- Role dan permission bertingkat belum menjadi scope, tetapi isolation antar-user tetap wajib.
- Jangan pernah menulis password plaintext. `User.password` hanya boleh berisi hash bcrypt atau
  `NULL` untuk akun OAuth-only yang belum membuat password.
- User baru wajib memiliki normalized email. `email` nullable hanya untuk akun legacy yang belum menjalani flow pengisian email.
- Email akun immutable setelah dibuat. Google account hanya boleh dihubungkan ke akun credential
  dengan email normalized yang sama.
- `username` nullable dan unique untuk compatibility login akun legacy; jangan membuat username sintetis untuk user baru.
- Semua tabel aplikasi pada schema `public` memakai RLS tanpa policy Data API. Runtime Prisma memakai koneksi server `postgres` dan tetap wajib melakukan ownership check di aplikasi.

## User dan Auth Rate Limit

- `User.displayName` wajib dan menjadi nama yang ditampilkan pada sidebar/catatan.
- `User.email` unique bila terisi. PostgreSQL mengizinkan beberapa nilai `NULL`, sehingga akun legacy tetap dapat dipertahankan.
- `OAuthAccount` menyimpan identitas provider berdasarkan `(provider, providerAccountId)`; Google
  `sub` adalah identity stabil, sedangkan `providerEmail` hanya snapshot. Satu user hanya boleh
  memiliki satu identity per provider dan row dihapus cascade bersama user.
- `User.role` adalah `USER` atau `ADMIN` dengan default `USER`. Hanya dua level, tanpa tabel
  permission granular. Nilainya **tidak pernah** ikut ke payload JWT session: token berlaku 7 hari
  sehingga demote tidak akan langsung berlaku. Baca lewat `getSessionUser()`/`requireAdmin()` di
  `src/lib/auth.ts`, dan ubah lewat `npm run user:role` — belum ada UI untuk promote.
- `User.timeZone` menyimpan nama IANA valid dan menjadi sumber batas harian SRS, filter tanggal,
  serta format timestamp user-specific. Existing user dibackfill `Asia/Jakarta`.
- `User.avatarUrl` hanya menerima URL object R2 milik aplikasi pada action profile; file binary tidak disimpan di database. Avatar Cloudinary lama tetap dibaca apa adanya sampai user menggantinya.
- Avatar baru menyimpan `avatarPublicId`, `avatarFormat`, dan `avatarBytes`. Public ID wajib berada
  di `jlpt-exam/avatars/{userId}/<uuid>.webp`, unik, serta diverifikasi lewat HeadObject + pembacaan header WebP (harus 512x512) sebelum update.
- `allowAudioStorage` dan `allowConversationStorage` adalah opt-in terpisah dengan default `false`.
- `deletionRequestedAt` dan `deletionScheduledFor` harus null bersama atau membentuk jadwal valid.
  Hard-delete user dijalankan cron setelah 7 hari; seluruh relasi user-owned memakai cascade.
- `postingSuspendedAt`, `postingSuspendedReason` (`VARCHAR(500)`), dan `postingSuspendedById`
  adalah suspend posting diskusi publik oleh admin. CHECK `User_posting_suspension_check` (hanya
  di SQL migration) menolak alasan/admin tanpa `postingSuspendedAt`; sebaliknya `ById` boleh NULL
  saat suspend berlaku karena FK-nya `ON DELETE SET NULL`. Dibaca per request lewat
  `isPostingSuspended()`, tidak di-cache. `anonymizeAccount` mengosongkan ketiganya; suspend yang
  pernah diberikan seorang admin kepada orang lain dibiarkan sebagai jejak moderasi.
- `profileVisibility` (`PUBLIC` | `PRIVATE`, default `PUBLIC`), `bio` (`VARCHAR(160)`, teks polos),
  dan `jlptTarget` (`JlptLevel`) milik profil publik `/u/[username]`. Visibility dibaca per request,
  tidak pernah dari cache. `publicProfileNoticeDismissedAt` menandai banner "profilmu kini publik"
  sudah ditutup: akun lama NULL, baris baru default `now()` (lihat ledger migration
  `20261003120000_public_profile`). `anonymizeAccount` mengosongkan bio dan target level.
- `AuthRateLimit.keyHash` menyimpan HMAC-SHA256 dari scope dan subject. Jangan simpan email atau alamat IP mentah pada tabel rate limit.
- Update bucket rate limit harus atomik dengan `INSERT ... ON CONFLICT DO UPDATE`, bukan pola select lalu update.
- Update profile dan password selalu mengambil user dari `session.userId`. Ganti password wajib membandingkan current password, memakai bcrypt cost 12 untuk hash baru, lalu membuat ulang cookie session.

## Audit Admin

- `AdminAuditLog` mencatat setiap aksi admin yang bermutasi. Untuk aksi yang menulis ke database,
  barisnya ditulis di transaksi yang sama sehingga tidak pernah ada mutasi tanpa catatannya.
- `actorId` memakai `ON DELETE SET NULL`: jejak aksi tidak boleh ikut hilang bersama akunnya.
  Dalam alur normal ini tidak terpakai, karena penghapusan akun menganonimkan baris `User` alih-alih
  menghapusnya — lihat `anonymizeAccount()`.
- `actorName` adalah snapshot nama aktor. Anonimisasi akun **menggantinya** dengan
  "Pengguna dihapus" sambil mempertahankan `actorId` dan barisnya: yang dibersihkan identitasnya,
  bukan catatan akuntabilitasnya.
- `summary` adalah satu baris yang dapat dibaca tanpa membuka data aslinya. Jangan memuat isi
  konten, kredensial, atau data pribadi — baris log bertahan lebih lama daripada data yang
  dirujuknya.
- Selain penggantian `actorName` oleh anonimisasi, aplikasi tidak pernah mengubah atau menghapus
  baris log.

## Komentar dan Diskusi

- `QuestionComment` melayani dua target: soal (`questionId`, `Cascade`) dan kata flashcard
  (`vocabId` ke `FlashcardVocab`, `Restrict` seperti `FlashcardCard.vocabId`). Tepat satu terisi —
  CHECK `QuestionComment_target_check` hanya ada di SQL migration
  `20261002090000_comment_flashcard_vocab_target`, karena Prisma tidak dapat mengekspresikannya.
  Karena tidak ada FK yang SET NULL, CHECK ini tidak dapat menggagalkan penghapusan targetnya.
  Balasan mewarisi target root-nya. Index target kata meniru index soal: `vocabId`,
  `(vocabId, userId, deletedAt)`, `(vocabId, parentId, sharedAt)`.
- Query yang mengelompokkan per target wajib membuang baris target lain: `groupBy` pada
  `questionId` kini juga mengembalikan grup `null` (catatan kata), dan sebaliknya.
- `QuestionComment.deletedAt` adalah soft delete; baris tidak pernah dihapus permanen karena
  balasan user lain menempel pada root.
- `QuestionComment.deletedById` mencatat siapa yang menghapus. Hapusan pemilik terisi dengan
  `userId` miliknya sendiri, takedown admin terisi dengan id admin. Hanya yang kedua yang boleh
  dipulihkan — memulihkan hapusan pemilik berarti menerbitkan ulang tulisan yang sengaja ia tarik.
- Takedown hanya mengubah record database. File lampiran di object storage **tidak** dihapus.
- `QuestionCommentVote` adalah suara "membantu": PK `(commentId, userId)` sehingga satu suara per
  user per entri, tanpa kolom nilai (tidak ada downvote). FK `commentId` dan `userId` `Cascade`
  (jaring pengaman; comment tidak pernah di-hard delete), index `userId` untuk anonimisasi dan
  export. Jumlah dihitung `groupBy` saat thread dibaca, bukan kolom cache. Query yang dikirim ke
  client tidak pernah memilih `userId` pemberi suara — hanya jumlah dan status milik viewer
  (dijaga `votes.test.ts`). Takedown tidak menghapus suara; `anonymizeAccount` menghapus suara
  yang diberikan akun itu.

## Laporan Pengguna

- `Report` adalah kotak masuk laporan: bug, typo soal, kunci jawaban keliru, penyalahgunaan diskusi,
  isi kartu flashcard atau pola bunpou yang keliru, dan saran. Target opsional dan memakai **FK nyata**
  (`questionId`, `articleId`, `commentId`, `vocabId`, `bunpouPointId`, `bunpouComparisonId`), bukan pasangan `(targetType, targetId)`
  seperti `AdminAuditLog`. Baris audit harus bertahan setelah
  targetnya hilang; laporan justru ada untuk membuka targetnya dan memperbaikinya.
- Seluruh FK target memakai `ON DELETE SET NULL`. Menghapus satu soal tidak boleh ikut menghapus
  laporan yang belum ditindak, dan laporan juga tidak boleh menahan penghapusan targetnya.
- `targetType = FLASHCARD_VOCAB` memakai `vocabId`, yaitu kata di katalog `FlashcardVocab`, bukan
  baris `FlashcardCard` milik user. Katalog tidak pernah menghapus kata (hanya `retiredAt`), dan
  penahan penghapusannya sudah ada di `FlashcardCard.vocabId` (`Restrict`); laporan tetap `SET NULL`.
- `targetType = BUNPOU_POINT`/`BUNPOU_COMPARISON` memakai `bunpouPointId`/`bunpouComparisonId` ke
  katalog bunpou, yang juga tidak pernah dihapus (hanya `retiredAt`).
- `targetLabel` adalah snapshot teks target saat laporan dibuat. **Selalu** dibangun di server dari
  baris target — label kiriman client dapat dipalsukan dan akan menyuntikkan teks ke layar admin.
  Tanpa kolom ini, FK yang menjadi null meninggalkan baris yang tidak terbaca.
- `targetType = QUESTION_EXPLANATION` juga memakai `questionId`, bukan id pembahasan. Pembahasan
  di-upsert oleh `seed:question-explanation` dan layar perbaikannya `/admin/explanation/[questionId]`.
- `Report_target_columns_check` menolak kombinasi kolom yang salah kabel. Sisi "target harus ada"
  sengaja TIDAK ada di database: dengan `ON DELETE SET NULL`, CHECK semacam itu akan menggagalkan
  penghapusan soal. Kewajiban itu ditegakkan zod di `src/features/report/schemas.ts`.
- `Report_reply_shape_check` memastikan `repliedAt` dan `replyMessage` terisi bersama — `repliedAt`
  tanpa isi balasan berarti ada email terkirim tanpa jejak.
- Empat partial unique index melarang satu pelapor yang dikenal punya lebih dari satu laporan `OPEN`
  pada target yang sama. Guest tidak punya identitas untuk dijadikan kunci; di sana rate limit per IP
  yang bekerja. Keempat index dan kedua CHECK di atas hanya ada di SQL migration — Prisma tidak dapat
  mengekspresikannya, jadi jangan menganggap `schema.prisma` sebagai daftar lengkap constraint tabel
  ini. `src/features/report/report-migrations.test.ts` memeriksa bahwa setiap FK target di schema
  disebut CHECK dan punya index anti-banjir.
- Menambah nilai `ReportTargetType`/`ReportCategory` butuh migration tersendiri yang hanya berisi
  `ALTER TYPE ... ADD VALUE`. Nilai enum baru tidak boleh dipakai di transaksi yang menambahkannya
  (`55P04`), dan `prisma migrate deploy` menjalankan satu file sebagai satu transaksi.
- `reporterId` nullable (`SET NULL`) untuk guest dan akun yang dianonimkan. `anonymizeAccount`
  mengosongkan `reporterId` dan `replyEmail` tetapi TIDAK menghapus laporannya: bug yang dilaporkan
  tetap perlu ditindak setelah pelapornya pergi.
- `replyEmail` adalah data pribadi pada baris yang bisa jadi tidak punya pemilik. Cron
  `auth-cleanup` mengosongkannya untuk laporan yang sudah ditutup dan lebih tua dari
  `REPORT_REPLY_EMAIL_RETENTION_DAYS`.
- `message` bukan kolom markup Jepang. Jangan merendernya sebagai markup.
- Tidak ada IP mentah yang disimpan di tabel ini. IP hanya menjadi subject bucket rate limit yang
  di-HMAC, sama seperti `AuthRateLimit`.

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

### Kana

```text
KanaProgress (aktivitas kana per user + stable fixture key)
```

- `KanaProgress` tidak menyimpan duplikat content kana; `kanaKey` harus cocok dengan fixture yang dikenal aplikasi.

### Flashcard

```text
FlashcardVocab (katalog kosakata bawaan, satu baris per kata)
FlashcardDeck (deck bawaan = satu tag taxonomy)
└── FlashcardDeckSubscription (deck yang dipilih user)

User
├── FlashcardCollection (pengaturan per user: display + rolloverHour)
└── FlashcardDeckSubscription (PK userId + deckId; config penjadwalan deck, unsubscribedAt)
    └── FlashcardCard (progres satu kata di satu deck, PK userId + deckId + vocabId) ── FlashcardVocab
        └── FlashcardRevlog (riwayat setiap rating, membawa deckId)
```

- Katalog milik aplikasi dan diisi `npm run seed:flashcard` dari `src/flashcard-data/`; tidak ada
  konten buatan user. Kontraknya di [seed-flashcard.md](seed-flashcard.md).
- `FlashcardVocab.key` adalah identitas stabil kata ("食事|しょくじ"). Kata yang hilang dari fixture
  diberi `retiredAt` dan **tidak pernah dihapus**; FK `FlashcardCard.vocabId` memakai `Restrict`
  supaya penghapusan yang tidak disengaja gagal alih-alih ikut menghapus progres user.
- Keanggotaan deck tidak disimpan: kata termasuk deck bila `FlashcardVocab.tags` memuat
  `FlashcardDeck.slug` (index GIN pada `tags`). Satu kata bisa berada di beberapa deck, dan di
  tiap deck yang ditambahkan user ia punya kartu sendiri.
- `FlashcardCard` ber-FK komposit ke `FlashcardDeckSubscription (userId, deckId)` dengan cascade,
  dan `FlashcardRevlog` ke kartu `(userId, deckId, vocabId)`. Langganan karena itu tidak pernah
  dihapus saat deck dilepas — hanya `unsubscribedAt` yang diisi — supaya kartu tetap ada. Kartu
  hanya dibuat untuk deck yang sedang ditambahkan dan kata yang memang termasuk deck itu.
- `FlashcardVocab.word`, contoh kalimat (`examples[].jp`), dan `notes` memakai
  [Markup Teks Jepang](#markup-teks-jepang); `__...__` di contoh kalimat menandai kata target.
  `wordPlain` dan `reading` diturunkan dari `word` saat seed.
- Baris `FlashcardCard` dibuat saat kata pertama kali disentuh; kata tanpa baris adalah kartu
  baru. Suspend (`isSuspended`) dan tunda (`buriedUntil`) disimpan terpisah dari `queue`
  sehingga jadwal asli tidak tertimpa.
- `FlashcardDeckSubscription.config` (penjadwalan per deck) dan `FlashcardCollection.display`
  (tampilan per user) adalah JSONB yang hanya dibaca lewat zod (`src/features/flashcard/schemas.ts`).
  Field yang tidak valid lagi diganti default-nya sendiri, bukan menghapus seluruh pengaturan.
- Batas hari memakai `User.timeZone` dengan jam rollover Anki (`FlashcardCollection.rolloverHour`,
  default 04:00), bukan tengah malam. Zona waktu tidak disalin ke koleksi.
- Rating hanya `AGAIN`, `HARD`, `GOOD`, atau `EASY`. Jawaban selalu menulis kartu dan revlog dalam
  satu transaksi. Idempotency memakai `@@unique([userId, clientToken])`, bukan primary key.
- `FlashcardRevlog.wasNew` menandai review pertama kartu baru (dasar batas kartu baru per hari,
  dihitung per `deckId`);
  `previousState` menyimpan salinan kartu sebelum review untuk undo yang persis.
- Batas harian berlaku per deck, tanpa batas gabungan. Action rating memeriksa ulang batas kartu baru,
  jatuh tempo, suspend, dan tunda; antrean di client bukan satu-satunya penjaga.
- Seluruh query progres wajib berawal dari `session.userId`.

### Latihan cepat

- `PracticeSession` menyimpan satu konfigurasi level, section, mondai, jumlah soal, status, dan timestamp latihan milik user.
- `PracticeAnswer` dibuat saat session dimulai sehingga membership dan urutan soal tetap stabil setelah refresh.
- `selectedAnswer`, `isCorrect`, dan `answeredAt` tetap null sebelum soal dijawab, lalu diisi bersama saat feedback pertama diproses.
- Unique `(practiceSessionId, questionId)` mencegah satu soal muncul dua kali dalam session. Unique `(practiceSessionId, order)` menjaga urutan assignment.
- Kunci jawaban dan pembahasan hanya boleh diambil server-side untuk soal yang sedang disubmit atau sudah dijawab. Payload awal session tidak boleh memuat field tersebut.
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
- `QuestionExplanation` = pembahasan "resmi" (hasil generator AI, dikurasi). `QuestionComment` = catatan belajar pribadi user. Jangan mencampur keduanya.

### Pembahasan soal (`QuestionExplanation`)

- Relasi 1:1 ke `Question` lewat `questionId` unique. Satu soal paling banyak punya satu pembahasan.
- Hanya `summary` yang wajib. `detail`, `translation`, `keyPoints`, dan alasan per pilihan boleh kosong untuk pembahasan lama hasil ekstraksi atau catatan tulisan tangan.
- Alasan tiap pilihan disimpan sebagai baris `QuestionExplanationChoice`, unique pada `(explanationId, codeAnswer)`, bukan sebagai blok JSON. `isCorrect` didenormalisasi dari `Question.questionAnswer` saat import.
- `source`, `aiModel`, `promptVersion`, dan `generatedAt` adalah jejak audit: hasil lama harus tetap dapat dijelaskan setelah prompt atau model berubah. `aiModel`/`promptVersion` hanya terisi untuk `source = AI`.
- `answerKeyDoubt` diisi generator saat model menilai kunci jawaban fixture keliru. Baris bertanda ini wajib ditinjau manusia sebelum ditampilkan sebagai pembahasan final.
- Pembahasan diisi lewat `npm run seed:question-explanation`, bukan lewat `npm run seed:test-package`. Script paket hanya melewati (skip) paket yang strukturnya sudah cocok, jadi perubahan isi pembahasan tidak akan tersimpan dari sana.

## Markup Teks Jepang

Semua kolom teks soal (`questionText`, `answerText`, `storyText`, `instruction`, dan seluruh kolom teks `QuestionExplanation`) memakai markup ringan berikut. JANGAN menyimpan HTML mentah di database.

| Markup | Arti | Render frontend |
|---|---|---|
| `{漢字|かんじ}` | furigana | `<ruby>漢字<rt>かんじ</rt></ruby>` |
| `__teks__` | underline (下線部, kata yang ditanya) | span dengan underline |
| `[_]` | slot kosong (文の組み立て) | garis kosong |
| `[★]` | slot bintang (文の組み立て) | garis dengan ★ |

Aturan tambahan:

- Markup boleh bersarang: `__{勉強|べんきょう}する__` valid.
- `[_]` dan `[★]` TIDAK pernah punya isi — selalu literal persis seperti itu.
- Pada mondai `MOJI_GOI_READ_KANJI`, furigana di dalam segmen `__...__` adalah jawabannya. Data tetap disimpan lengkap dengan furigananya, tetapi payload soal sebelum dijawab (exam dan latihan) membuangnya di server lewat `withoutUnderlineFurigana()` (`src/lib/japanese-markup.ts`). Menyembunyikannya hanya saat render (`hideFuriganaInUnderline`) tidak cukup, karena teks mentahnya tetap terkirim di RSC payload.
- Markup yang sama dipakai kolom flashcard (`FlashcardVocab.word`, `examples[].jp`, `notes`). Di
  sana `__...__` menandai kata target contoh kalimat dan dirender sebagai sorotan, bukan garis bawah.

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
- `Report`: empat partial unique index pada `(reporterId, target)` untuk status `OPEN` — satu pelapor
  yang dikenal tidak boleh membanjiri satu target. Hanya ada di SQL migration, tidak di
  `schema.prisma`.

Saat import data soal, tangani pelanggaran constraint sebagai sinyal error ekstraksi — laporkan, jangan di-skip diam-diam.

## Aturan Query

- Analitik kelemahan per tipe mondai: `AttemptAnswer → Question → TestPackageItem`, group by `mondaiType`. Filter `Attempt.status = COMPLETED`.
- Saat mengambil soal untuk mode attempt, JANGAN mengirim `questionAnswer` dan relasi `explanation` ke client sebelum attempt disubmit. Relasi 1:1 lebih mudah bocor daripada kolom teks: satu `include: { explanation: true }` yang lolos review sudah cukup membocorkan kunci jawaban.
  - "Dikirim ke client" mencakup props Server Component ke Client Component (ikut RSC payload, terbaca di view-source walau tidak dirender), bukan hanya return value Server Action.
  - Larangan yang sama berlaku untuk turunannya: `AttemptAnswer.isCorrect` attempt yang belum `COMPLETED` (termasuk di `/api/account/export`), `QuestionExplanationChoice.isCorrect`, dan cara baca di dalam underline soal `MOJI_GOI_READ_KANJI`.
  - Query baca pada model yang menyimpan kunci (`Question`, `AttemptAnswer`, `QuestionExplanation*`) selalu memakai `select`. Tanpa `select` — juga dengan `include` — seluruh kolom skalar ikut, termasuk `questionAnswer`.
  - Data ber-kunci yang di-cache (`unstable_cache` mode baca, key `testPackageQuestions`) tidak boleh dipakai ulang jalur exam/latihan.
  - Dijaga `src/lib/answer-key-guard.test.ts`. Mengubah select exam/latihan atau menambah pemakai `QUESTION_EXPLANATION_SELECT` akan menggagalkannya sampai ditinjau.
- Gunakan `include`/`select` eksplisit di Prisma — jangan fetch semua relasi tanpa perlu (bacaan `storyText` bisa panjang).
- Urutan render soal: `TestPackageItem.session` → `TestPackageItem.order` → `Question.order`.

## Data Files & Storage

- File audio/gambar disimpan di kolom `*Audio`/`*Image` di database hanya menyimpan URL/path, bukan binary.

## Timer

- Time limit ujian TIDAK disimpan di database — timer diatur user secara manual di sisi frontend. Jangan menambahkan kolom time limit ke schema tanpa diminta.
- Durasi pengerjaan tetap terekam via `Attempt.startedAt`/`finishedAt` dan `AttemptAnswer.timeSpentSec` (opsional) untuk analitik.
