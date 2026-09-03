# Modul Profile dan Account Settings

## Status Aktual

**Phase 1.2 telah diverifikasi user pada 3 September 2026.** Integrasi Google OAuth selesai di
kode dan menunggu UAT provider setelah credential Google dikonfigurasi. Semua route profile
dilindungi session dan data di-scope ke user aktif.

## Route

- `/profile`
- `/profile/info`
- `/profile/security`
- `/profile/privacy`
- `/flashcard-settings` sebagai pengaturan belajar mandiri di sidebar.
- `/profile/auth` sebagai redirect kompatibilitas ke security.

## Fitur Aktif

- Overview akun dan tanggal bergabung.
- Statistik jumlah kana yang pernah benar, vocabulary yang sudah dimulai, practice selesai, dan exam selesai.
- Edit display name; email akun tampil read-only dan immutable.
- Username legacy tampil read-only.
- Upload, ganti, atau lepas avatar Cloudinary.
- Timezone IANA dipilih lewat combobox searchable dengan offset UTC untuk batas harian SRS,
  filter tanggal, dan format timestamp user-specific.
- Ganti password dengan validasi password sekarang, atau buat password pertama setelah
  reauthentication Google pada akun OAuth-only. Keduanya mencabut semua session lama.
- Lihat status koneksi Google, hubungkan identity dengan email yang sama, atau putuskan koneksi
  setelah verifikasi password agar akun tidak terkunci.
- Daftar perangkat aktif, revoke satu perangkat, dan logout seluruh perangkat lain.
- Edit/reset preferensi scheduler flashcard melalui route mandiri di luar profile.
- Privacy opt-in terpisah untuk penyimpanan audio dan conversation; default keduanya nonaktif.
- Export JSON untuk data akun dan aktivitas user tanpa password, token, session, atau rate-limit.
- Penghapusan akun dengan re-authentication, logout semua perangkat, grace period 7 hari, login
  recovery, pembatalan, dan hard-delete batch melalui cron.
- Avatar baru memakai public ID unik pada folder user, metadata Cloudinary yang diverifikasi server,
  transform 512x512, batas 3 MB, serta cleanup asset lama dan upload orphan.

## Data dan Caching

- Account dan overview dicache per user.
- Update profile menginvalidasi account/timezone cache dan layout dashboard.
- Aktivitas kana, vocabulary, practice, dan exam menginvalidasi overview cache.
- Flashcard settings memiliki cache/tag per user.

## Definisi Statistik Profile

- Kana dipelajari: stable kana key dengan minimal satu jawaban benar.
- Vocabulary dimulai: flashcard unik yang sudah memiliki progress.
- Latihan cepat selesai: `PracticeSession.status = COMPLETED`.
- Latihan seksi selesai: `Attempt.status = COMPLETED` dan `sectionScope IS NOT NULL`.
- Mock JLPT selesai: `Attempt.status = COMPLETED` dan `sectionScope IS NULL`.

Definisi scope attempt/practice berbagi helper dengan Analytics agar label profile tidak lagi
menggabungkan latihan seksi sebagai mock penuh.

## Lifecycle Penghapusan

- Request wajib frasa `HAPUS AKUN` serta password saat ini, atau reauthentication Google untuk
  akun OAuth-only. Pembatalan memakai metode reauthentication yang sama.
- Semua session Redis dicabut sebelum jadwal disimpan; cookie perangkat peminta ikut dihapus.
- Login valid selama 7 hari membuka halaman pembatalan. Setelah grace period, login ditolak.
- Cron menghapus user dalam batch kecil. Foreign key user-owned memakai `ON DELETE CASCADE`, sehingga
  progress, attempt/jawaban, practice/jawaban, comment, token, setting, dan article interaction ikut
  terhapus.
- Konten global seperti bank soal, flashcard, paket, dan artikel tidak dihapus.
- Avatar dijadwalkan sebagai orphan sebelum row user dihapus. Kegagalan Cloudinary tidak menahan
  penghapusan data akun dan akan dicoba lagi oleh cron.

## Keterbatasan Aktual

- Preference bahasa dan notifikasi belum tersedia.
- Statistik overview masih berupa counter; tren dan rincian tetap berada di Analytics/Progress.
- Metadata ownership lifecycle baru berlaku penuh untuk avatar yang diunggah setelah Phase 1.2;
  URL avatar legacy tetap dapat ditampilkan/dilepas tetapi tidak dihancurkan tanpa public ID tepercaya.

## File Utama

- `src/features/profile/actions.ts`
- `src/features/profile/schemas.ts`
- `src/features/profile/components/profile-form.tsx`
- `src/features/profile/components/avatar-uploader.tsx`
- `src/features/profile/components/change-password-form.tsx`
- `src/features/profile/components/set-password-form.tsx`
- `src/features/profile/components/google-account-panel.tsx`
- `src/features/profile/components/active-sessions.tsx`
- `src/features/profile/components/privacy-preferences-form.tsx`
- `src/features/profile/components/account-lifecycle.tsx`
- `src/features/profile/privacy-actions.ts`
- `src/app/api/account/export/route.ts`
- `src/app/api/cron/auth-cleanup/route.ts`
- `src/features/vocabulary/settings-actions.ts`
- `src/app/(dashboard)/profile/`
