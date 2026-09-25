# Object Storage (Cloudflare R2)

File upload user disimpan di Cloudflare R2 lewat S3 API. Database hanya menyimpan URL dan object
key; byte file tidak pernah masuk PostgreSQL dan tidak pernah melewati server aplikasi.

## Yang disimpan di R2

| Isi | Object key | Batas |
|---|---|---|
| Avatar profil | `jlpt-exam/avatars/{userId}/<uuid v4>.webp` | 3 MB, tepat 512x512, `image/webp` |
| Lampiran gambar komentar | `jlpt-exam/comments/{userId}/<uuid v4>.<ext>` | 5 MB, `image/jpeg`, `image/png`, `image/webp`, `image/gif` |

Media bank soal (audio mondai dan gambar soal) **masih dilayani Cloudinary** sebagai URL read-only di
`src/test-package-data/`. Tidak ada penulisan baru ke Cloudinary; migrasi aset tersebut belum
dikerjakan.

## Environment

```
R2_ACCOUNT_ID=          # Account ID Cloudflare (bukan nama bucket)
R2_ACCESS_KEY_ID=       # R2 API token, izin Object Read & Write
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=https://cdn-nihongofy.lans.my.id
```

Endpoint S3 disusun otomatis menjadi `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region
`auto`, path-style. Seluruh variabel divalidasi zod di `src/constants/index.ts` dan aplikasi gagal
start bila ada yang kosong.

## Setup bucket

1. Buat bucket R2, lalu buat API token bertipe **Object Read & Write** yang dibatasi ke bucket itu.
2. Sambungkan bucket ke custom domain `cdn-nihongofy.lans.my.id` (R2 → Settings → Public access →
   Custom domain). Nilai ini harus sama persis dengan `R2_PUBLIC_BASE_URL`, tanpa trailing slash,
   karena server membandingkan URL yang dikirim client dengan URL yang disusunnya sendiri.
3. **Set CORS pada bucket.** Browser melakukan `PUT` langsung ke endpoint R2; tanpa CORS semua
   upload gagal di preflight:

   ```json
   [
     {
       "AllowedOrigins": ["https://jlpt.lans.my.id", "http://localhost:3000"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## Cara kerja upload

1. Client meminta presigned URL lewat Server Action (`createAvatarUploadAction` atau
   `createCommentImageUploadAction`), mengirim content-type dan ukuran byte.
2. Server memvalidasi dengan zod, menyusun object key di namespace milik user, lalu menandatangani
   `PutObject` berumur **120 detik**. `content-type` dan `content-length` ikut ditandatangani —
   presigner S3 biasanya menandai content-type sebagai unsignable, jadi keduanya dipaksa masuk lewat
   `signableHeaders`. Akibatnya R2 sendiri yang menolak body dengan tipe atau ukuran berbeda, dan
   batas ukuran tidak bergantung pada validasi client.
3. Browser `PUT` langsung ke R2. Kredensial R2 tidak pernah masuk bundle client.
4. Untuk avatar, server memverifikasi ulang sebelum menyimpan ke database: object ada di key milik
   user, masih terdaftar pending, `content-type` `image/webp`, ukuran dalam batas, dan **dimensinya
   512x512** — dibaca dari 64 byte pertama header WebP (`readWebpDimensions`), bukan dari klaim
   client.

R2 tidak punya transformasi gambar seperti Cloudinary, jadi crop tengah dan resize avatar dilakukan
di browser memakai Canvas sebelum upload. Konsekuensinya crop selalu di tengah, bukan content-aware
seperti `g_auto` dulu.

## Cleanup

Avatar yang sudah diunggah tapi profilnya tidak jadi disimpan akan menggantung. Setiap presign
mendaftarkan object key ke sorted set Redis `{REDIS_PREFIX}:r2:pending-avatars` dengan deadline
2 jam; `GET /api/cron/auth-cleanup` menghapus yang sudah jatuh tempo dan tidak dipakai user mana pun.
Avatar lama juga dihapus saat user mengganti fotonya, dan dijadwalkan ulang bila penghapusan gagal.

Lampiran komentar **tidak pernah dihapus**, termasuk saat takedown admin — takedown hanya mengubah
record database. Ini keputusan lama yang tetap berlaku setelah pindah ke R2.

## Catatan migrasi dari Cloudinary

- Avatar lama menyimpan `avatarPublicId` Cloudinary yang tidak berekstensi. Object-nya tidak ada di
  R2, jadi `destroyManagedAvatar` mengembalikan `"skipped"` dan file lama tertinggal di Cloudinary.
  Perlu dibersihkan manual di dashboard Cloudinary bila ingin ditutup.
- URL gambar komentar Cloudinary lama tetap diterima server saat komentar disunting, supaya diskusi
  sebelum migrasi tidak rusak.
- Sorted set pending avatar berpindah key dari `cloudinary:pending-avatars` ke `r2:pending-avatars`.
  Entri lama yang tersisa tidak akan diproses lagi.
