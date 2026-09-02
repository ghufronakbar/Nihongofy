# Modul Authentication

## Status Aktual

**Selesai untuk credential auth dasar.** Register, login, logout, route protection, ownership check, password hashing, JWT session, safe redirect, dan database-backed rate limit sudah aktif.

## Route

- `/login`
- `/register`
- Logout dipanggil dari sidebar melalui Server Action.
- URL lama `/first-time-setup` diarahkan permanen ke `/register` oleh `next.config.ts`.

## Alur Utama

1. Register memvalidasi display name, normalized email, password, dan konfirmasi password.
2. Password di-hash dengan bcrypt cost 12.
3. Session JWT HS256 dibuat dalam cookie `session` selama 7 hari.
4. Login menerima email; username masih diterima untuk akun legacy.
5. Query `next` hanya boleh internal relative path agar tidak menjadi open redirect.
6. `src/proxy.ts` melakukan optimistic route guard; layout dan Server Action tetap memverifikasi session/owner.

## Data dan Security

- User dan bucket rate limit disimpan di PostgreSQL melalui Prisma.
- Rate-limit key berupa HMAC, bukan email/IP mentah.
- Login memakai dummy bcrypt hash saat user tidak ditemukan untuk mengurangi perbedaan timing.
- Pesan kegagalan login/register dibuat generik.
- Session stateless; tidak ada session table atau daftar device/session aktif.
- Login dibatasi 8 percobaan per identifier dan 30 per IP dalam 15 menit; register 4 per email dan 12 per IP per jam.

## Kondisi Legacy

- `User.email` masih nullable untuk akun lama.
- `User.username` nullable dan hanya dipakai sebagai bridge login akun legacy.
- Belum ada flow khusus untuk memaksa akun legacy mengisi email selain edit profile setelah login.

## Fitur Belum Ada dan Risiko

- Verifikasi email, forgot/reset password, OAuth, MFA, role/permission, dan delete account.
- Password policy hanya panjang 8-72 karakter/byte, tanpa aturan kompleksitas.
- Ganti password membuat JWT baru di browser aktif, tetapi tidak mencabut JWT lama pada device lain.
- Logout hanya menghapus cookie browser aktif.
- IP rate limit bergantung pada header proxy; deployment harus memastikan header tersebut tidak dapat dipalsukan client.
- Tidak terlihat cleanup periodik untuk row `AuthRateLimit` lama.

## File Utama

- `src/features/auth/actions.ts`
- `src/features/auth/schemas.ts`
- `src/features/auth/lib/rate-limit.ts`
- `src/features/auth/lib/safe-redirect.ts`
- `src/lib/auth.ts`
- `src/proxy.ts`

