# Modul Vocabulary dan SRS

## Status Aktual

**Fungsional, tetapi content catalog masih kecil.** Browse deck, review SRS, due queue, daily limit, review log, dan settings per user sudah tersambung ke database.

## Route

- `/vocab`
- `/vocab/[deckSlug]?mode=browse`
- `/vocab/[deckSlug]?mode=review`
- `/profile/flashcard-settings`

## Fitur Aktif

- Daftar deck published dengan jumlah kartu baru dan due.
- Browse previous/next tanpa mengubah jadwal.
- Review queue: kartu due lebih dulu, lalu kartu baru berdasarkan urutan deck.
- Rating `Again`, `Hard`, `Good`, dan `Easy`.
- Scheduler menyimpan state learning/review, due date, interval, ease, repetition, lapse, dan learning step.
- Daily limit dihitung mulai 00.00 Asia/Jakarta.
- Pengaturan scheduler lengkap dapat disimpan atau direset per user.
- Review update dan review log dibuat dalam satu transaksi.

## Data Aktual

- 32 flashcard.
- 6 deck published yang saling overlap berdasarkan level/tag.
- 7 tag.
- Mayoritas kartu N5; hanya satu kartu N4 pada fixture saat ini.
- Tidak ada `audioUrl`; audio selalu fallback ke `speechSynthesis` browser.

## Guest Mode

- Guest dapat browse semua kartu dan membuka mode review.
- Rating guest hanya mengubah alur client; progress, log, due date, dan daily limit tidak disimpan.
- Setelah refresh, semua kartu kembali dianggap baru.
- Setelah antrean guest selesai, copy UI dapat mengatakan kartu sudah tersimpan pada akun, padahal guest tidak memiliki persistence.

## Keterbatasan Aktual

- Belum ada content N3, N2, atau N1 walaupun UI memakai istilah deck lintas level.
- Algoritma SRS adalah implementasi custom, bukan implementasi resmi Anki/FSRS.
- Tidak ada halaman history review, statistik retention, suspend/bury, custom deck, atau reset progress per kartu.
- Recorded audio belum tersedia.
- Queue dibuat saat server render. Kartu ber-rating `Again` yang due lagi beberapa menit kemudian tidak otomatis masuk kembali tanpa reload.
- Daily limit berlaku global lintas deck karena review log tidak menyimpan/memfilter deck.
- Pengecekan count limit dan write review berada pada langkah terpisah, sehingga submit serentak dari beberapa tab secara teori dapat melewati limit.
- Zona waktu Asia/Jakarta masih hardcoded, belum menjadi preference user.
- Belum ada automated test untuk scheduler dan boundary settings.

## File Utama

- `src/features/vocabulary/actions.ts`
- `src/features/vocabulary/lib/scheduler.ts`
- `src/features/vocabulary/lib/settings.ts`
- `src/features/vocabulary/settings-actions.ts`
- `src/features/vocabulary/components/vocabulary-study.tsx`
- `prisma/seed-learning.mjs`
