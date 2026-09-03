# Hasil UAT Phase 1.1 Authentication - 3 September 2026

Catatan ini merekam hasil pengujian manual user terhadap checklist Phase 1.1 Authentication.
Seluruh skenario di bawah telah dikonfirmasi berjalan benar pada environment nyata.

| Area | Status | Hasil aktual |
|---|---|---|
| Register dan normalisasi email | PASS | Email campuran huruf besar disimpan dalam lowercase, alias dengan tanda `+` ditolak, dan concurrent duplicate register hanya menghasilkan satu akun. |
| Verifikasi email | PASS | Akun baru tidak mendapat session sebelum verified; membuka link tidak mengonsumsi token; CTA hanya berhasil sekali. |
| Resend dan cooldown | PASS | Countdown mengikuti TTL Redis 60 detik, manipulasi UI tidak melewati cooldown, dan token lama tidak valid setelah token baru diterbitkan. |
| Login akun belum verified | PASS | Password salah tidak mengirim email; password benar mengarahkan user ke flow periksa email dan resend sesuai limiter. |
| Forgot dan reset password | PASS | Respons untuk email terdaftar dan tidak terdaftar tetap generik; hanya token terbaru yang berlaku; token expired atau used ditolak. |
| Revocation session | PASS | Reset atau ganti password mencabut session lama. Registry Redis memvalidasi `sessionId` JWT tanpa memerlukan `sessionVersion`. |
| Multi-device | PASS | Session dari beberapa browser tampil di halaman keamanan; revoke satu perangkat dan logout semua perangkat lain bekerja sesuai target. |
| Perubahan email | PASS | Password saat ini wajib benar, email lama tetap aktif sebelum CTA dikonfirmasi, dan session lama dicabut setelah perubahan berhasil. |
| Akun legacy | PASS | Akun hasil backfill tetap dapat login dengan email dan akun tanpa email tetap dapat menggunakan username. |
| Safe redirect | PASS | Nilai `next` eksternal tidak dapat mengalihkan user ke luar aplikasi. |
| Cleanup dan rate limit | PASS | Rate limit, token expiry, serta cleanup aktif; endpoint cron tanpa bearer secret mengembalikan `401` dan secret yang benar menjalankan cleanup. |
| Scope credential auth | PASS | OAuth dan MFA tetap di luar scope Phase 1.1 sesuai keputusan produk. |

## Hasil Acceptance

Seluruh checklist Phase 1.1 Authentication diterima user pada 3 September 2026. Modul
Authentication dinyatakan selesai untuk scope credential auth saat ini.
