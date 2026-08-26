# Fase 0 - Baseline dan guardrail

Tanggal eksekusi: 26 Agustus 2026

## Status

Baseline aplikasi utama sudah stabil dan audit source-level Fase 0 selesai. Public register belum
boleh diaktifkan karena konfigurasi akses database Supabase masih memiliki release blocker yang
harus diselesaikan melalui migration/konfigurasi pada fase berikutnya.

Tidak ada perubahan schema Prisma, migration, atau data existing pada fase ini. Row sementara
yang dibuat untuk tes isolasi dua user sudah dibersihkan dan diverifikasi kembali berjumlah nol.

## Keputusan implementasi

- `reference_ui_web` adalah source of truth untuk visual, komposisi, dan baseline behavior fitur
  yang belum tersedia.
- Fitur baru boleh dimulai dengan fixture atau simulasi seperti reference selama diberi label
  `Demo`/`Preview` dan tidak mengklaim AI, persistence, atau analytics production.
- Fitur yang sudah tersedia, terutama mock test JLPT, tetap memakai engine, data, scoring,
  ownership, dan security existing. Reference hanya mengarahkan UI/UX-nya.

## Baseline sebelum guardrail

| Pemeriksaan | Hasil awal |
|---|---|
| `npm run lint` | Gagal: 21 error dan 38 warning; mayoritas berasal dari `reference_ui_web`, ditambah 2 error aplikasi utama |
| `npx tsc --noEmit` | Gagal karena alias, dependency, dan mock module milik `reference_ui_web` ikut diperiksa oleh root TypeScript |
| `npm run build` | Compile berhasil, lalu gagal pada typecheck file reference |
| `npx prisma validate` | Lolos |

Folder reference bukan bagian runtime project utama. Root tooling sekarang mengecualikan folder
tersebut; reference tetap tersedia untuk audit desain dan pemetaan behavior secara terpisah.

## Guardrail yang diterapkan

- Mengecualikan `reference_ui_web` dari root TypeScript dan ESLint.
- Mengganti deteksi mobile berbasis effect dengan `useSyncExternalStore` agar sesuai React 19.
- Mendokumentasikan inisialisasi state Embla carousel yang memang harus terjadi setelah API siap.
- Mengganti React Hook Form `watch()` dengan `useWatch()` agar React Compiler tidak melewati
  optimasi komponen comment.
- Memisahkan cache global question bank dari query comment private per `session.userId`.
- Menghapus invalidasi cache question bank saat comment private berubah karena comment tidak lagi
  berada di cache global.
- Membatasi signed Cloudinary folder ke `jlpt-exam/comments/<session.userId>`.
- Memindahkan seed database ke script CLI di `prisma/` sehingga tidak ada endpoint seed yang
  terekspos dari aplikasi.

## Hasil verifikasi akhir

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint` | Lolos tanpa warning |
| `npx tsc --noEmit` | Lolos |
| `npm run build` | Lolos |
| `npx prisma validate` | Lolos |
| Schema database | PostgreSQL 17.6; Prisma schema valid |

HTTP smoke test tanpa session:

- `/` mengarah ke `/login` karena database existing sudah memiliki user;
- `/login` merender 200;
- `/dashboard`, `/test-package`, dan `/api/ping` mengarah ke `/login`;
- tidak ada endpoint seed yang terekspos dari aplikasi.

HTTP smoke test dengan session valid:

- `/dashboard`;
- `/test-package` dan detail package;
- mode baca semua soal;
- `/history`;
- `/progress`;
- `/analytics`;
- result summary dan detail review;
- `/api/ping`.

Seluruh route di atas merespons 200. Tidak dilakukan submit exam baru atau perubahan data user
existing selama smoke test.

## Tes isolasi dua user

Tes sementara menggunakan dua user bertanda khusus dan satu private comment:

1. User A dapat membaca comment miliknya sendiri.
2. User B tidak menerima comment User A pada payload/render mode baca.
3. Kedua user sementara tidak mewarisi attempt existing, dan User B tidak memiliki comment User A.
4. Seluruh user/comment tes dihapus melalui cleanup terarah.
5. Query verifikasi setelah cleanup menemukan nol row bertanda Fase 0.

Tes ini membuktikan perbaikan cache comment. Coverage dua-user harus diperluas lagi setelah model
register, preference, practice, article interaction, dan conversation tersedia.

## Temuan keamanan dan reliability

### Release blocker database

Audit read-only pada Supabase menemukan seluruh tabel `public`, termasuk `User`, `Attempt`,
`QuestionComment`, dan `_prisma_migrations`, memiliki privilege penuh untuk role `anon` dan
`authenticated`, sementara RLS tidak aktif pada seluruh tabel tersebut.

Jika Data API aktif, konfigurasi ini dapat mengekspos password hash dan seluruh data aplikasi
secara langsung di luar ownership check Prisma. Sebelum public register atau deployment publik:

1. Matikan Data API jika aplikasi tetap hanya mengakses database melalui Prisma; atau
2. Buat migration yang mencabut grant `anon`/`authenticated`, mencabut default privilege untuk
   object baru, dan hanya membuka object yang memang diperlukan.

Jangan membuat policy `auth.uid() = userId`: aplikasi memakai custom JWT dengan numeric `User.id`,
bukan Supabase Auth UUID. RLS tidak boleh dijadikan pengganti ownership check Server Action.

Changelog Supabase terbaru juga menyatakan auto-exposure tabel sedang berubah menjadi opt-in,
tetapi project existing tetap harus diaudit dan diamankan secara eksplisit.

### Index database

Terdapat tujuh foreign key tanpa leading index:

- `Attempt.testPackageId`;
- `Attempt.userId`;
- `AttemptAnswer.questionId`;
- `Question.questionContextId`;
- `QuestionComment.questionId`;
- `QuestionComment.userId`;
- `QuestionContext.testPackageId`.

Index tersebut harus ditambahkan bersama migration auth/multi-user agar join, ownership filter,
dan cascade tidak berubah menjadi sequential scan saat data membesar. Composite index tambahan
harus mengikuti query nyata, misalnya attempt per user/status/tanggal.

### Guardrail lanjutan

- Register/login belum memiliki rate limit.
- JWT stateless belum memiliki mekanisme revocation atau session version setelah password berubah.
- Full mock session yang sudah disubmit masih perlu guard server-side agar tidak dapat dibuka dan
  di-upsert ulang melalui URL/action langsung sebelum attempt selesai.
- Endpoint health sebaiknya tidak mengembalikan raw database error pada production.
- Visual QA desktop/mobile belum dijalankan karena tidak ada browser backend yang terhubung pada
  environment ini. Ini tetap acceptance gate pada fase UI.

## Gate menuju Fase 1

Urutan aman sebelum public registration:

1. Putuskan Data API dimatikan atau grant dicabut melalui migration.
2. Tambahkan index foreign key dan composite index yang sudah teridentifikasi.
3. Implementasikan route architecture, public home, `/register`, dan auth email bertahap tanpa
   menghapus user existing.
4. Tambahkan rate limit serta verifikasi session/user pada data access layer.
5. Jalankan kembali tes dua-user sebelum membuka register ke publik.
