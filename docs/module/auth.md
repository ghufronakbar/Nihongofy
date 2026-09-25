# Modul Authentication

## Status Aktual

Credential auth, Google OIDC, verifikasi email, pemulihan password, session revocation, daftar
perangkat, safe redirect, rate limit, dan Cloudflare Turnstile sudah aktif. MFA dan provider OAuth
selain Google tetap di luar scope.

## Route

- `/login`
- `/register`
- `/verify-email`
- `/verify-email/[token]`
- `/forget-password`
- `/forget-password/[token]`
- `/profile/security` untuk password dan perangkat aktif.
- `/api/auth/google/start`
- `/api/auth/google/callback`

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

## Google OAuth

1. Login dan register memakai Authorization Code flow, PKCE S256, nonce, serta state browser-bound.
2. Transaction OAuth disimpan sekali pakai di Redis selama 10 menit; ID token diverifikasi dengan
   Google JWKS, issuer, audience, nonce, dan schema claim sebelum digunakan.
3. Google `sub` disimpan sebagai `providerAccountId`. Access token dan refresh token tidak disimpan.
4. Email Google yang verified membuat user OAuth-only baru hanya bila email belum terdaftar. Bila
   akun credential existing memakai email tersebut tetapi belum terhubung, login/register Google
   ditolak dan user harus login dengan password dahulu.
5. Connect eksplisit dari `/profile/security` hanya berhasil bila email Google sama persis dengan
   email akun. Disconnect membuat login Google kembali ditolak sampai identity dihubungkan ulang.
6. Akun OAuth-only memiliki `password = NULL`. Pembuatan password pertama, request deletion, dan
   cancel deletion meminta reauthentication Google dengan proof Redis sekali pakai selama 5 menit.
7. Setelah password dibuat, Google dapat diputus hanya dengan password saat ini agar akun tidak
   kehilangan seluruh metode login.

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
- Cron harian `/api/cron/auth-cleanup` menghapus token expired dan bucket rate limit lama, serta
  mengeksekusi akun yang jatuh tempo penghapusan.

## Identifier Login

Login **hanya menerima email**. `User.username` adalah nama publik (handle) yang tampil di
diskusi, bukan kredensial: menjadikannya identifier login berarti identifier semua orang terbaca
dari setiap komentar. Jalur lama "login dengan username" sudah dihapus dari `loginAction`.

Input yang bukan email tetap melewati `bcrypt.compare` terhadap dummy hash supaya waktu respons
tidak membedakan "format salah" dari "password salah".

Aturan handle ada di `src/lib/username.ts`: huruf kecil, angka, titik, underscore, 3–30 karakter,
titik tidak boleh di ujung atau berurutan, unik, dan daftar kata terlarang mencakup segmen route
serta akhiran `_deleted`. Username dibuat otomatis saat register credential maupun Google
(`generateUniqueUsername`, suffix acak agar jumlah user tidak bocor) dan dapat diubah dari
`/profile`.

## Penghapusan Akun (Anonimisasi)

Penghapusan akun **menganonimkan** baris `User`, tidak menghapusnya — lihat `anonymizeAccount`.

Alasannya bukan kenyamanan: `QuestionComment.userId` dulu memakai `onDelete: Cascade`, sehingga
satu penghapusan akun ikut memusnahkan setiap balasan pengguna lain pada thread milik akun itu.
Foreign key tersebut kini `Restrict`.

Yang dilakukan saat jatuh tempo:

- Seluruh comment milik user di-soft delete (`deletedAt`, `deletedById` menunjuk diri sendiri).
  Root menjadi tombstone; balasan orang lain di bawahnya tetap terbaca.
- Data pribadi yang dulu ikut terhapus oleh cascade kini dihapus eksplisit: flashcard beserta
  revlog/card/note/deck/preset/collection, practice session, attempt, kana progress, article
  interaction, conversation session dan quota, auth token, serta `OAuthAccount`. **Melewatkan satu
  relasi berarti data pribadi tertinggal di akun yang mengira dirinya sudah dihapus.**
- `OAuthAccount` wajib dihapus; tanpa itu login Google menghidupkan kembali akun lewat provider
  subject yang masih tertaut.
- Baris user disetel `username = <username_lama>_<unix>_deleted`, `displayName = "Pengguna
  dihapus"`, `email` dan `password` dikosongkan, avatar dihapus, `anonymizedAt` terisi, dan
  `deletionScheduledFor` dikosongkan agar cron tidak memproses ulang.
