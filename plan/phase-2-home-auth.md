# Fase 2 - Home, Login, dan Register

Tanggal selesai: 26 Agustus 2026

## Hasil

Fase 2 menyelesaikan narasi home berdasarkan `reference_ui_web`, mengaktifkan registrasi
multi-user, mempertahankan akun legacy beserta seluruh relasinya, dan menutup akses langsung
Supabase Data API ke tabel aplikasi.

### Home

- Hero memiliki CTA kontekstual untuk register/login atau dashboard/mock test.
- Alur belajar menjelaskan pilih target, kerjakan fokus, dan bedah hasil.
- Feature overview menampilkan kana, vocabulary, latihan cepat, dan mock JLPT.
- Mock JLPT berstatus `Tersedia` dan tetap menuju engine existing.
- Kana, vocabulary, latihan cepat, conversation, dan speaking diberi label `Preview`.
- Conversation dan speaking memiliki spotlight terpisah tanpa klaim AI, rekaman, atau transkripsi production.
- Featured article memakai empty state jujur sampai content seed Fase 5 tersedia.
- Seluruh komposisi mengikuti token neo-brutalist Fase 1 dan memiliki mobile collapse eksplisit.

### Auth multi-user

- Register meminta display name, email, password, dan konfirmasi password.
- Email dinormalisasi ke lowercase dan dijaga oleh unique constraint.
- Login utama memakai email; username lama tetap didukung sebagai compatibility bridge.
- Password memakai bcrypt cost 12 dan field login/register memiliki show/hide control.
- Loading, client validation, inline server error, generic invalid credential, dan safe `next` aktif.
- Registrasi sukses langsung membuat session dan menuju internal `next` atau `/dashboard`.
- Duplicate registration ditangani oleh Prisma `P2002` tanpa membedakan response akun existing.

### Rate limit

- Login identifier: 8 percobaan per 15 menit.
- Login IP: 30 percobaan per 15 menit.
- Register email: 4 percobaan per 60 menit.
- Register IP: 12 percobaan per 60 menit.
- Bucket memakai atomic Postgres upsert dan menyimpan HMAC-SHA256, bukan identifier mentah.
- Bucket terkait dihapus setelah login/register sukses.

### Migrasi dan keamanan Supabase

Migration `20260825210118_phase_2_multi_user_auth` telah diterapkan.

- Menambah `displayName`, nullable `email`, nullable `avatarUrl`, dan nullable legacy `username`.
- Membackfill `displayName` akun existing dari username tanpa mengarang email.
- Menambah tabel `AuthRateLimit`.
- Menambah tujuh index foreign key yang sebelumnya hilang.
- Mencabut table, sequence, dan function privilege dari `anon`, `authenticated`, dan `service_role`.
- Mengubah default privilege role `postgres` agar object Prisma baru tidak otomatis terekspos.
- Mengaktifkan RLS pada seluruh tabel aplikasi dan `_prisma_migrations` tanpa client policy.

Default ACL milik `supabase_admin` pada schema `public` masih merupakan konfigurasi platform.
Object yang dibuat melalui Prisma dimiliki `postgres` dan memakai default ACL yang sudah aman.
Object baru yang dibuat dari Supabase Dashboard tetap perlu diaudit karena dapat memakai owner
`supabase_admin`.

## Preservasi data

- Akun existing tetap `id = 1` dengan username `lanstheprodigy`.
- `displayName` akun existing dibackfill menjadi `lanstheprodigy`.
- Email akun existing tetap `NULL`; tidak ada email yang ditebak.
- Delapan attempt existing tetap terhubung ke akun yang sama.
- Tidak ada user, attempt, atau comment existing yang dihapus.

## Verifikasi

Perintah yang lolos selama implementasi:

- `npx prisma format`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run lint -- --quiet`
- `npx tsc --noEmit`
- `npm run build`
- `npx prisma migrate status`
- `git diff --check`

Smoke test route:

| Route | Hasil |
|---|---|
| `/` | `200`, narrative Fase 2 ter-render |
| `/login` | `200`, email/username legacy field ter-render |
| `/register` | `200`, form register aktif |
| `/first-time-setup` | `308` ke `/register` |
| `/dashboard` tanpa session | `307` ke `/login?next=%2Fdashboard` |
| `/test-package?id=x` tanpa session | `307` dengan query `next` yang aman |

Server Action end-to-end:

- Invalid register mengembalikan inline email validation.
- Register valid membuat user, cookie session, dan redirect `/dashboard`.
- Dashboard setelah register menampilkan display name user baru.
- Login salah mengembalikan generic invalid credential.
- Login email valid membuat session dan membuka dashboard.
- Percobaan login kesembilan diblok selama 15 menit.
- User dan bucket tes dihapus setelah verifikasi.

Database verification:

- Seluruh 11 tabel public memiliki RLS aktif.
- Tidak ada table, sequence, atau function privilege Data API tersisa.
- Uji dua user dalam transaksi rollback menghasilkan user A melihat 1 attempt dan 1 comment,
  sedangkan query milik user B melihat 0 attempt dan 0 comment.
- Duplicate email menghasilkan 0 row baru.

Browser visual automation tidak tersedia pada environment. QA visual diganti dengan render HTML
server lokal, responsive source audit, focus/reduced-motion audit, dan smoke test route. Screenshot
desktop/mobile tetap menjadi verifikasi manual yang disarankan sebelum Fase 3.
