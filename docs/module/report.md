# Modul Report

## Status Aktual

**Selesai untuk scope v1, ditambah kartu flashcard (1 Oktober 2026).** Form laporan publik (guest
dan user login), tombol "Laporkan" pada soal, pembahasan, artikel, entri diskusi, dan kartu
flashcard, antrean admin dengan filter serta aksi status, dan balasan email opsional per laporan.

Target kartu flashcard menunggu `npx prisma migrate deploy` untuk dua migration
`20261001150000_report_flashcard_vocab_enum` dan `20261001150100_report_flashcard_vocab_target`,
lalu uji manual di browser (checklist di Fase 8.11 `docs/plan.md`).

## Feature Flag

| Key | Efek saat `false` |
|---|---|
| `FEATURES_REPORT` | `/report` menjadi 404, seluruh tombol "Laporkan" tidak dirender, dan kedua Server Action publik menolak dengan `notFound()`. Antrean `/admin/report` **tetap hidup** |
| `FEATURES_FLASHCARD` | Target kartu flashcard hilang dari sisi user: tombol "Laporkan kartu" hanya ada di bawah `/flashcard`, yang menjadi 404, dan `/report` tidak lagi menyebut kartu flashcard. `submitReportAction` menolak laporan kartu dari tab lama sebelum Turnstile dan rate limit. Laporan kartu yang sudah masuk **tetap** dapat dibuka dan ditindak di `/admin/report` |

Antrean admin sengaja tidak ikut mati. Alasan utama mematikan `FEATURES_REPORT` adalah
penyalahgunaan form, dan justru pada saat itulah laporan yang sudah masuk perlu ditindak. Halaman
admin menampilkan peringatan bahwa form-nya sedang tertutup, dan peringatan serupa untuk laporan
kartu saat `FEATURES_FLASHCARD` mati.

## Scope

Dilaporkan:

| `targetType` | Dari mana | Kolom FK |
|---|---|---|
| `GENERAL` | `/report` | — |
| `QUESTION` | Exam runner, latihan cepat, mode baca paket, review hasil | `questionId` |
| `QUESTION_EXPLANATION` | Kartu pembahasan di mode baca, review hasil, latihan cepat | `questionId` |
| `ARTICLE` | Halaman artikel publik | `articleId` |
| `COMMENT` | Thread diskusi (root dan balasan), permalink, sheet diskusi | `commentId` |
| `FLASHCARD_VOCAB` | Reviewer (setelah sisi belakang dibuka), daftar kata `/flashcard/deck/[slug]`, mode coba `/flashcard/try/[slug]` | `vocabId` |

Pembahasan dilaporkan lewat `questionId`, **bukan** id pembahasannya. Pembahasan di-upsert oleh
`seed:question-explanation` dan layar perbaikannya memang `/admin/explanation/[questionId]`, jadi
satu FK melayani dua jenis keluhan tanpa kehilangan apa pun.

Kartu flashcard dilaporkan lewat `vocabId`, yaitu kata di katalog (`FlashcardVocab`), **bukan**
baris `FlashcardCard` milik user. Kartu user hanya menyimpan jadwal; isinya merujuk baris katalog
yang sama, jadi satu perbaikan fixture lalu `seed:flashcard` memperbaiki kartu semua orang.

## Model Data

Target memakai **FK nyata**, bukan pasangan `(targetType, targetId)` seperti `AdminAuditLog`.
Perbedaannya bukan selera: baris audit harus bertahan setelah targetnya hilang, sedangkan laporan
justru ada untuk membuka targetnya dan memperbaikinya. Sekali laporan tidak dapat di-join, layar
admin berubah menjadi resolusi label per jenis target.

- Keempat FK target memakai `ON DELETE SET NULL`. Menghapus satu soal tidak boleh ikut menghapus
  laporan bug yang belum ditindak.
