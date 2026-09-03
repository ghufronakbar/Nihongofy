# Modul Flashcard (paritas Anki)

## Status Aktual

**Fungsional. Fase A sampai G selesai, kecuali impor `.apkg`.** Modul vocabulary lama (SM-2 custom) sudah dihapus dan
diganti fondasi baru yang meniru model data Anki. Belum ada route, UI, scheduler, atau konten;
yang ada baru skema database dan definisi tipe.

Desain lengkap dan alasan tiap keputusan ada di [`docs/plan/anki-parity-flashcard.md`](../plan/anki-parity-flashcard.md).

## Yang Sudah Ada (Fase A)

- Skema database `Flashcard*` baru: `FlashcardCollection`, `FlashcardPreset`, `FlashcardDeck`,
  `FlashcardNote`, `FlashcardCard`, `FlashcardRevlog`, `FlashcardImportJob`.
  Migration `20260903190000_flashcard_anki_parity_foundation`.
- `src/features/flashcard/note-types.ts` — 5 note type yang didefinisikan aplikasi
  (`BASIC`, `BASIC_REVERSED`, `VOCAB_JP`, `KANJI`, `CLOZE`), lengkap dengan field dan
  template kartu, plus perhitungan jumlah kartu per note (termasuk cloze `{{c1::}}`).
- `src/features/flashcard/schemas.ts` — validasi zod untuk seluruh deck options Anki,
  parameter FSRS-6, nama deck hierarkis, dan rating.
- Dependency `ts-fsrs@5.4.2` (FSRS-6.0) terpasang.

## Yang Sudah Ada (Fase B)

- `lib/scheduler/day.ts` — batas hari dengan jam rollover (default 04:00), termasuk pembedaan
  intraday vs interday dan selisih hari yang tahan transisi DST.
- `lib/scheduler/fsrs.ts` — jembatan ke `ts-fsrs` (FSRS-6): konversi state kartu, resolusi queue,
  deteksi leech, dan `getRetrievability()` untuk urutan queue Fase C.
- `lib/scheduler/sm2.ts` — fallback SM-2 lengkap (learning steps, ease, easy bonus, interval
  modifier, hard interval, new interval, bonus review telat), dipakai hanya saat
  `fsrsEnabled: false`.
- `lib/scheduler/index.ts` — `scheduleReview()` sebagai satu-satunya pintu masuk, plus
  `previewSchedule()` untuk menampilkan interval di keempat tombol.
- 49 unit test (`vitest`), script `npm run test`. `npm run verify` sekarang menjalankan test
  di antara typecheck dan build.

## Yang Sudah Ada (Fase C)

- `lib/deck-tree.ts` — hierarki deck diturunkan dari nama ber-`::` (tanpa kolom `parentId`),
  sehingga rename satu deck memindahkan seluruh subtree-nya.
- `lib/queue/limits.ts` — daily limit per deck dengan pewarisan subtree. Menutup bug modul lama
  yang menghitung limit global lintas deck.
- `lib/queue/gather.ts` — urutan pengambilan v3 (intraday → interday → review → new), alokasi
  review limit, dan penggabungan sesuai display order.
- `lib/queue/sort.ts` — seluruh gather/sort order Anki, termasuk `relativeOverdueness` yang
  dengan FSRS berarti ascending retrievability.
- `lib/queue/bury.ts` — sibling burying.
- `lib/render/sanitize.ts` + `lib/render/card-content.ts` — allowlist HTML ketat dan
  penurunan isi kartu dari field note (termasuk cloze).
- `data.ts` — pohon deck dengan hitungan roll-up, dan pembangunan antrean belajar.
- `actions.ts` — answer (idempoten), bury, suspend/unsuspend, undo, leech, dan CRUD deck.
- `components/flashcard-reviewer.tsx` — reviewer client-side dengan pintasan keyboard Anki.
- Route `/flashcard`, `/flashcard/deck/[deckId]`, `/flashcard/deck/[deckId]/study`.
- 91 unit test total.

## Yang Sudah Ada (Fase E)

- Tabel katalog `FlashcardSystemDeck` + `FlashcardSystemNote` — konten milik aplikasi, tanpa
  `userId`, tidak pernah dijadwalkan.
- Kontrak data di [`docs/seed-flashcard.md`](../seed-flashcard.md), file di
  `src/flashcard-deck-data/` (satu file per deck), script `npm run seed:flashcard-deck` dan
  `npm run seed:flashcard-deck:check`.
