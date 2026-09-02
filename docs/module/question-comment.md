# Modul Question Comment

## Status Aktual

**Selesai untuk catatan belajar pribadi.** User login dapat menambah, mengedit, menghapus, dan melampirkan gambar pada soal di mode baca dan result detail.

## Scope

- Comment hanya ditampilkan kepada pemiliknya sendiri.
- Ini bukan forum publik, diskusi antar-user, atau komentar pengajar.
- `Question.explanation` adalah pembahasan resmi/terkurasi; `QuestionComment` adalah catatan pribadi dan keduanya dipisahkan.

## Fitur Aktif

- Add/edit/delete dengan Zod validation.
- Maksimum 2.000 karakter dan 4 URL gambar per comment.
- Ownership diverifikasi ulang sebelum update/delete.
- Lampiran di-upload langsung dari browser ke Cloudinary memakai signed parameters.
- Preview image, lightbox, timestamp relatif, label edited, dan dialog delete tersedia.

## Data dan Security

- Comment tersimpan di PostgreSQL dengan relasi user dan question.
- Signature Cloudinary dibuat server-side; API secret tidak dikirim ke browser.
- Folder upload signature dibatasi per user.
- Page query selalu memfilter `userId` session.

## Keterbatasan dan Bug Aktual

- Guest melihat form, tetapi submit diarahkan ke login dan tidak ada comment guest.
- Multi-file uploader memakai closure `value` lama di dalam loop; beberapa upload berurutan dapat saling menimpa sehingga hanya URL terakhir yang tertinggal.
- Menghapus comment atau URL dari form tidak menghapus asset fisik di Cloudinary.
- Schema menerima URL valid dari host mana pun dan belum memastikan URL berasal dari folder Cloudinary user.
- Batas tipe/ukuran file utama dilakukan di client; signature tidak membawa transform/policy upload yang membatasi format/ukuran.
- Tidak ada pencarian, tag, pin, export, atau halaman agregat semua catatan.
- Database development belum memiliki `QuestionComment`, sehingga alur belum teruji oleh data penggunaan aktual pada environment ini.

## File Utama

- `src/features/question-comment/actions.ts`
- `src/features/question-comment/schemas.ts`
- `src/features/question-comment/components/question-comment-form.tsx`
- `src/features/question-comment/components/comment-item.tsx`
- `src/features/question-comment/components/comment-image-uploader.tsx`
- `src/app/api/cloudinary/signature/route.ts`