- `vocabId` mengikuti pilihan yang sama walau katalog tidak pernah menghapus kata (kata yang tidak
  dipakai lagi hanya diberi `retiredAt`). `CASCADE` akan menghapus laporan bersama targetnya, dan
  `RESTRICT` akan membuat laporan menahan penghapusan kata; penahan itu sudah ada di tempat yang
  tepat, yaitu `FlashcardCard.vocabId` (`Restrict`) yang menjaga progres user. Laporan cukup
  bertahan dengan FK `NULL` dan `targetLabel` yang memuat key kata.
- `targetLabel` adalah snapshot teks target saat laporan dibuat (`"N2 Juli 2025 · 文法 · soal 12"`,
  `"Flashcard · N5 · 食事|しょくじ"`), mengikuti pola `AdminAuditLog.actorName`. Label kartu memuat
  level dan key utuh: key itulah yang menunjuk entri fixture bila FK-nya kelak `NULL`, dan membuat
  pencarian antrean bekerja untuk tulisan, bacaan, maupun key. Tanpa snapshot ini, FK yang menjadi
  null meninggalkan baris yang tidak terbaca. Label **selalu** dibangun di server dari baris
  target; label kiriman client dapat dipalsukan dan akan menyuntikkan teks pilihan pelapor ke
  layar admin.
- `reporterId` nullable (`SET NULL`): guest tidak punya akun, dan akun yang dianonimkan tetap
  meninggalkan laporannya.
- `enum ReportStatus`: `OPEN` → `IN_REVIEW` → `RESOLVED` / `REJECTED` / `DUPLICATE`. `DUPLICATE`
  adalah status, bukan relasi `duplicateOfId` — untuk v1, menunjuk laporan induk belum memberi
  manfaat yang sebanding dengan kolomnya.

### Dua CHECK constraint, dan satu yang sengaja tidak ada

`Report_target_columns_check` menolak laporan yang salah kabel: laporan soal tidak boleh membawa
`articleId`, laporan artikel tidak boleh membawa `commentId`, laporan kartu hanya boleh membawa
`vocabId`, dan seterusnya. Constraint ini didefinisikan ulang di
`20261001150100_report_flashcard_vocab_target`; definisi yang berlaku adalah yang terakhir.

Sisi "target harus ada" **tidak** ada di database. FK target memakai `ON DELETE SET NULL`, jadi
CHECK yang mewajibkan `questionId IS NOT NULL` untuk `targetType = 'QUESTION'` akan menggagalkan
penghapusan soal itu sendiri. Kewajiban itu ditegakkan `SubmitReportSchema` di
`src/features/report/schemas.ts`.

`Report_reply_shape_check` memastikan `repliedAt` dan `replyMessage` terisi bersama: baris dengan
`repliedAt` tetapi tanpa isi balasan berarti ada email terkirim tanpa jejak.

### Anti-banjir dari satu pelapor

Empat partial unique index (`questionId`, `articleId`, `commentId`, `vocabId`) melarang satu
pelapor yang dikenal punya lebih dari satu laporan `OPEN` pada target yang sama. Beberapa keluhan
pada satu kartu (mis. bacaan dan contoh kalimat) ditulis dalam satu laporan; begitu admin menyentuh
laporannya, pelapor yang sama boleh mengirim laporan baru. Guest tidak punya identitas yang
dapat dijadikan kunci, dan di sana rate limit per IP yang bekerja. Pelanggarannya muncul sebagai
`P2002` dan diterjemahkan action menjadi pesan yang jelas, bukan error generik.

### Menambah nilai enum: dua migration

`ALTER TYPE ... ADD VALUE` dan pemakaian nilai itu tidak boleh berada di satu file migration.
PostgreSQL menolak memakai nilai enum di transaksi yang menambahkannya (`55P04 unsafe use of new
value`), dan `prisma migrate deploy` menjalankan satu file sebagai satu transaksi; kegagalannya di
production meninggalkan status migrasi gagal (`P3018`) yang harus di-resolve manual. Karena itu
target kartu memakai dua migration: `..._enum` hanya menambah nilai, `..._target` menambah kolom,
FK, index, dan CHECK yang menyebut `'FLASHCARD_VOCAB'`. Target berikutnya (mis. bunpou) perlu pola
yang sama; `src/features/report/report-migrations.test.ts` menjaganya.