- Katalog awal: 4 deck, 335 note — Kana Hiragana (71), Kana Katakana (71), JLPT N5 Kosakata (113),
  JLPT N5 Kanji (80).
- Note type `KANA` ditambahkan supaya deck kana tidak dipaksa memakai label kosakata.
- `system-deck-actions.ts` — menambahkan deck bawaan berarti MENYALIN isinya ke koleksi user.
  Note yang sudah ada dilewati, sehingga menambahkan ulang deck yang diperbarui hanya membawa
  note baru tanpa mereset progres.
- `ensureDeckPath()` — deck induk dibuat otomatis, seperti Anki: menambahkan `Kana::Hiragana`
  ikut membuat deck `Kana`.
- Halaman `/flashcard/add` dengan katalog dan atribusi lisensi yang tampil di UI.

## Yang Sudah Ada (Fase D)

- `/flashcard/deck/[deckId]/options` — 11 bagian deck options mengikuti struktur Anki: Preset,
  Batas harian, Kartu baru, Lapse, Burying, FSRS, Urutan tampil, Timer, Auto advance, Audio,
  dan Lanjutan (41 kontrol).
- `preset-form.ts` — konversi form ↔ config untuk tiga field yang diketik sebagai teks
  (learning steps, relearning steps, 21 parameter FSRS) plus retention yang ditampilkan sebagai
  persen. Pesan error menyebut step atau jumlah parameter yang salah, bukan pesan generik.
- `preset-actions.ts` — simpan preset, buat preset baru dari yang sedang dipakai, pindah preset
  per deck (opsional termasuk subdeck), hapus preset (deck-nya dipindah ke Default lebih dulu).
- **Reschedule cards on change** — interval kartu review dihitung ulang dari `stability` yang
  tersimpan lewat `next_interval()` milik ts-fsrs, bukan dengan mengulang seluruh review history.
  Ini yang dilakukan Anki dan jauh lebih murah. Dibatasi 5.000 kartu per penyimpanan supaya satu
  request serverless tidak menyentuh puluhan ribu baris.

## Yang Sudah Ada (Fase F)

- `lib/import/parse-text.ts` — parser format teks Anki: header `#key:value`, deteksi separator
  otomatis, quoting dengan escape `""`, field multi-baris, BOM/CRLF, dan baris dengan jumlah
  kolom tidak seragam.
- `lib/import/mapping.ts` — pemetaan kolom ke field note type, pengenalan kolom
  GUID/Tags/Deck dari namanya, validasi, dan konversi baris menjadi note.
- `import-actions.ts` — job impor, penyimpanan per batch 500 baris, dedup, dan tiga mode Anki
  (perbarui / lewati duplikat / impor sebagai baru).
- `components/import-wizard.tsx` dan route `/flashcard/import` — parsing dan pemetaan berjalan
  di browser; server hanya menerima baris yang sudah bersih.

## Yang Sudah Ada (Fase G)

- **Mode coba guest** — `/flashcard/try/[slug]`. Siapa pun bisa mencicipi deck bawaan tanpa akun.
  Selalu ephemeral, termasuk untuk user yang sudah login, karena `cardId` di sana adalah guid
  katalog dan bukan kartu milik siapa pun. Banner "progres tidak disimpan" tampil eksplisit —
  memperbaiki gap modul lama yang copy-nya bisa menyiratkan progres guest tersimpan.
- **Card browser** — `/flashcard/browse` dengan filter deck, status, tag, dan pencarian teks;
  aksi massal suspend/lepas suspend, tunda, reset ke kartu baru, pindah deck, reposisi, dan
  hapus note.
- **Statistik** — `/flashcard/stats`: true retention, perkiraan 30 hari ke depan, riwayat review
  30 hari, sebaran interval, status kartu, dan rata-rata waktu menjawab.
- **Export** — `/api/flashcard/export?deck=<id>` menghasilkan teks format Anki yang bisa langsung
  diimpor kembali lewat jalur impor yang sama, lengkap dengan kolom GUID sehingga impor ulang
  memperbarui note alih-alih menggandakannya.

## Yang Belum Ada

- **Impor `.apkg`.** Desainnya sudah disiapkan (unzip + zstd + sql.js seluruhnya di browser, lalu
  menumpang jalur batch impor yang sama), tapi belum diimplementasikan.
- **Konten katalog** baru sampai N5. N4-N1 tinggal ditambahkan sebagai file baru sesuai kontrak,
  tanpa mengubah kode. Route `/flashcard` belum ada, jadi tautan di sidebar,
