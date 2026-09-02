# Modul Profile dan Account Settings

## Status Aktual

**Selesai untuk pengaturan akun dasar dan preferensi SRS.** Semua route profile dilindungi session dan data di-scope ke user aktif.

## Route

- `/profile`
- `/profile/info`
- `/profile/security`
- `/profile/flashcard-settings`
- `/profile/auth` sebagai redirect kompatibilitas ke security.

## Fitur Aktif

- Overview akun dan tanggal bergabung.
- Statistik jumlah kana yang pernah benar, vocabulary yang sudah dimulai, practice selesai, dan exam selesai.
- Edit display name dan normalized email.
- Username legacy tampil read-only.
- Upload, ganti, atau lepas avatar Cloudinary.
- Ganti password dengan validasi password sekarang dan rotasi cookie session.
- Edit/reset preferensi scheduler flashcard.

## Data dan Caching

- Account dan overview dicache per user.
- Update profile menginvalidasi account cache dan layout dashboard.
- Aktivitas kana, vocabulary, practice, dan exam menginvalidasi overview cache.
- Flashcard settings memiliki cache/tag per user.

## Keterbatasan Aktual

- Menghapus/mengganti avatar hanya mengubah URL database; asset lama tidak dihapus dari Cloudinary.
- Upload berlangsung sebelum profile disimpan; cancel atau kegagalan save dapat meninggalkan asset orphan.
- Validasi URL avatar memastikan host Cloudinary, tetapi belum memastikan resource berasal dari cloud/folder aplikasi sendiri.
- Perubahan email tidak memerlukan password atau verifikasi email baru.
- Belum ada delete account, export seluruh data akun, privacy controls, timezone setting, language setting, atau notification preference.
- Belum ada session/device management dan logout-all.
- Rotasi password tidak mencabut JWT yang sudah terbit pada device lain.
- Statistik overview hanya counter, bukan tren atau detail aktivitas.
- Password reset berada di luar modul ini dan belum tersedia.

## File Utama

- `src/features/profile/actions.ts`
- `src/features/profile/schemas.ts`
- `src/features/profile/components/profile-form.tsx`
- `src/features/profile/components/avatar-uploader.tsx`
- `src/features/profile/components/change-password-form.tsx`
- `src/features/vocabulary/settings-actions.ts`
- `src/app/(dashboard)/profile/`