- Handle lama **ikut dipertahankan** di dalam username anonim (keputusan produk). Konsekuensinya
  jejak identitas pemiliknya tidak sepenuhnya hilang dari baris itu — pertimbangkan ulang bila
  suatu saat ada kewajiban penghapusan yang lebih ketat.
- Handle lama dipotong agar hasilnya muat dalam `VARCHAR(30)`. Dua handle dengan awalan sama yang
  dianonimkan pada detik yang sama menghasilkan string identik, jadi bentrokannya diselesaikan
  dengan salt acak alih-alih menggagalkan cron.
- `loginAction` menolak akun dengan `anonymizedAt` terisi.

## Cloudflare Turnstile

- Widget native Turnstile dimuat satu kali pada layout `(auth)` dan dipakai oleh login, register,
  forgot password, reset password, resend verifikasi, serta konfirmasi email.
- Tombol aksi tetap nonaktif sampai challenge menghasilkan token. Widget di-reset setelah setiap
  respons action karena token hanya berlaku sekali dan kedaluwarsa setelah lima menit.
- Server memanggil Siteverify sebelum menyentuh rate limit, database, session, atau email.
- Respons Siteverify divalidasi sebagai data `unknown`; `success`, `action`, dan hostname harus
  sesuai. Kegagalan jaringan ditolak secara fail-closed.
- Site key boleh dikirim ke browser, sedangkan secret key hanya dibaca melalui constants server.

## Email Immutable

- Email tidak dapat diedit dari profile setelah akun dibuat.
- Purpose `EMAIL_CHANGE` dan `AuthToken.targetEmail` dipertahankan sementara untuk kompatibilitas
  migration, tetapi tidak lagi memiliki issuer atau consumer pada runtime.
- Migration Google OAuth menghapus seluruh token email-change lama sebelum account linking aktif.

## File Utama

- `src/features/auth/actions.ts`
- `src/features/auth/schemas.ts`
- `src/features/auth/lib/auth-token.ts`
- `src/features/auth/lib/email-cooldown.ts`
- `src/features/auth/lib/mailer.ts`
- `src/features/auth/lib/pending-verification.ts`
- `src/features/auth/lib/rate-limit.ts`
- `src/features/auth/lib/google-oauth.ts`
- `src/features/auth/lib/google-oauth-state.ts`
- `src/features/auth/lib/google-account.ts`
- `src/app/api/auth/google/start/route.ts`
- `src/app/api/auth/google/callback/route.ts`
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
- Pastikan email profile read-only dan payload update profile tidak menerima field email.
- Login/register Google untuk email baru: user dibuat verified dengan nama/foto Google dan
  `password = NULL`; redirect internal tetap aman.
- Login/register Google dengan email akun credential existing yang belum terhubung: ditolak dengan
  arahan login password dan tidak membuat user atau relasi baru.
- Setelah connect eksplisit berhasil, login Google dan login password menuju user yang sama tanpa
  membuat duplikat.
- Connect Google dari security memakai email berbeda atau identity milik user lain: callback
  ditolak dan relasi tidak berubah.
- Akun Google-only melihat form Buat Password setelah reauthentication Google; proof expired atau
  replay ditolak. Setelah password dibuat, session lama dicabut dan session saat ini dibuat ulang.
- Disconnect Google dengan password salah ditolak. Akun tanpa password tidak dapat disconnect;
  setelah disconnect, login Google ditolak sampai connect ulang dari profile.
- Cancel OAuth, state/cookie mismatch, nonce invalid, callback replay, dan rate-limit: gagal aman
  tanpa session atau relasi baru.
- Login memakai email saja. Mengirim username sebagai identifier harus gagal dengan pesan
  kredensial generik yang sama.
- Ganti username dari `/profile` tidak boleh memengaruhi kemampuan login.
- Username yang sudah dipakai, berakhiran `_deleted`, atau termasuk kata terlarang harus
  ditolak dengan pesan yang jelas.
- Setelah anonimisasi: login dengan email lama gagal, login Google gagal, thread diskusi yang
  pernah dibalas orang lain masih tampil dengan tombstone, dan balasan orang lain tetap ada.
- Login dengan `next` eksternal seperti `//evil.example`: redirect harus tetap menuju dashboard.
- Panggil cron tanpa bearer secret: harus `401`; dengan secret yang benar: cleanup berhasil.
- Pastikan seluruh form pada route group `(auth)` menampilkan Turnstile dan tombol submit baru aktif
  setelah challenge selesai.
- Submit token kosong, expired, replayed, action mismatch, atau hostname mismatch: action harus
  berhenti sebelum rate limit, query database, perubahan session, atau pengiriman email.
