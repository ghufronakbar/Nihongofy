# Modul Admin Dashboard

## Status Aktual

**Seluruh tahap selesai (1-7).** Yang sudah berjalan: role statis
`USER`/`ADMIN`, `requireAdmin()`, shell `/admin` dengan sidebar sendiri, overview yang membaca
kondisi database secara langsung, pengelolaan bank soal termasuk import fixture dan editor soal,
antrean dan editor pembahasan dengan alur persetujuan, CRUD artikel dengan workflow
draft/published/archived, antrean moderasi diskusi publik dengan takedown, antrean laporan pengguna
dengan balasan email opsional, dan pengelolaan akun user.

Tidak ada area yang masih berupa placeholder. Sisa pekerjaan yang tercatat terbuka di
`docs/plan.md`: uploader media di bank soal (editor soal dan wacana baru menerima URL yang
ditempel), rate limit posting dan notifikasi balasan di moderasi, serta aksi membersihkan
retensi conversation yang sudah lewat.

Operasi konten yang belum punya layar (pembahasan, katalog flashcard) **masih dijalankan lewat
script CLI** di `prisma/`. Untuk bank soal dan artikel, UI dan CLI kini berbagi jalur kode yang sama
sehingga keduanya tetap tersedia dan tidak dapat menyimpang satu sama lain — lihat
[Berbagi kode dengan CLI](#berbagi-kode-dengan-cli).

## Berbagi kode dengan CLI

Admin dashboard pada dasarnya adalah pemindahan pipeline seed ke UI. Yang dihindari di sini
adalah menyalin logikanya: dua salinan kontrak atau dua jalur tulis akan berbeda diam-diam
begitu salah satunya diubah.

| Dipakai bersama | CLI | Admin |
|---|---|---|
| `prisma/test-package-contract.mjs` — kontrak fixture (zod) | `seed:test-package` dan turunannya | validasi layar import |
| `prisma/import-test-package.mjs` — transaksi tulis paket | `seed:test-package` | action import |
| `src/features/article/lib/body-text.ts` — turunan `bodyText` | disalin di `seed-articles.mjs` | action artikel |

Dua modul `.mjs` itu menerima client Prisma sebagai argumen, karena CLI memakai `PrismaClient`
sendiri sementara aplikasi memakai singleton `src/lib/prisma`. `test-package-contract.mjs`
sengaja tidak mengimpor `node:fs`/`node:path`/`node:url`: ia ikut ter-bundle ke aplikasi lewat
Server Action, dan sentuhan filesystem di top level membuat bundler gagal me-resolve-nya. Helper
yang membaca disk tetap di `test-package-fixture.mjs`, yang hanya dipakai CLI.

`articleBodyToPlainText()` adalah satu-satunya yang masih tersalin, karena script `.mjs` tidak
dapat mengimpor TypeScript. Kedua salinannya diberi komentar silang.

### Yang sudah ada

| Bagian | File |
|---|---|
| `enum UserRole` + `User.role` + index | `prisma/schema.prisma`, migration `20260925150000_user_role` |
| `getSessionUser()`, `requireAdmin()` | `src/lib/auth.ts` |
| Shell, sidebar, dan guard | `src/app/admin/layout.tsx`, `src/components/admin-sidebar.tsx` |
| Overview | `src/app/admin/page.tsx`, `src/features/admin/queries.ts` |
| Placeholder area yang belum jadi | `src/features/admin/components/admin-placeholder.tsx` |
| Promote/demote admin | `npm run user:role` (`prisma/set-user-role.mjs`) |
| CMS artikel | `src/features/admin/article/`, `src/app/admin/article/` |
| `articleBodyToPlainText()` | `src/features/article/lib/body-text.ts` |
| Moderasi diskusi | `src/features/admin/moderation/`, `src/app/admin/moderation/` |
| Laporan pengguna | `src/features/admin/report/`, `src/app/admin/report/` — rancangan di [report.md](report.md) |
| `QuestionComment.deletedById` | migration `20260925180000_comment_deleted_by` |
| Bank soal | `src/features/admin/test-package/`, `src/app/admin/test-package/`, `src/app/admin/question/` |
| Pembahasan | `src/features/admin/explanation/`, `src/app/admin/explanation/` |
| User dan akun | `src/features/admin/user/`, `src/app/admin/user/` |
| Conversation | `src/features/admin/conversation/`, `src/app/admin/conversation/` |
| Operasional | `src/features/admin/ops/`, `src/app/admin/ops/` |
| Audit log | `src/features/admin/audit.ts`, migration `20260925210000_admin_audit_log` |
| Kontrak fixture dan jalur import bersama | `prisma/test-package-contract.mjs`, `prisma/import-test-package.mjs` |

## Prasyarat: Role Statis

`docs/project-rules.md` §4 menyatakan bahwa role hierarchy memerlukan persetujuan terpisah.
Persetujuan itu sudah diberikan dengan bentuk paling sederhana: **dua role statis**, tanpa
permission granular dan tanpa tabel role/permission.

```prisma
enum UserRole {
  USER
  ADMIN
}
```

- Kolom `User.role` bertipe `UserRole` dengan `@default(USER)` dan `@@index([role])`.
- Migrasi ditulis tangan sebagai SQL lalu dijalankan dengan `prisma migrate deploy`.
  `prisma migrate dev` tidak dipakai di project ini karena shadow database Supabase
  (lihat `docs/operations/migrations.md`).
- Admin pertama dipromosikan lewat script, **tidak** lewat UI. Tidak ada bootstrap "user pertama
  jadi admin" — model itu sudah pernah dihentikan di modul auth dan tidak dihidupkan lagi.

```bash
npm run user:role -- --list
npm run user:role -- --email operator@contoh.com --role ADMIN
npm run user:role -- --id 1 --role USER
```

Script menolak menurunkan admin terakhir: tanpa admin sama sekali, satu-satunya jalan kembali
adalah menjalankan script itu lagi dengan akses shell ke database.

### Penempatan role: database, bukan JWT

JWT session saat ini hanya membawa `userId` dan `sessionId`
([`src/lib/auth.ts`](../../src/lib/auth.ts)). Role **tidak boleh** ikut dimasukkan ke payload
JWT: token berlaku 7 hari, sehingga demote admin baru berlaku setelah token kedaluwarsa.

Helper baru di `src/lib/auth.ts`:

- `getSessionUser()` — mengembalikan session plus `role` hasil query database.
- `requireAdmin()` — memverifikasi session dan `role === "ADMIN"`; melempar `notFound()` bila
  tidak, bukan `redirect("/login")`, supaya keberadaan area admin tidak bocor ke user biasa.

Bila biaya query per request menjadi masalah, `role` boleh disimpan di metadata session Redis
(`auth:session:{sessionId}`) karena registry itu dapat dicabut seketika — bukan di JWT.

### Dua lapis guard, dan kenapa proxy tidak ikut

1. `src/app/admin/layout.tsx` — memanggil `requireAdmin()`.
2. **Setiap** Server Action admin memanggil `requireAdmin()` sendiri. Layout tidak melindungi
   Server Action.

Halaman admin juga memanggil `requireAdmin()` masing-masing. Biayanya nol karena `getSessionUser()`
dibungkus `cache()` per request, dan halaman tidak ikut rusak bila suatu saat dipindah keluar dari
layout ini.

`/admin` sengaja **tidak** didaftarkan di `src/proxy.ts`. Proxy tidak membaca database sehingga
hanya bisa membedakan "ada session" dan "tidak ada", dan justru itulah yang membocorkan
keberadaan area admin: guest akan di-redirect ke `/login?next=/admin` — bukti bahwa route itu
ada dan dilindungi — sementara user biasa mendapat 404. Dengan guard hanya di layout, guest dan
user biasa mendapat 404 yang identik. Proxy di sini tidak menambah keamanan apa pun, hanya
kebocoran; aturan "proxy bukan satu-satunya batas" tetap dipatuhi karena batas sesungguhnya
memang bukan di proxy.

## Route

Route group terpisah dari `(dashboard)` agar sidebar, header, dan guard tidak bercampur dengan
area user.

| Route | Isi | Status |
|---|---|---|
| `/admin` | Overview | selesai |
| `/admin/test-package` | Daftar paket tes | selesai |
| `/admin/test-package/[id]` | Detail paket: mondai, soal, context | selesai |
| `/admin/test-package/import` | Import fixture JSON | selesai |
| `/admin/question/[id]` | Editor satu soal | selesai |
| `/admin/context/[id]` | Editor wacana bersama | selesai |
| `/admin/explanation` | Antrean pembahasan: belum ada, belum direview, `answerKeyDoubt` | selesai |
| `/admin/explanation/[questionId]` | Editor dan approval pembahasan | selesai |
| `/admin/article` | Daftar artikel | selesai |
| `/admin/article/[id]` | Editor artikel | selesai |
| `/admin/article/new` | Artikel baru | selesai |
| `/admin/user` | Daftar user | selesai |
| `/admin/user/[id]` | Detail dan aksi akun | selesai |
| `/admin/moderation` | Antrean diskusi publik dan catatan belajar | selesai |
| `/admin/conversation` | Pemakaian dan kuota conversation | selesai |
| `/admin/ops` | Feature flag (read-only), cache, audit log | selesai |

## Feature Flag

Admin **tidak** memakai `FEATURES_*`. Aksesnya ditentukan oleh role, bukan flag modul, dan
mematikan admin lewat env justru mengunci operator dari alat pemulihannya sendiri.

Konsekuensi flag modul lain terhadap admin:

- Layar admin milik modul yang flagnya mati tetap dapat dibuka. Operator perlu memperbaiki
  data justru saat modul publiknya dimatikan.
- Layar admin menampilkan status flag modul terkait sebagai peringatan ("Modul ini sedang
  nonaktif untuk publik"), bukan menyembunyikan diri.

## Area Fitur

### 1. Overview

Angka yang saat ini hanya bisa didapat dengan query manual:

- Paket tes per level, dibandingkan dengan jumlah file fixture di `src/test-package-data/`
  (25 September 2026: 48 fixture, 48 paket di database, kelima level terisi).
- Soal tanpa pembahasan (25 September 2026: 1.417 dari 4.825).
- Pembahasan bertanda `answerKeyDoubt`.
- Pembahasan `source = AI` yang `reviewedAt`-nya masih null.
- Jumlah user, attempt 7 hari terakhir, dan permintaan penghapusan akun yang tertunda.
- Entri diskusi publik baru sejak kunjungan terakhir.

### 2. Bank Soal

Prioritas tertinggi karena inilah satu-satunya jalur konten yang sekarang sepenuhnya CLI.

- **Browse** paket per level dan tahun, lihat mondai, soal, pilihan, dan context.
- **Import fixture** — porting `npm run seed:test-package` ke UI. Validator yang sama dipakai
  (`prisma/test-package-fixture.mjs`), hasil validasi ditampilkan sebelum commit, dan guard
  existing tetap berlaku: satu paket diimpor dalam satu transaksi, paket parsial diblokir, dan
  replacement ditolak bila paket sudah memiliki attempt.
- **Editor soal** — memperbaiki hasil OCR tanpa mengedit JSON lalu re-seed: `questionText`,
  markup furigana `{漢字|かんじ}`, underline `__teks__`, slot `[_]`/`[★]`, teks pilihan,
  `questionAnswer`, dan `instruction` mondai. Mengubah kunci jawaban ikut menurunkan ulang
  `QuestionExplanationChoice.isCorrect`, yang merupakan denormalisasi dari kunci itu.
- **Editor wacana bersama** — teks, gambar, dan audio `QuestionContext`. Satu wacana dipakai
  beberapa soal sekaligus, jadi layarnya menyebut berapa banyak dan menautkan semuanya.
  Menolak wacana yang tidak punya teks, gambar, maupun audio, sama seperti kontrak fixture.
- **Media** — upload dan ganti audio/gambar soal ke Cloudflare R2. Per 25 September 2026 database
  punya 227 context audio, 144 question image, 1 context image, tetapi **0** question audio, dan
  tidak ada jalur upload selain fixture.
- **Hapus paket** — porting `npm run test-package:delete` dengan konfirmasi dan pengecekan
  attempt.

### 3. Pembahasan Soal

Per 25 September 2026 cakupannya sudah 3.408 dari 4.825 soal (71%) setelah generator dijalankan
massal — jauh membaik dari 20 soal saat audit awal. Yang belum ada justru sisi kurasinya:
**3.380 pembahasan bersumber AI dan belum satu pun direview manusia** (`reviewedAt` kosong),
sementara copy di `/test-package` sudah menjanjikan "pembahasan lengkap".

- **Pembuatan pembahasan tetap di CLI, dan itu bukan kekurangan yang akan ditutup.**
  `gen:explanation` membaca dan menulis file fixture di `src/test-package-data/` dan tidak
  menyentuh database sama sekali, sehingga hasilnya harus ikut masuk repository. Menjalankannya
  dari aplikasi ter-deploy mustahil: filesystem Vercel read-only dan ephemeral. Layar antrean
  karena itu menampilkan perintah yang perlu dijalankan beserta paket mana yang paling
  menyisakan pekerjaan, bukan tombol yang tidak mungkin bekerja.
- **Editor dan approval** — `summary`, `detail`, `translation`, `keyPoints`, dan alasan per
  pilihan. Approval mengisi `reviewedAt` dan mengubah `source` dari `AI` ke `HUMAN`. Kedua
  kolom itu sudah ada di schema dan sampai sekarang tidak pernah terisi.
- **Antrean `answerKeyDoubt`** — soal yang ditandai generator sebagai kunci jawaban meragukan,
  beserta `answerKeyDoubtNote`. Persetujuan ditolak selama penanda ini aktif. Mengubah kunci
  jawabannya sendiri tetap dilakukan di editor soal, supaya perubahan data soal tidak
  tersembunyi di dalam layar pembahasan.
- **Antrean `missing` menyebut komposisinya.** Per 25 September 2026 seluruh 1.417 soal tanpa
  pembahasan adalah CHOUKAI: generator melewatinya karena fixture hanya menyimpan URL audio
  tanpa transkrip. Sisa itu tertahan transkripsi, bukan kapasitas review.

### 4. Artikel

Enum `ArticleStatus` sudah punya `DRAFT`, `PUBLISHED`, dan `ARCHIVED`, tetapi seed selalu
memaksa `PUBLISHED` dan tidak ada UI yang memakai ketiganya.

- CRUD artikel dengan editor body JSON tervalidasi Zod (bentuknya mengikuti `Article.body`).
- `bodyText` di-regenerate otomatis dari body, seperti yang dilakukan seed.
- Kelola `ArticleTag` dan `ArticleTagLink`, toggle `isFeatured`, dan atur `publishedAt`.
- Transisi status draft → published → archived, akhirnya memakai enum yang sudah ada.

### 5. Katalog Flashcard

- Editor deck bawaan (`/admin/flashcard-deck`) **dihapus 1 Oktober 2026** bersama perombakan
  modul flashcard. Katalog kini satu daftar kosakata yang digenerate AI, dengan fixture
  `src/flashcard-data/` sebagai sumber kebenaran; editor di database akan tertimpa setiap seed.
- Overview admin hanya menampilkan jumlah kata terbit, kata yang dipensiunkan, dan jumlah deck.
- Perbaikan isi kata dilakukan di fixture lalu `npm run seed:flashcard`; kata bertanda ragu
  ditinjau lewat `npm run flashcard:doubts`. Layar tinjauan untuk itu belum ada.

### 6. Moderasi Diskusi Publik

Area ini naik prioritas karena fitur berbagi catatan dan balasan komentar sudah aktif
(Fase 8.7, commit `5058247`; lihat [question-comment.md](question-comment.md)). Fitur itu
mengubah `QuestionComment` dari catatan pribadi menjadi **satu-satunya konten buatan user yang
terlihat publik, termasuk oleh guest**, lengkap dengan halaman permalink
`/discussion/[commentId]`.

Checklist Fase 8.7 di `docs/plan.md` menutup dirinya dengan menyerahkan empat hal ke tahap ini:
moderasi, notifikasi balasan, rate limit posting, dan pembersihan asset storage. Tiga yang
pertama ada di bawah; pembersihan asset **tidak** masuk scope admin (lihat catatan storage).

Bentuk data yang relevan untuk admin:

- `visibility` (`PRIVATE` / `PUBLIC`) menentukan apakah isi root ditampilkan.
- `sharedAt` menentukan keanggotaan thread publik dan tidak pernah dikosongkan lagi, sehingga
  root yang dikembalikan ke privat tetap tampil sebagai tombstone di atas balasannya.
- `parentId` memisahkan root dari balasan; balasan hanya satu tingkat.
- `deletedAt` adalah soft delete. Aplikasi **tidak pernah** hard delete, karena balasan user
  lain menempel pada root. Artinya riwayat penuh selalu tersedia untuk admin.
- Root yang dihapus atau disembunyikan tetap tampil sebagai tombstone selama masih punya
  balasan, tetapi **balasan yang dihapus langsung hilang tanpa tombstone**. Takedown sebuah
  balasan karena itu tidak meninggalkan jejak yang terlihat pembaca sama sekali. Matriks
  lengkapnya ada di [question-comment.md](question-comment.md#aturan-tampil-root).
- Isi root non-`VISIBLE` dibuang di layer query (`toDiscussionRoot()`), bukan di JSX. Query
  admin yang menampilkan konten yang sudah di-takedown harus memakai jalur sendiri dan tidak
  boleh melonggarkan helper itu.
- `FEATURES_QUESTION_DISCUSSION` sudah menjadi kill switch terpisah dari
  `FEATURES_QUESTION_COMMENT`, sehingga diskusi publik dapat dimatikan saat ada penyalahgunaan
  tanpa ikut mematikan catatan pribadi user.

Fitur admin yang dibutuhkan:

- **Antrean** root publik dan balasan terbaru lintas soal, dengan filter soal, user, dan
  rentang tanggal.
- **Unpublish paksa** (set `visibility = PRIVATE`) dan **soft delete paksa** oleh admin.
  Action existing memakai `requireOwnLiveComment()` yang menolak non-pemilik, jadi admin
  memerlukan action tersendiri — jangan longgarkan guard kepemilikan yang ada.
- **Sembunyikan lampiran, jangan hapus filenya.** Takedown menghentikan gambar tampil di
  aplikasi lewat `visibility`/`deletedAt`. File asli di `jlpt-exam/comments/{userId}` **tidak
  dihapus** dari object storage — lihat catatan storage di bawah.
- **Riwayat per user** — semua kontribusi publik satu user dalam satu layar, untuk menilai pola
  penyalahgunaan sebelum mengambil tindakan akun.
- **Rate limit posting.** Saat ini pembuatan catatan dan balasan tidak punya rate limit sama
  sekali; yang ada hanya batas 2.000 karakter dan 4 gambar. Pola bucket atomik `AuthRateLimit`
  sudah ada dan dapat dipakai ulang — jangan bikin mekanisme baru.
- **Buka indexing setelah moderasi aktif.** `/discussion` sekarang `noindex` lewat metadata
  layout **dan** `disallow` di `robots.ts`, keduanya dengan komentar eksplisit bahwa ini
  menunggu dashboard admin. Membalik keduanya adalah deliverable tahap ini, bukan pekerjaan
  terpisah. Catatan: `robots.txt` di-prerender saat build, jadi perubahannya baru berlaku
  setelah redeploy.

**Notifikasi balasan** juga diserahkan ke tahap ini oleh Fase 8.7, tetapi sebenarnya bukan
fitur admin: aplikasi belum punya sistem notifikasi sama sekali. Sampai ada, penulis catatan
tidak tahu catatannya dibalas — dan digabung dengan tidak adanya mekanisme laporan dari user,
penyalahgunaan hanya ketahuan bila admin memeriksa antrean secara aktif.

### 7. User dan Akun

- Daftar user dengan search dan filter: admin, status verifikasi email, punya OAuth, menunggu
  dihapus. Filter "terakhir aktif" tidak ada — tidak ada kolom `lastActiveAt`, dan aktivitas
  session hidup di Redis sehingga tidak dapat di-query massal. Detail user menampilkan attempt
  terakhir sebagai gantinya, karena itu memang tersimpan di database.
- **Tidak pernah** menampilkan `password` (hash sekalipun) atau token apa pun.
- Promote/demote `role`.
- Revoke session — registry Redis dan helper-nya sudah ada di `src/lib/auth.ts`; admin cukup
  memanggilnya, jangan memanipulasi key Redis langsung.
- Reset bucket `AuthRateLimit` untuk user yang terkunci. Key disimpan sebagai HMAC sehingga
  pencarian harus lewat helper yang sama dengan yang membuatnya, bukan query mentah.
- Lihat dan batalkan `deletionRequestedAt` / `deletionScheduledFor`.

### 8. Conversation

`ConversationQuota` mencatat pemakaian harian per user, dan komentar di schema menyatakan
penegakan batasnya menyusul. Observability admin adalah prasyarat sebelum kuota benar-benar
ditegakkan.

- Pemakaian per user per hari: turn, detik audio, token input/output.
- Turn dengan `moderationFlagged = true`.
- Session dengan `retentionExpiresAt` yang sudah lewat tetapi belum dibersihkan.
- Konten transcript hanya ditampilkan bila `transcriptRetained = true`. Consent user tetap
  mengikat admin.

### 9. Operasional

- **Feature flag read-only.** Flag dibaca sekali saat server start dari env
  (`src/constants/index.ts`), jadi admin hanya dapat menampilkan status aktualnya. Membuat flag
  dapat diubah dari UI berarti memindahkannya ke database atau Edge Config — perubahan
  arsitektur tersendiri, bukan sekadar layar baru, dan di luar scope awal.
- **Invalidasi cache manual** — tombol untuk memicu tag di
  [`src/constants/cache-key.ts`](../../src/constants/cache-key.ts) tanpa redeploy.
- **Audit log admin** — `AdminAuditLog` mencatat aktor, aksi, target, dan ringkasan satu baris.
  Untuk aksi yang menulis ke database, lognya ditulis di transaksi yang sama, jadi tidak pernah
  ada mutasi tanpa catatannya. Untuk aksi yang efeknya di Redis, lognya ditulis setelahnya dan
  kegagalan menulis log tidak dilaporkan sebagai kegagalan aksi — aksinya sudah terjadi dan tidak
  dapat dibatalkan.

## Aturan yang Wajib Diikuti

Aturan project yang existing tetap berlaku penuh di area admin:

- **Validasi Zod** di setiap Server Action sebelum menyentuh database, schema di
  `src/features/admin/*/schemas.ts`.
- **Cache invalidation.** Setiap mutasi admin wajib memanggil tag yang sesuai dari
  `CACHE_TAGS`. Mengedit soal tanpa `revalidateTag(CACHE_TAGS.testPackageQuestions(id))` akan
  membuat halaman publik menyajikan data basi tanpa gejala yang terlihat.
- **Pengecualian diskusi.** Thread dan hitungannya sengaja tidak di-`unstable_cache` dan tidak
  punya entri di `CACHE_TAGS`, karena isinya berubah setiap ada balasan. Aksi moderasi karena
  itu tidak perlu invalidasi apa pun — dan jangan menambahkan cache di jalur itu hanya supaya
  seragam dengan modul lain.
- **Data-leak guard.** Admin boleh melihat `questionAnswer` dan `explanation`, tetapi query dan
  komponen admin harus terpisah dari jalur exam. Jangan menggunakan ulang select atau komponen
  milik modul exam untuk kebutuhan admin, dan jangan melonggarkan
  `QUESTION_EXPLANATION_SELECT` demi admin.
- **Isolasi data user tetap berlaku untuk non-admin.** Membuka akses lintas user hanya di
  belakang `requireAdmin()`, tidak pernah dengan menghapus filter `userId` pada action existing.
- **Object storage: jangan hapus asset.** Admin tidak pernah memanggil API storage untuk menghapus
  file yang sudah diunggah. Takedown bekerja di level record database saja, sehingga gambar
  berhenti tampil tanpa menyentuh storage. Pembersihan asset fisik adalah urusan bagian lain,
  bukan modul ini. Presigned URL tetap dibuat server-side dengan object key dibatasi per user.

## Perubahan Schema yang Dibutuhkan

| Perubahan | Alasan |
|---|---|
| `enum UserRole` + `User.role` | Prasyarat seluruh modul |
| ~~`AdminAuditLog`~~ | Sudah dibuat di Tahap 7 |
| `QuestionComment.deletedBy` (opsional) | Membedakan hapus oleh pemilik dan takedown oleh admin; sekarang `deletedAt` tidak menyimpan siapa pelakunya |
| Penanda suspend posting publik pada `User` | Tidak ada cara menghentikan user yang berulang kali menyalahgunakan diskusi selain menghapus akunnya |
| Bucket rate limit posting | Pembuatan catatan/balasan sekarang tanpa batas laju; pola `AuthRateLimit` dapat dipakai ulang |

Tiga yang terakhir bersifat opsional untuk versi pertama, tetapi `deletedBy` dan penanda
suspend menjadi wajib begitu diskusi publik benar-benar dipakai oleh banyak user.

## Keterbatasan dan Keputusan Terbuka

- Role statis dua level berarti tidak ada peran editor, moderator, atau reviewer terpisah.
  Siapa pun yang dapat memperbaiki typo soal juga dapat menghapus akun user.
- Tidak ada mekanisme laporan dari user. Moderasi sepenuhnya bergantung pada admin yang
  memeriksa antrean secara aktif.
- Modul ini besar: sekitar 15 route dan beberapa perubahan schema. Prasyarat role, Bank Soal,
  dan Pembahasan sudah menutup gap yang paling menyakitkan bila scope perlu dipotong.
- Modul lain punya cakupan test yang minim (hanya flashcard yang punya unit test). Aksi admin
  bersifat destruktif, sehingga minimal action import, hapus paket, dan takedown perlu test.

## File Utama (Rencana)

- `prisma/schema.prisma` — `UserRole`, `User.role`, `AdminAuditLog`
- `prisma/migrations/<timestamp>_user_role/migration.sql`
- `src/lib/auth.ts` — `getSessionUser()`, `requireAdmin()`
- `src/proxy.ts` — prefix `/admin`
- `src/app/admin/layout.tsx`
- `src/features/admin/*/` — actions, queries, schemas, components per area
- `src/constants/cache-key.ts` — tag baru untuk entitas yang belum punya
- `docs/project-rules.md` §4 — perbarui catatan role hierarchy