## Kategori Dibatasi Target

Peta tunggalnya ada di `src/features/report/constants.ts` (`REPORT_CATEGORIES_BY_TARGET`) dan dipakai
form, `SubmitReportSchema`, serta layar admin.

| Target | Kategori |
|---|---|
| `GENERAL` | `BUG`, `SUGGESTION`, `OTHER` |
| `QUESTION` | `CONTENT_ERROR`, `ANSWER_KEY`, `MEDIA_ERROR`, `BUG`, `OTHER` |
| `QUESTION_EXPLANATION` | `EXPLANATION_ERROR`, `ANSWER_KEY`, `BUG`, `OTHER` |
| `ARTICLE` | `CONTENT_ERROR`, `BUG`, `OTHER` |
| `COMMENT` | `ABUSE`, `OTHER` |
| `FLASHCARD_VOCAB` | `READING_ERROR`, `MEANING_ERROR`, `EXAMPLE_ERROR`, `TAG_ERROR`, `BUG`, `OTHER` |

Keputusan di dalam peta itu:

- **`BUG` dan `OTHER` dibuka di semua target selain diskusi** (yang hanya punya `ABUSE` dan
  `OTHER`). User yang menemukan "tombol berikutnya tidak jalan di soal 12" akan memaksa laporannya
  masuk kategori yang salah bila satu-satunya pilihan di halaman soal adalah kategori konten. Yang
  dibatasi target adalah kategori *konten*.
- **`ANSWER_KEY` dipisah dari `CONTENT_ERROR`** karena sudah ada alur untuknya:
  `QuestionExplanation.answerKeyDoubt` beserta index-nya. Laporan kunci jawaban dari user dan
  keraguan dari generator adalah antrean yang sama.
- **Kartu flashcard punya empat kategori konten sendiri dan tidak memakai `CONTENT_ERROR`.**
  Isi kartu ditulis AI untuk 6.720 kata, dan kesalahannya jatuh ke empat bagian fixture yang
  berbeda:

  | Kategori | Label di form | Bagian fixture |
  |---|---|---|
  | `READING_ERROR` | Bacaan / furigana salah | `reading` note (bagian dari key) dan furigana di `content` |
  | `MEANING_ERROR` | Arti atau catatan keliru | `content.meaningsId`, `meaningsEn`, `notes` |
  | `EXAMPLE_ERROR` | Contoh kalimat bermasalah | `content.examples` |
  | `TAG_ERROR` | Tag atau deck tidak cocok | `content.tags`, yang menentukan deck tempat kata muncul |

  Alasannya bukan statistik semata. Bacaan yang keliru **diperbaiki dengan cara lain**: validator
  seed memaksa furigana kata sama dengan `reading` note, dan bacaan itu ikut membentuk key, jadi
  generate ulang hanya mengulang kesalahannya. Jalurnya peninjau kata ragu (`ai.doubt` lalu
  `fix:flashcard-doubts`), yang dapat mengganti bacaan sambil mencatat override. Arti, contoh, dan
  tag cukup disunting atau di-generate ulang. Kategori juga menentukan prioritas (bacaan yang salah
  langsung terbawa ke hafalan, tag yang salah hanya salah deck), dan sebarannya menunjukkan aturan
  prompt generator mana yang perlu dipertegas. `CONTENT_ERROR` yang serba-mencakup akan
  menyembunyikan semua pembedaan itu di dalam teks bebas, jadi tidak ditawarkan untuk kartu.
  Catatan (`notes`) digabung ke arti karena keduanya teks penjelas dan diperbaiki dengan cara yang
  sama; level tidak punya kategori karena diturunkan dari daftar kata sumber, bukan ditulis AI.

  Nama nilainya generik (`READING_ERROR`, bukan `VOCAB_READING`) mengikuti `EXPLANATION_ERROR`,
  supaya dapat dipakai target lain yang punya bacaan atau contoh kalimat, mis. bunpou.

