# Object Storage (Cloudflare R2)

File upload user disimpan di Cloudflare R2 lewat S3 API. Database hanya menyimpan URL dan object
key; byte file tidak pernah masuk PostgreSQL dan tidak pernah melewati server aplikasi.

## Yang disimpan di R2

| Isi | Object key | Batas |
|---|---|---|
| Avatar profil | `jlpt-exam/avatars/{userId}/<uuid v4>.webp` | 3 MB, tepat 512x512, `image/webp` |
| Lampiran gambar komentar | `jlpt-exam/comments/{userId}/<uuid v4>.<ext>` | 5 MB, `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Media bank soal | `jlpt-exam/test-packages/{fixture}/{audio|images}/{sha12}-<nama-asli>` | Byte sumber dipertahankan; migrator menolak aset di atas 256 MB |

Media bank soal di `src/test-package-data/` memakai URL public CDN R2. Object-nya immutable dan
content-addressed: 12 karakter awal SHA-256 masuk ke key, sedangkan hash lengkap disimpan sebagai
metadata object dan manifest audit. Cloudinary hanya dipertahankan sementara sebagai sumber rollback;
aset asal tidak dihapus oleh migrator.

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

## Media bank soal

Migrasi media bank soal dilakukan offline; credential R2 tidak pernah masuk aplikasi client.
Perintah aman dimulai dari dry-run:

```bash
npm run migrate:test-media:r2 -- --dry-run --file n5-2012-12.json
npm run migrate:test-media:r2 -- --apply --file n5-2012-12.json
npm run migrate:test-media:r2 -- --apply
npm run seed:question-media
```

`--apply` wajib ditulis eksplisit. Untuk setiap URL `https://res.cloudinary.com/...`, migrator:

1. mengunduh satu aset pada satu waktu dan memeriksa kelompok MIME (`audio/*` atau `image/*`);
2. menghitung SHA-256 dan mengunggah object dengan `Cache-Control: public, max-age=31536000,
   immutable`;
3. memverifikasi `HeadObject`, lalu mengunduh URL custom domain publik dan membandingkan ukuran serta
   SHA-256;
4. baru setelah seluruh aset satu paket lolos, menulis manifest
   `docs/pipeline/<fixture>/r2-media-migration.json` dan mengganti URL fixture secara atomik.

Script idempotent. Fixture yang sudah memakai R2 dilewati; object dengan key yang sudah ada dipakai
ulang hanya bila metadata, ukuran, MIME, dan cache header cocok. `seed:question-media` adalah mode
khusus yang hanya menyinkronkan lima kolom media ke PostgreSQL, sehingga teks, instruksi, relasi
context, kunci jawaban, dan nilai attempt lama tidak ikut berubah.

### Pengiriman langsung tanpa proxy Vercel

Renderer bank soal sengaja memakai elemen native `<img>` dan `<audio>`. Browser mengambil byte
langsung dari `R2_PUBLIC_BASE_URL`; tidak ada route handler aplikasi dan tidak ada optimizer
`next/image`, sehingga trafik file tidak dihitung sebagai bandwidth media Vercel. Aturan ini dijaga
oleh `src/lib/question-media-delivery.test.ts`.

Cache mode baca memakai key `test-package-questions-v2` dan tag global
`test-package-question-bank`. Versi key memutus cache lama yang masih menyimpan URL Cloudinary;
untuk migrasi media berikutnya, invalidasi tag global tersedia di `/admin/ops` setelah sinkronisasi
database.

## Cleanup

Avatar yang sudah diunggah tapi profilnya tidak jadi disimpan akan menggantung. Setiap presign
mendaftarkan object key ke sorted set Redis `{REDIS_PREFIX}:r2:pending-avatars` dengan deadline
2 jam; `GET /api/cron/auth-cleanup` menghapus yang sudah jatuh tempo dan tidak dipakai user mana pun.
Avatar lama juga dihapus saat user mengganti fotonya, dan dijadwalkan ulang bila penghapusan gagal.

Lampiran komentar **tidak pernah dihapus**, termasuk saat takedown admin — takedown hanya mengubah
record database. Ini keputusan lama yang tetap berlaku setelah pindah ke R2.

## Catatan migrasi dari Cloudinary

- Seluruh 440 referensi media bank soal pada 48 fixture sudah dipindahkan dan diverifikasi di R2
  pada 10 Oktober 2026. Manifest per paket adalah bukti readback; jangan menghapus aset Cloudinary
  sebelum deployment baru dan uji browser diterima.
- Avatar lama menyimpan `avatarPublicId` Cloudinary yang tidak berekstensi. Object-nya tidak ada di
  R2, jadi `destroyManagedAvatar` mengembalikan `"skipped"` dan file lama tertinggal di Cloudinary.
  Perlu dibersihkan manual di dashboard Cloudinary bila ingin ditutup.
- URL gambar komentar Cloudinary lama tetap diterima server saat komentar disunting, supaya diskusi
  sebelum migrasi tidak rusak.
- Sorted set pending avatar berpindah key dari `cloudinary:pending-avatars` ke `r2:pending-avatars`.
  Entri lama yang tersisa tidak akan diproses lagi.
