# Fase 3 - Kana dan Vocabulary Foundation

Tanggal selesai: 26 Agustus 2026

## Hasil

Fase 3 menambahkan area belajar kana dan vocabulary yang mengikuti bahasa visual neo-brutalist
`reference_ui_web`, tetapi menggunakan session, database, dan ownership model aplikasi utama.
Tidak ada progress palsu atau local-only yang ditampilkan sebagai progress akun.

## Kana

- Route protected `/kana/hiragana` dan `/kana/katakana`.
- Fixture lengkap 46 karakter dasar per script dengan stable key, grup bunyi, romaji, dakuten,
  dan handakuten.
- Grid responsif, pencarian kana/romaji, filter grup, dan empty state.
- Flashcard memakai native `button`, flip 3D, focus ring, serta dukungan Enter/Space dari semantic control.
- Web Speech API `ja-JP` memakai capability/error fallback; kegagalan audio tidak memblokir kartu.
- Mode review mencatat viewed, `Ingat`, dan `Ulangi` ke `KanaProgress` per user.
- Counter kana memakai atomic PostgreSQL upsert agar event flip dan grade yang berdekatan tidak saling
  menimpa saat row pertama kali dibuat.

## Vocabulary dan SRS

- Route protected `/vocab` dan `/vocab/[deckSlug]`.
- Enam deck awal, 32 kartu terkurasi dari baseline reference, dan tujuh tag.
- Deck menampilkan level JLPT, jumlah kartu, kartu baru, serta kartu jatuh tempo milik user.
- Browse mode memiliki flip, reading, romaji, arti, tag, contoh penggunaan, audio, previous, dan next.
- Review mode memiliki queue deterministik serta rating `Again`, `Hard`, `Good`, dan `Easy`.
- `Again` dijadwalkan 10 menit; rating lain memperbarui interval hari, ease factor, repetition, dan lapse.
- Setiap rating memperbarui `FlashcardProgress` dan membuat `FlashcardReviewLog` dalam satu transaksi.
- Completed queue dan empty deck memiliki state khusus.
- Progress satu kartu dipakai lintas deck untuk mencegah kartu yang sama dianggap baru berulang kali.

## Database

Model baru:

- `KanaProgress`
- `FlashcardDeck`
- `Flashcard`
- `FlashcardDeckItem`
- `FlashcardTag`
- `FlashcardTagLink`
- `FlashcardProgress`
- `FlashcardReviewLog`

Migration:

- `prisma/migrations/20260826111355_phase_3_kana_vocabulary/migration.sql`
- Seluruh foreign key memiliki index yang sesuai pola query.
- Constraint nonnegative menjaga counter dan nilai scheduler.
- RLS aktif pada delapan tabel baru tanpa policy Data API.
- Grant table dan sequence untuk `anon`, `authenticated`, dan `service_role` dicabut.

Seed:

- `npm run seed:learning`
- Stable identity memakai key/slug.
- Upsert content dan rebuild join deck/tag secara deterministik.
- Dua kali eksekusi menghasilkan jumlah yang sama: 32 kartu, 6 deck, 7 tag.

## Verifikasi

Berhasil:

- `npx prisma validate`
- `npx prisma generate`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npx prisma migrate deploy`
- `npx prisma migrate status`
- Seed idempotency dua kali.
- Test database sementara untuk persistence, review log, isolasi dua user, RLS, dan Data API grants.
- Browser QA Codex Desktop pada desktop 1440x900 dan mobile 390x844.
- Browser QA filter kana, grading kana, persistence setelah refresh, browse/review vocabulary, rating
  `Good`, queue `31 -> 30`, serta kartu berikutnya setelah refresh.
- Tidak ada horizontal overflow pada halaman kana atau vocabulary.
- Tidak ada error console pada halaman Fase 3.

Akun dan progress yang dibuat khusus untuk QA telah dihapus setelah verifikasi; data user asli tidak
diubah.
