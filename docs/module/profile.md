# Modul Profile dan Account Settings

## Status Aktual

**Phase 1.2 telah diverifikasi user pada 3 September 2026.** Integrasi Google OAuth selesai di
kode dan menunggu UAT provider setelah credential Google dikonfigurasi. Semua route profile
dilindungi session dan data di-scope ke user aktif.

## Feature Flag

Profile tidak punya flag sendiri. Section "Aktivitas belajar" dan "Lanjut belajar" mengikuti flag modul:

- Statistik: "Kana pernah benar" (`FEATURES_KANA`), "Kartu dipelajari" (`FEATURES_FLASHCARD`), "Latihan cepat selesai" (`FEATURES_PRACTICE`), serta "Latihan seksi selesai" dan "Mock JLPT" (`FEATURES_TEST_PACKAGE`). Susunan grid menyesuaikan jumlah kartu yang tampil, dan section hilang bila tidak ada kartu.
- Quick action: Latih kana, Buka flashcard, Latihan cepat, dan Lihat analytics mengikuti flag modul tujuannya; section hilang bila semuanya mati.
- Link "Edit akun" berada di section aktivitas, sehingga ikut hilang bila section itu tidak dirender. Halaman `/profile/info` tetap dapat dibuka lewat navigasi profile.
- Query overview tetap menghitung semua statistik walau sebagian tidak ditampilkan.

## Route

- `/profile`
- `/profile/info`
- `/profile/security`
- `/profile/privacy`
- `/profile/follow-requests` untuk permintaan follow masuk (`FEATURES_FOLLOW`).
- `/u/[username]` sebagai profil publik — modul tersendiri, lihat [Komunitas](community.md).
- `/flashcard/settings` sebagai pengaturan flashcard mandiri, di luar profile (lihat
  [Flashcard](flashcard.md)).
- `/profile/auth` sebagai redirect kompatibilitas ke security.

## Fitur Aktif

- Overview akun dan tanggal bergabung.
- Statistik jumlah kana yang pernah benar, vocabulary yang sudah dimulai, practice selesai, dan exam selesai.
- Edit display name; email akun tampil read-only dan immutable.
- Bio (teks polos satu baris, maksimal 160 karakter) dan target level JLPT untuk profil publik.
  Field-nya hanya tampil bila `FEATURES_PUBLIC_PROFILE` aktif; nilainya tetap ikut tersimpan dari
  `defaultValues` saat field disembunyikan.
- Tombol "Lihat profil publik" di overview dan section "Profil publik" (toggle public/private) di
  `/profile/privacy`, keduanya mengikuti `FEATURES_PUBLIC_PROFILE`.
- Username legacy tampil read-only.
- Upload, ganti, atau lepas avatar di Cloudflare R2.
- Timezone IANA dipilih lewat combobox searchable dengan offset UTC untuk batas harian SRS,
  filter tanggal, dan format timestamp user-specific.
- Ganti password dengan validasi password sekarang, atau buat password pertama setelah
  reauthentication Google pada akun OAuth-only. Keduanya mencabut semua session lama.
- Lihat status koneksi Google, hubungkan identity dengan email yang sama, atau putuskan koneksi
  setelah verifikasi password agar akun tidak terkunci.
- Daftar perangkat aktif, revoke satu perangkat, dan logout seluruh perangkat lain.
- Pengaturan flashcard (ukuran teks, furigana, penjadwalan) ada di `/flashcard/settings`, di luar
  profile.
- Privacy opt-in terpisah untuk penyimpanan audio dan conversation; default keduanya nonaktif.
  Toggle audio hanya tampil bila `FEATURES_SPEAKING` aktif, toggle conversation bila
  `FEATURES_CONVERSATION` aktif, dan seluruh box "Izin penyimpanan AI" hilang bila keduanya mati.
- `/profile/privacy` menautkan [Kebijakan Privasi dan Syarat & Ketentuan](public-shell.md#dokumen-hukum)
  di bawah judulnya.
- Export JSON untuk data akun dan aktivitas user tanpa password, token, session, atau rate-limit.
  Laporan yang pernah dikirim ikut, untuk semua jenis target, tanpa status dan catatan internal
  admin. Pada attempt yang belum `COMPLETED`, `isCorrect` per jawaban dikirim `null`: nilai itu
  turunan kunci jawaban, sementara sesi lama masih dapat disubmit ulang selama attempt berjalan
  (`withoutUnsubmittedGrades`, `src/features/profile/lib/account-export.ts`).
- Penghapusan akun dengan re-authentication, logout semua perangkat, grace period 7 hari, login
  recovery, pembatalan, dan hard-delete batch melalui cron.
- Avatar baru memakai object key unik pada folder user (`jlpt-exam/avatars/{userId}/<uuid>.webp`),
  di-crop dan di-resize ke 512x512 WebP di browser lalu diverifikasi ulang server lewat HeadObject
  dan pembacaan header WebP, batas 3 MB, serta cleanup asset lama dan upload orphan.
- Presigned PUT mengikat content-type dan content-length, sehingga R2 menolak upload di luar batas
  tanpa bergantung pada validasi client.

## Data dan Caching

- Account dan overview dicache per user. Overview (`getProfileOverview` di
  `src/features/profile/overview.ts`, server-only) dipakai bersama `/u/[username]` dan punya
  `revalidate: 600`, karena review flashcard tidak menginvalidasi tag-nya.
- Update profile menginvalidasi account/timezone cache dan layout dashboard.
- Aktivitas kana, practice, dan exam menginvalidasi overview cache. Review flashcard tidak; angka
  "Kartu dipelajari" diperbarui paling lambat 10 menit lewat `revalidate`.
- Pengaturan flashcard dibaca langsung dari `FlashcardCollection` tanpa cache tag.

## Definisi Statistik Profile

- Kana dipelajari: stable kana key dengan minimal satu jawaban benar.
- Kartu dipelajari: kata flashcard dengan minimal satu review (`FlashcardCard.reps > 0`).
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
- Avatar dijadwalkan sebagai orphan sebelum row user dihapus. Kegagalan R2 tidak menahan
  penghapusan data akun dan akan dicoba lagi oleh cron.
- Avatar warisan Cloudinary (object key tanpa ekstensi) dilewati saat penghapusan: objeknya tidak ada
  di R2, jadi file lama tertinggal di Cloudinary dan perlu dibersihkan manual.

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
- `src/features/profile/lib/account-export.ts`
- `src/app/api/cron/auth-cleanup/route.ts`
- `src/features/vocabulary/settings-actions.ts`
- `src/app/(dashboard)/profile/`