Peta ini **tidak** dijadikan CHECK constraint. Ia yang paling mungkin berubah, dan mengubahnya lewat
migrasi setiap kali ada kategori baru adalah gesekan tanpa imbalan.

## Siapa yang Boleh Melapor

Guest **boleh**. Guest mengerjakan mock test lewat `/exam/guest/...`, jadi guest justru yang paling
mungkin menemukan bug. Konsekuensinya ditangani berlapis:

1. **Turnstile** untuk pengirim tanpa session, dengan action `report` di `TURNSTILE_ACTIONS`. Yang
   memutuskan perlu-tidaknya captcha adalah ada-tidaknya session **di server**, bukan flag dari
   client.
2. **Rate limit** lewat `consumeAuthRateLimits`: guest 5 laporan/jam per IP, user login 10/jam per
   akun ditambah 30/jam per IP. Subject-nya di-HMAC — tabel rate limit tidak pernah menyimpan IP
   mentah.
3. **Tanpa lampiran.** Jalur upload R2 untuk pengirim anonim adalah vektor penyalahgunaan yang tidak
   sebanding dengan manfaatnya di v1.

Melaporkan komentar sendiri ditolak server (pemiliknya punya tombol hapus), dan komentar yang sudah
tidak tampil publik tidak dapat dilaporkan.

Kartu flashcard mengikuti aturan yang sama: guest boleh melapor dari mode coba
`/flashcard/try/[slug]` dengan Turnstile, user login dari reviewer dan daftar kata. Kata yang sudah
dipensiunkan (`retiredAt`) ditolak server karena sudah keluar dari semua deck; laporannya hanya
mungkin datang dari tab lama.

## Balasan Email Opsional

- Guest mengisi alamat di form; user login mendapat checkbox "boleh dibalas ke email akun saya", dan
  alamatnya diambil server dari `session.userId` — alamat kiriman client tidak pernah dipakai untuk
  akun yang sudah login.
- **Tidak ada email otomatis.** Perubahan status tidak mengirim apa pun; hanya aksi admin eksplisit
  yang mengirim. Itulah yang membuat "admin berhak menjawab atau tidak" menjadi nyata.
- **Satu balasan per laporan.** `repliedAt` yang terisi menutup jalurnya, dan cooldown Redis
  (`report-reply`) menjaga dari klik ganda serta dari satu laporan yang dipakai memberondong satu
  alamat.
- **Isi laporan asli tidak pernah dikutip ke dalam email.** Alasannya konkret: alamat balasan tidak
  diverifikasi, jadi seseorang dapat menuliskan alamat orang lain. Bila isi laporan ikut dikirim,
  teks kasar yang ia tulis akan sampai ke orang itu atas nama aplikasi ini. Email hanya memuat
  kategori, tanggal, jawaban admin, dan satu baris keterangan kenapa email itu datang.
- Emailnya dikirim lebih dulu, baru barisnya ditulis. Urutan sebaliknya menghasilkan laporan yang
  tercatat "sudah dibalas" padahal SMTP menolak, dan itu tidak dapat dibedakan dari balasan yang
  benar-benar terkirim. Bila pencatatan gagal setelah email terkirim, admin mendapat pesan eksplisit
  untuk **tidak** mengirim ulang.
- `replyMessage` disimpan supaya tidak ada balasan tanpa jejak, tetapi `AdminAuditLog.summary` tetap
  tanpa isi konten maupun alamat email.

## Halaman

| Halaman | Isi |
|---|---|
| `/report` | Form laporan `GENERAL`. `noindex, follow` — form publik yang mudah ditemukan dari pencarian adalah magnet spam. Ditautkan dari footer bila flag hidup |
| `/admin/report` | Antrean: tab `belum selesai` / `sudah ditutup` / `semua`, filter target dan kategori, pencarian isi dan label target, 100 baris terbaru |

Tombol "Laporkan" membuka dialog **di tempat**, bukan menavigasi ke `/report?questionId=...`. Di
runner ujian, meninggalkan halaman berarti mengorbankan state jawaban dan timer yang sedang
berjalan. Karena itu juga action laporan **tidak** memanggil `revalidatePath` pada route exam.

