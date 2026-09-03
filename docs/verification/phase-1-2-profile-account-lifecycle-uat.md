# UAT Phase 1.2 - Profile dan Account Lifecycle

Status: **verified by user on 3 September 2026**

Gunakan akun utama untuk timezone/privacy/export. Gunakan akun disposable untuk seluruh skenario
penghapusan agar data belajar utama tidak berisiko.

## Prasyarat

- Migration `20260903113000_phase_1_2_profile_account_lifecycle` sudah berstatus applied.
- Restart dev server setelah `prisma generate` agar proses lama tidak menahan Prisma Client versi sebelumnya.
- Cron `/api/cron/auth-cleanup` memakai `Authorization: Bearer <CRON_SECRET>`.
- Cloudinary dan Redis memakai environment yang sama dengan aplikasi yang diuji.

## Timezone

- [x] Buka `/profile/info`, simpan `Asia/Jakarta`, lalu coba nilai satu kartu vocabulary. Counter
  harian tetap konsisten sebelum dan sesudah refresh.
- [x] Ubah ke `Asia/Tokyo`; timestamp pada Profile, Security, Dashboard, History, Progress, dan
  riwayat paket bergeser sesuai timezone tanpa hydration error.
- [x] Di Analytics, uji `Minggu ini`, `Bulan ini`, `30 hari terakhir`, dan custom date. Attempt pada
  boundary tengah malam masuk ke tanggal lokal yang benar.
- [x] Isi timezone IANA invalid; form menolak dan database tidak berubah.

## Privacy dan Export

- [x] Pastikan dua opt-in pada `/profile/privacy` default nonaktif untuk akun baru.
- [x] Simpan setiap kombinasi kedua checkbox, refresh, lalu pastikan nilainya persisten secara terpisah.
- [x] Unduh JSON export dan cocokkan profil, kana, vocabulary, attempt/jawaban, practice/jawaban,
  comment, serta article interaction dengan data akun.
- [x] Cari `password`, `tokenHash`, cookie/session token, dan row rate-limit di export; semuanya tidak
  boleh ada. Export akun A juga tidak boleh berisi data akun B.
- [x] Logout lalu buka `/api/account/export`; request diarahkan ke login atau berakhir `401` tanpa
  mengunduh data.

## Avatar

- [x] Upload JPG, PNG, dan WebP di bawah 3 MB; simpan profile lalu refresh. Avatar tetap tampil.
- [x] Coba file selain format tersebut dan file di atas 3 MB; client menolak sebelum upload.
- [x] Manipulasi payload save menggunakan URL/public ID cloud atau folder user lain; server menolak.
- [x] Ganti avatar yang sudah tersimpan; asset lama hilang dari Cloudinary dan avatar baru tetap ada.
- [x] Upload avatar lalu tinggalkan halaman tanpa menyimpan. Setelah grace orphan 2 jam dan cron
  berjalan, asset upload tersebut terhapus.
- [x] Lepas avatar lalu simpan; asset managed terhapus dan fallback initials tampil.

## Account Deletion

- [x] Pada akun disposable, password salah atau frasa selain `HAPUS AKUN` tidak membuat jadwal.
- [x] Request valid langsung mengeluarkan semua perangkat dan menampilkan konfirmasi pada login.
- [x] Login dengan kredensial benar selama grace period menuju `/profile/privacy` dan menampilkan
  waktu penghapusan sesuai timezone akun.
- [x] Cancel dengan password salah ditolak; cancel valid mengosongkan jadwal dan akun kembali normal.
- [x] Request ulang, ubah `deletionScheduledFor` akun disposable ke masa lalu, lalu jalankan cron.
  Login harus ditolak dan row user beserta seluruh relasi user-owned sudah terhapus.
- [x] Pastikan bank soal, flashcard, paket ujian, serta artikel global tidak ikut terhapus.
- [x] Jika Cloudinary sementara gagal, data akun tetap terhapus dan public ID avatar tetap berada di
  antrean Redis untuk retry cron berikutnya.

## Statistik Profile

- [x] `Mock JLPT` hanya menghitung Attempt completed dengan `sectionScope = null`.
- [x] `Latihan seksi` hanya menghitung Attempt completed dengan `sectionScope != null`.
- [x] `Latihan cepat` hanya menghitung PracticeSession completed.
- [x] Kana dan vocabulary mengikuti definisi pada `docs/module/profile.md` dan cocok dengan data owner.

Seluruh checklist dikonfirmasi lulus oleh user. Detail browser dan akun disposable tidak disimpan
di repository karena tidak diperlukan sebagai data produk.
