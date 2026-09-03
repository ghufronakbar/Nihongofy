# Modul Authentication

## Status Aktual

Credential auth, verifikasi email, pemulihan password, session revocation, daftar perangkat,
safe redirect, rate limit, dan Cloudflare Turnstile sudah aktif. OAuth serta MFA tetap di luar
scope.

## Route

- `/login`
- `/register`
- `/verify-email`
- `/verify-email/[token]`
- `/forget-password`
- `/forget-password/[token]`
- `/profile/security` untuk password dan perangkat aktif.

## Register dan Verifikasi

1. Register memvalidasi display name, normalized email, password, dan konfirmasi password.
2. Akun dibuat dengan `emailVerifiedAt = null`; session belum dibuat.
3. Token acak 32 byte berlaku 30 menit. Hanya SHA-256 hash token yang disimpan di PostgreSQL.
4. Email CTA membuka halaman validasi, tetapi token baru dikonsumsi melalui tombol konfirmasi
   (POST/Server Action) agar email security scanner tidak mengaktifkan akun.
5. Konfirmasi yang berhasil mengisi `emailVerifiedAt` dan membuat session Redis + JWT.
6. Login dengan password benar pada akun belum verified mengirim ulang email jika cooldown dan
   rate limit mengizinkan, lalu kembali ke `/verify-email`.

## Forgot dan Reset Password

1. `/forget-password` selalu memberi respons generik agar keberadaan akun tidak bocor.
2. Token reset berlaku 15 menit dan maksimal satu token reset aktif per user.
3. Penerbitan token baru mengganti token lama. Token yang kedaluwarsa atau sudah digunakan ditolak.
4. Submit password baru mencabut seluruh session Redis sebelum password dipersist, mengonsumsi
   token secara atomik, membatalkan token auth lain milik user, kemudian mengarahkan user ke login.

## Session dan Perangkat

- JWT HS256 dalam cookie `session` menyimpan `userId` dan UUID `sessionId` selama 7 hari.
- Redis key `auth:session:{sessionId}` menyimpan label browser/perangkat serta timestamp.
- Sorted set `auth:user-sessions:{userId}` menjadi indeks daftar perangkat.
- `getSession()` memverifikasi signature JWT dan keberadaan session Redis. Redis outage fail-closed.
- Aktivitas terakhir hanya diperbarui maksimal sekali per 15 menit untuk menjaga kuota command.
- Maksimal 20 session aktif per akun; session tertua dicabut jika batas terlewati.
- Password change/reset mencabut seluruh session. Password change lalu membuat session baru untuk
  browser saat ini.
- Cookie lama tanpa `sessionId` ditolak sehingga rollout memerlukan login ulang satu kali.

## Cooldown dan Rate Limit

- Cooldown email 60 detik menggunakan Redis `SET NX EX`; TTL Redis adalah sumber kebenaran UI.
- Key cooldown serta bucket rate limit memakai HMAC, bukan email atau alamat IP mentah.
- Verifikasi dan reset password dibatasi per user/email serta per IP selain cooldown.
- Login dan register tetap memakai bucket atomik PostgreSQL pada `AuthRateLimit`.
- Cron harian `/api/cron/auth-cleanup` menghapus token expired dan bucket rate limit lama.

## Cloudflare Turnstile

- Widget native Turnstile dimuat satu kali pada layout `(auth)` dan dipakai oleh login, register,
  forgot password, reset password, resend verifikasi, serta konfirmasi email.
- Tombol aksi tetap nonaktif sampai challenge menghasilkan token. Widget di-reset setelah setiap
  respons action karena token hanya berlaku sekali dan kedaluwarsa setelah lima menit.
- Server memanggil Siteverify sebelum menyentuh rate limit, database, session, atau email.
- Respons Siteverify divalidasi sebagai data `unknown`; `success`, `action`, dan hostname harus
  sesuai. Kegagalan jaringan ditolak secara fail-closed.
- Site key boleh dikirim ke browser, sedangkan secret key hanya dibaca melalui constants server.

## Perubahan Email

- Perubahan email meminta password saat ini.
- `User.email` tidak berubah sebelum link pada alamat baru dikonfirmasi.
- Link perubahan email hanya dapat dikonsumsi ketika session user peminta masih aktif.
- Setelah konfirmasi, seluruh session lama dicabut dan browser konfirmasi mendapat session baru.

## File Utama

- `src/features/auth/actions.ts`
- `src/features/auth/schemas.ts`
- `src/features/auth/lib/auth-token.ts`
- `src/features/auth/lib/email-cooldown.ts`
- `src/features/auth/lib/mailer.ts`
- `src/features/auth/lib/pending-verification.ts`
- `src/features/auth/lib/rate-limit.ts`
- `src/lib/auth.ts`
- `src/lib/redis.ts`
- `src/features/profile/actions.ts`
- `src/proxy.ts`

## Checklist Pengujian Manual

- Register memakai email campuran huruf besar: record database harus lowercase dan belum verified.
- Register memakai alias `nama+1@example.com`: validasi harus menolak sebelum query database.
- Register email duplikat secara bersamaan: unique constraint harus menyisakan tepat satu akun.
- Buka dashboard sebelum verifikasi: tidak boleh ada session authenticated.
- Buka link verifikasi tanpa menekan CTA: token tetap aktif; CTA pertama berhasil dan CTA kedua gagal.
- Kirim ulang verifikasi: tombol mengikuti TTL Redis; mengubah countdown browser tidak melewati
  cooldown, dan link sebelumnya langsung gagal.
- Login akun belum verified dengan password salah: respons tetap invalid credentials dan email
  tidak dikirim. Password benar mengarah ke halaman periksa email.
- Forgot password untuk email ada dan tidak ada: teks respons harus sama.
- Minta dua link reset: hanya link terbaru yang berhasil. Link expired dan link yang sudah dipakai
  harus gagal.
- Setelah reset atau ganti password: seluruh browser lama ditolak pada request protected berikutnya.
- Login pada dua browser: keduanya tampil di `/profile/security`; revoke satu perangkat tidak
  mencabut perangkat saat ini, logout-all-other menyisakan satu session.
- Ubah email tanpa password atau dengan password salah: ditolak. Email akun tidak berubah sebelum
  CTA pada alamat baru dikonfirmasi.
- Akun legacy dengan email hasil backfill tetap dapat login. Akun legacy tanpa email tetap dapat
  login menggunakan username.
- Login dengan `next` eksternal seperti `//evil.example`: redirect harus tetap menuju dashboard.
- Panggil cron tanpa bearer secret: harus `401`; dengan secret yang benar: cleanup berhasil.
- Pastikan seluruh form pada route group `(auth)` menampilkan Turnstile dan tombol submit baru aktif
  setelah challenge selesai.
- Submit token kosong, expired, replayed, action mismatch, atau hostname mismatch: action harus
  berhenti sebelum rate limit, query database, perubahan session, atau pengiriman email.