Hal yang sama menjaga sesi belajar flashcard. Antrean reviewer hidup di state React, dan halaman
belajar yang di-render ulang server membangun antrean baru dengan `key` baru, yang mereset sesi.
Kedua action laporan tidak me-revalidate, tidak me-refresh, dan tidak menulis cookie, jadi
responsnya hanya membawa nilai kembalian dan route tidak di-render ulang. Di reviewer:

- Tombol "Laporkan kartu" hanya muncul setelah sisi belakang dibuka, karena kesalahan isi baru
  terlihat di sana, dan di-disable selama jawaban disimpan supaya dialog tidak hilang saat kartu
  berganti.
- Selama dialog terbuka, pintasan keyboard reviewer (Space/Enter, 1-4, F) dimatikan lewat
  `onOpenChange` milik `ReportButton`, ditambah penjaga untuk target di dalam `role="dialog"`.
  Tanpa itu, Space/Enter pada tombol atau checkbox di dialog ikut menilai kartu di belakangnya.
  Setelah dialog tertutup, pintasan kembali seperti biasa.

Konteks form (perlu captcha atau tidak, ada email akun atau tidak) diambil lewat
`getReportFormContextAction()` saat dialog dibuka, bukan diteruskan sebagai props. Kalau lewat props,
setiap komponen induk sampai ke runner ujian harus ikut merantai sitekey yang tidak mereka pakai.
Sitekey Turnstile memang nilai publik — yang rahasia adalah secret key-nya.

## Sisi Admin

- Aksi status: `Tinjau`, `Selesai`, `Tolak`, `Duplikat`. Tidak ada tombol untuk kembali ke `OPEN` —
  mengembalikan laporan ke "belum disentuh" menghapus jejak siapa yang menanganinya.
- `handledById`/`handledAt` diisi pada perubahan status pertama dan tidak ditimpa sesudahnya: yang
  ingin diketahui adalah siapa yang mengambil laporan ini, bukan siapa yang terakhir menyentuhnya.
- `adminNote` ikut tersimpan bersama perubahan status supaya tidak ada tombol simpan kedua yang mudah
  terlupa. Catatan ini **tidak pernah** dikirim ke pelapor.
- Setiap aksi yang bermutasi menulis `AdminAuditLog` di transaksi yang sama (`report.status`,
  `report.reply`).
- Kolom "+N laporan lain di target ini" mencegah dua belas orang yang melaporkan soal yang sama
  terbaca sebagai dua belas pekerjaan.
- Tautan "Buka target" mengarah ke layar tempat laporan itu sebenarnya diperbaiki:
  `/admin/question/[id]`, `/admin/explanation/[questionId]`, `/admin/article/[id]`. Laporan komentar
  mengarah ke `/admin/moderation` — takedown sudah hidup di sana, dan jalur takedown kedua berarti
  dua tempat yang dapat berbeda perlakuannya atas entri yang sama.
- Kartu flashcard **tidak** punya tautan: katalog sengaja tidak punya editor admin. Sebagai
  gantinya laporan kartu menampilkan level, key, dan isi kartu sekarang lewat `VocabCardView`
  (komponen yang sama dengan reviewer), ditambah langkah perbaikan: sunting `content` di
  `src/flashcard-data/vocab/<level>.json` atau `npm run gen:flashcard -- --key "<key>" --overwrite`,
  lalu `npm run seed:flashcard:check` dan `npm run seed:flashcard`. Laporan `READING_ERROR`
  mendapat jalur peninjau kata ragu, `TAG_ERROR` pengingat taxonomy. Perintahnya sudah berisi key
  dan dapat dipilih sekali klik. Isi kartu dibaca langsung dari katalog, bukan salinan saat
  dilaporkan, sehingga setelah seed admin melihat versi barunya sebelum menandai laporan selesai.
- Filter kategori hanya menawarkan kategori milik target yang sedang dipilih, dan kombinasi yang
  mustahil (mis. kategori bacaan pada target soal) dibuang dari URL.
