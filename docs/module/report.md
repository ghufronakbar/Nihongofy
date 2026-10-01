# Modul Report

## Status Aktual

**Selesai untuk scope v1.** Form laporan publik (guest dan user login), tombol "Laporkan" pada
soal, pembahasan, artikel, dan entri diskusi, antrean admin dengan filter serta aksi status, dan
balasan email opsional per laporan.

Kartu deck bawaan flashcard **tidak** termasuk di v1 — lihat
[Keterbatasan](#keterbatasan-dan-keputusan-yang-ditunda).

## Feature Flag

| Key | Efek saat `false` |
|---|---|
| `FEATURES_REPORT` | `/report` menjadi 404, seluruh tombol "Laporkan" tidak dirender, dan kedua Server Action publik menolak dengan `notFound()`. Antrean `/admin/report` **tetap hidup** |

Antrean admin sengaja tidak ikut mati. Alasan utama mematikan flag ini adalah penyalahgunaan form,
dan justru pada saat itulah laporan yang sudah masuk perlu ditindak. Halaman admin menampilkan
peringatan bahwa form-nya sedang tertutup.

## Scope

Dilaporkan:

| `targetType` | Dari mana | Kolom FK |
|---|---|---|
| `GENERAL` | `/report` | — |
| `QUESTION` | Exam runner, latihan cepat, mode baca paket, review hasil | `questionId` |
| `QUESTION_EXPLANATION` | Kartu pembahasan di mode baca, review hasil, latihan cepat | `questionId` |
| `ARTICLE` | Halaman artikel publik | `articleId` |
| `COMMENT` | Thread diskusi (root dan balasan), permalink, sheet diskusi | `commentId` |

Pembahasan dilaporkan lewat `questionId`, **bukan** id pembahasannya. Pembahasan di-upsert oleh
`seed:question-explanation` dan layar perbaikannya memang `/admin/explanation/[questionId]`, jadi
satu FK melayani dua jenis keluhan tanpa kehilangan apa pun.

## Model Data

Target memakai **FK nyata**, bukan pasangan `(targetType, targetId)` seperti `AdminAuditLog`.
Perbedaannya bukan selera: baris audit harus bertahan setelah targetnya hilang, sedangkan laporan
justru ada untuk membuka targetnya dan memperbaikinya. Sekali laporan tidak dapat di-join, layar
admin berubah menjadi resolusi label per jenis target.

- Ketiga FK target memakai `ON DELETE SET NULL`. Menghapus satu soal tidak boleh ikut menghapus
  laporan bug yang belum ditindak.
- `targetLabel` adalah snapshot teks target saat laporan dibuat (`"N2 Juli 2025 · 文法 · soal 12"`),
  mengikuti pola `AdminAuditLog.actorName`. Tanpa ini, FK yang menjadi null meninggalkan baris yang
  tidak terbaca. Label **selalu** dibangun di server dari baris target; label kiriman client dapat
  dipalsukan dan akan menyuntikkan teks pilihan pelapor ke layar admin.
- `reporterId` nullable (`SET NULL`): guest tidak punya akun, dan akun yang dianonimkan tetap
  meninggalkan laporannya.
- `enum ReportStatus`: `OPEN` → `IN_REVIEW` → `RESOLVED` / `REJECTED` / `DUPLICATE`. `DUPLICATE`
  adalah status, bukan relasi `duplicateOfId` — untuk v1, menunjuk laporan induk belum memberi
  manfaat yang sebanding dengan kolomnya.

### Dua CHECK constraint, dan satu yang sengaja tidak ada

`Report_target_columns_check` menolak laporan yang salah kabel: laporan soal tidak boleh membawa
`articleId`, laporan artikel tidak boleh membawa `commentId`, dan seterusnya.

Sisi "target harus ada" **tidak** ada di database. FK target memakai `ON DELETE SET NULL`, jadi
CHECK yang mewajibkan `questionId IS NOT NULL` untuk `targetType = 'QUESTION'` akan menggagalkan
penghapusan soal itu sendiri. Kewajiban itu ditegakkan `SubmitReportSchema` di
`src/features/report/schemas.ts`.

`Report_reply_shape_check` memastikan `repliedAt` dan `replyMessage` terisi bersama: baris dengan
`repliedAt` tetapi tanpa isi balasan berarti ada email terkirim tanpa jejak.

### Anti-banjir dari satu pelapor

Tiga partial unique index (`questionId`, `articleId`, `commentId`) melarang satu pelapor yang
dikenal punya lebih dari satu laporan `OPEN` pada target yang sama. Guest tidak punya identitas yang
dapat dijadikan kunci, dan di sana rate limit per IP yang bekerja. Pelanggarannya muncul sebagai
`P2002` dan diterjemahkan action menjadi pesan yang jelas, bukan error generik.

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

Dua keputusan di dalam peta itu:

- **`BUG` dan `OTHER` dibuka di semua target.** User yang menemukan "tombol berikutnya tidak jalan
  di soal 12" akan memaksa laporannya masuk kategori yang salah bila satu-satunya pilihan di halaman
  soal adalah kategori konten. Yang dibatasi target adalah kategori *konten*.
- **`ANSWER_KEY` dipisah dari `CONTENT_ERROR`** karena sudah ada alur untuknya:
  `QuestionExplanation.answerKeyDoubt` beserta index-nya. Laporan kunci jawaban dari user dan
  keraguan dari generator adalah antrean yang sama.

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
- `anonymizeAccount()` mengosongkan `reporterId` dan `replyEmail`, tetapi **tidak** menghapus
  laporannya: bug yang dilaporkan tetap perlu ditindak setelah pelapornya pergi.
- Cron `auth-cleanup` mengosongkan `replyEmail` untuk laporan yang sudah ditutup dan lebih tua dari
  `REPORT_REPLY_EMAIL_RETENTION_DAYS` (90 hari). Barisnya dipertahankan sebagai riwayat.

## Keterbatasan dan Keputusan yang Ditunda

- **Kartu flashcard belum dapat dilaporkan.** Sejak perombakan 1 Oktober 2026 hambatan lamanya
  hilang: kartu user kini MERUJUK kata di katalog (`FlashcardVocab`), tidak lagi menyalinnya,
  jadi memperbaiki satu kata di fixture lalu seed langsung memperbaiki kartu semua user. Yang
  belum ada hanya target laporan dan tombolnya; perbaikannya sendiri tetap lewat fixture karena
  katalog tidak punya editor admin.
- Tidak ada notifikasi ke admin saat laporan masuk; angkanya muncul di overview dan sidebar saja.
- Pelapor tidak punya halaman status. Satu-satunya jalur umpan balik adalah balasan email opsional.
- Tidak ada lampiran gambar.
- `DUPLICATE` tidak menunjuk laporan induknya.

## File Utama

| Bagian | File |
|---|---|
| Model, enum, constraint | `prisma/schema.prisma`, migration `20260926230000_report_inbox` |
| Peta kategori dan label | `src/features/report/constants.ts` |
| Validasi submit dan form | `src/features/report/schemas.ts` |
| Action publik | `src/features/report/actions.ts` |
| Form dan tombol | `src/features/report/components/` |
| Template email balasan | `src/features/report/lib/report-reply-mail.ts` |
| Halaman publik | `src/app/(public)/report/` |
| Antrean admin | `src/features/admin/report/`, `src/app/admin/report/` |
| Transport email bersama | `src/lib/mailer.ts` |