dashboard, profile, landing page, sitemap, dan public header saat ini menunjuk ke halaman yang
belum dibuat.

## Perbedaan dari Anki yang Disengaja

- **Tidak ada custom card template.** Anki membiarkan user menulis `qfmt`/`afmt` HTML sendiri;
  di sini tata letak milik aplikasi dan user hanya memetakan field. Ini menutup risiko XSS
  lintas user sekaligus menjaga konsistensi desain. Konsekuensinya round-trip ke Anki tidak
  sempurna: deck yang diimpor lalu diekspor tidak membawa template aslinya.
- **`FlashcardCard.due` adalah timestamp absolut**, bukan integer relatif `col.crt` dengan
  satuan berbeda per queue seperti di Anki. Satu query melayani semua queue.
- **`FlashcardNote.fields` adalah `String[]`**, bukan string ber-separator `0x1F`.
- **Tidak ada `custom scheduling`** (eval JavaScript arbitrer di scheduler).
- **Learning steps dibatasi < 1 hari, dan satuan detik tidak didukung.** Anki menerima `30s`
  dan step antar-hari seperti `1d`, tetapi keduanya rusak diam-diam bila diteruskan ke
  `ts-fsrs`: `ConvertStepUnitToMinutes` menolak satuan detik dan membulatkan pecahan ke bawah
  (`30s` → 0 menit → seluruh array step diabaikan dan kartu langsung lulus), sementara step
  ≥ 1 hari dikembalikan sebagai `State.Review` dengan index step yang tidak konsisten sehingga
  tak bisa dibedakan dari kartu review biasa. Batas ini ditegakkan di `FlashcardStepSchema`
  dengan pesan error yang jelas, bukan dibiarkan gagal diam-diam. Panduan FSRS sendiri
  menyarankan learning steps tetap pendek.
- **Idempotency review memakai kolom terpisah, bukan primary key.** Revlog Anki memakai epoch ms
  sebagai id, dan itu tetap dipertahankan. Tetapi primary key bersifat global: kalau client yang
  menentukannya, satu user bisa mengklaim id di masa depan dan membuat review user lain ditolak
  diam-diam sebagai "sudah tercatat". Karena itu idempotency memakai
  `@@unique([userId, clientToken])` — tabrakan hanya mungkin di dalam satu akun, dan di situ
  memang itu perilaku yang benar (submit ganda dari dua tab jadi no-op).
- **Tidak ada `custom scheduling`.** Anki mengizinkan JavaScript arbitrer di scheduler; risikonya
  tidak sebanding untuk aplikasi multi-user.
- **Tidak ada optimizer parameter FSRS.** Anki melatih 21 parameter dari review history dengan
  gradient descent di Rust; `ts-fsrs` tidak menyediakannya. Rencana: pakai default FSRS-6 dan
  sediakan kolom paste parameter untuk user yang sudah punya hasil optimasi dari Anki.

## Data Aktual

Kosong. Migration men-drop seluruh tabel vocabulary lama (32 kartu, 6 deck, 7 tag, 90 deck item,
68 tag link, 2 progress, dan 2 review log — seluruhnya fixture dan data uji, bukan progres
belajar nyata).

## File Utama

- `prisma/schema.prisma` — model `Flashcard*`
- `src/features/flashcard/note-types.ts`
- `src/features/flashcard/schemas.ts`
- `src/features/flashcard/lib/scheduler/` — `index.ts`, `fsrs.ts`, `sm2.ts`, `day.ts`, `types.ts`
- `src/features/flashcard/lib/queue/` — `gather.ts`, `limits.ts`, `sort.ts`, `bury.ts`
- `src/features/flashcard/lib/deck-tree.ts`, `lib/render/`, `data.ts`, `actions.ts`
- `src/features/flashcard/system-deck-actions.ts`, `src/flashcard-deck-data/`
- `prisma/seed-flashcard-deck.mjs`
- `src/features/flashcard/preset-actions.ts`, `preset-form.ts`, `components/deck-options-form.tsx`
- `src/features/flashcard/import-actions.ts`, `lib/import/`, `components/import-wizard.tsx`
- `src/features/flashcard/browse-actions.ts`, `browse-data.ts`, `lib/stats.ts`,
  `lib/import/export-text.ts`, `components/card-browser.tsx`
- `src/features/flashcard/**/*.test.ts` — 186 test