- Overview `/admin` menampilkan jumlah laporan belum selesai beserta yang menunggu balasan, dan
  memunculkannya di daftar "perlu perhatian".

## Data dan Security

- Antrean admin **tidak** di-cache dan tidak punya tag di `CACHE_TAGS`, sejalan dengan antrean
  moderasi: layar ini dibuka justru untuk melihat keadaan sekarang.
- Setiap Server Action admin memanggil `requireAdmin()` sendiri; layout tidak melindungi Server
  Action.
- `message` dirender sebagai plain text di admin. Ini bukan kolom markup Jepang dan tidak boleh
  diperlakukan sebagai markup.
- `pagePath` hanya menerima path internal yang dimulai `/`, dan hanya path — query string dapat
  memuat parameter yang bukan urusan laporan. Tidak ada IP mentah yang disimpan; IP hanya menjadi
  subject bucket rate limit yang di-HMAC.
- `anonymizeAccount()` mengosongkan `reporterId` dan `replyEmail` untuk laporan semua target,
  termasuk kartu flashcard, tetapi **tidak** menghapus laporannya: bug yang dilaporkan tetap perlu
  ditindak setelah pelapornya pergi.
- `/api/account/export` memuat laporan yang dikirim akun itu, untuk semua target: target dan
  labelnya, kategori, isi, `pagePath`, user agent, alamat balasan, serta balasan yang memang
  dikirim kepadanya. Status, `adminNote`, dan identitas admin yang menangani tidak ikut, sejalan
  dengan aturan bahwa catatan internal tidak pernah dikirim ke pelapor dan pelapor tidak punya
  halaman status.
- Cron `auth-cleanup` mengosongkan `replyEmail` untuk laporan yang sudah ditutup dan lebih tua dari
  `REPORT_REPLY_EMAIL_RETENTION_DAYS` (90 hari). Barisnya dipertahankan sebagai riwayat.

## Keterbatasan dan Keputusan yang Ditunda

- Laporan kartu flashcard tidak dapat ditindak dari browser: perbaikannya tetap lewat fixture dan
  `seed:flashcard` di terminal, karena katalog tidak punya editor admin. Laporan juga tidak otomatis
  menandai `ai.doubt` di fixture; admin yang memutuskan.
- Isi kartu di antrean admin adalah isi **sekarang**. Bila kartu sudah diperbaiki, yang dikeluhkan
  pelapor hanya tersisa di teks laporannya.
- Tidak ada notifikasi ke admin saat laporan masuk; angkanya muncul di overview dan sidebar saja.
- Pelapor tidak punya halaman status. Satu-satunya jalur umpan balik adalah balasan email opsional.
- Tidak ada lampiran gambar.
- `DUPLICATE` tidak menunjuk laporan induknya.

## File Utama

| Bagian | File |
|---|---|
| Model, enum, constraint | `prisma/schema.prisma`, migration `20260926230000_report_inbox`, `20261001150000_report_flashcard_vocab_enum`, `20261001150100_report_flashcard_vocab_target` |
| Peta kategori dan label | `src/features/report/constants.ts` |
| Label dan petunjuk perbaikan kartu flashcard | `src/features/report/lib/flashcard-target.ts`, `src/features/admin/report/components/flashcard-report-panel.tsx` |
| Tombol laporan kartu | `src/features/flashcard/components/flashcard-reviewer.tsx`, `deck-word-actions.tsx` |
| Unit test peta, skema, migration, privasi | `src/features/report/*.test.ts`, `src/features/report/lib/flashcard-target.test.ts` |
| Validasi submit dan form | `src/features/report/schemas.ts` |
| Action publik | `src/features/report/actions.ts` |
| Form dan tombol | `src/features/report/components/` |
| Template email balasan | `src/features/report/lib/report-reply-mail.ts` |
| Halaman publik | `src/app/(public)/report/` |
| Antrean admin | `src/features/admin/report/`, `src/app/admin/report/` |
| Transport email bersama | `src/lib/mailer.ts` |
