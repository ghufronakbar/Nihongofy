# UAT Google OAuth

Status: **pending provider configuration and user verification**

Gunakan minimal tiga Google account: email baru, email yang sama dengan akun credential existing,
dan email berbeda untuk negative test linking. Jangan memakai akun produksi penting untuk skenario
penghapusan.

## Prasyarat

- Migration `20260903170000_google_oauth_account_linking` berstatus applied.
- Buat OAuth 2.0 Client ID bertipe Web application di Google Cloud Console.
- Tambahkan authorized redirect URI lokal
  `http://localhost:3000/api/auth/google/callback` dan URI production dengan path yang sama.
- Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` pada environment, lalu restart aplikasi.
- Pastikan `APP_URL` sama dengan origin yang sedang diuji. Jika consent screen masih Testing,
  masukkan seluruh Google account penguji sebagai test user.

## Login dan Register

- [ ] Dari `/register`, pilih Google dengan email baru. User dibuat sekali, email verified dan
  lowercase, nama/foto Google terisi, `password` null, session aktif, serta redirect `next` aman.
- [ ] Ulangi login dengan Google identity yang sama. User baru tidak dibuat dan session baru muncul
  pada daftar perangkat.
- [ ] Dari `/login` dan `/register`, pilih Google dengan email akun credential existing yang belum
  terhubung. Callback menolak dengan arahan login password; tidak ada user atau relasi baru.
- [ ] Login password pada akun Google-only memberi pesan generik-actionable yang sama dengan email
  tidak dikenal atau password salah, tanpa membocorkan status akun.
- [ ] Batalkan consent/account picker dari login dan register. User kembali ke halaman asal dengan
  pesan yang tepat dan tidak ada user, OAuthAccount, atau session baru.
- [ ] Uji `next=//evil.example` dan URL eksternal lain. Redirect tetap jatuh ke `/dashboard`.

## Connect dan Disconnect

- [ ] Pada akun credential yang belum terhubung, buka `/profile/security` lalu hubungkan Google
  dengan email yang sama. Status connected dan email provider tampil setelah callback.
- [ ] Ulangi connect identity yang sama. Tidak ada row duplikat dan UI menyatakan sudah terhubung.
- [ ] Pilih Google account dengan email berbeda. Callback ditolak dan relasi tidak berubah.
- [ ] Coba identity Google yang sudah terhubung ke user lain. Callback ditolak sebagai conflict.
- [ ] Putuskan Google dengan password salah lalu password benar. Kasus pertama ditolak; kasus kedua
  menghapus relasi dan mencabut session perangkat lain tanpa mengeluarkan perangkat saat ini.
- [ ] Setelah disconnect, logout lalu coba login Google. Callback menolak sampai Google dihubungkan
  ulang dari `/profile/security`; login password tetap berfungsi.
- [ ] Pastikan akun Google-only tidak dapat memutus Google sebelum membuat password.

## Buat Password dan Account Lifecycle

- [ ] Pada akun Google-only, `/profile/security` menampilkan Buat Password, bukan Ganti Password.
- [ ] Verifikasi ulang memakai Google account yang terhubung, lalu buat password dalam lima menit.
  Hash tersimpan, proof hanya dapat digunakan sekali, dan seluruh session lama sudah dicabut.
- [ ] Ulangi dengan Google account berbeda, proof expired, dan replay proof. Semua harus ditolak.
- [ ] Setelah password dibuat, logout lalu login memakai password dan Google; keduanya menuju user
  yang sama.
- [ ] Pada akun Google-only disposable, request dan cancel account deletion masing-masing hanya
  berhasil setelah reauthentication Google identity yang terhubung.

## Boundary dan Keamanan

- [ ] Hapus/ubah cookie state sebelum callback, replay callback, atau ubah parameter state. Request
  gagal tanpa membuat session atau relasi.
- [ ] Jalankan beberapa start OAuth sampai rate limit tercapai. Server menolak dengan pesan aman.
- [ ] Inspeksi database/export/log: access token, refresh token, authorization code, state, nonce,
  PKCE verifier, dan cookie session tidak tersimpan pada row user/export atau log aplikasi.
- [ ] Periksa mobile dan desktop serta console browser. Tidak ada hydration/runtime error baru.

Setelah seluruh checklist lulus, ubah status menjadi `verified`, tambahkan tanggal/environment, dan
centang item UAT Google OAuth pada roadmap.
