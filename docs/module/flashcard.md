# Modul Flashcard (kosakata bawaan, penjadwalan ala Anki)

## Status Aktual

**Dirombak 1 Oktober 2026; kode dan katalog selesai (6.720 kata, 52 deck di database), flag
masih mati sampai uji manual.** Modul ini tidak lagi meniru Anki
sebagai aplikasi koleksi pribadi. Isinya kini satu katalog kosakata JLPT bawaan yang
digenerate AI, dan user hanya memilih deck lalu mengatur penjadwalan. Konten buatan user
(deck sendiri, tambah kartu, impor/ekspor CSV, card browser yang bisa mengedit, preset per
deck, editor deck bawaan di admin) sudah dihapus.

Yang masih perlu sebelum flag dinyalakan: uji manual di browser dengan data asli, lalu
`FEATURES_FLASHCARD=true` di Vercel (checklist di Fase 8.12 `docs/plan.md`).

Rancangan lama (paritas Anki penuh) tetap ada di
[`docs/plan/anki-parity-flashcard.md`](../plan/anki-parity-flashcard.md) sebagai riwayat.

## Feature Flag

`FEATURES_FLASHCARD` (default `true`). Saat `false`:

- Seluruh `/flashcard/*`, termasuk mode coba guest `/flashcard/try/*`, mengembalikan 404 lewat
  guard `src/app/(public)/flashcard/layout.tsx`.
- Menu Flashcard di header dan sidebar, kartu di home dan dashboard, serta quick action dan
  statistik "Kartu dipelajari" di profile tidak dirender.
- `/flashcard` keluar dari `sitemap.xml` dan `robots.txt`.
- Server Action flashcard tidak mengecek flag; tab lama yang masih terbuka tetap dapat
  memanggilnya.
- Kartu tidak dapat dilaporkan: tombol "Laporkan kartu" hanya ada di bawah `/flashcard`, dan
  `submitReportAction` (modul report, di luar segmen ini) mengecek flag ini sendiri untuk target
  `FLASHCARD_VOCAB`. Laporan kartu yang sudah masuk tetap dapat ditindak di `/admin/report`.

## Konsep

- **Katalog** (`FlashcardVocab`): satu baris per kata, diisi `npm run seed:flashcard` dari
  `src/flashcard-data/vocab/*.json`. Kata yang hilang dari fixture diberi `retiredAt`, tidak
  pernah dihapus, karena progres user merujuknya.
- **Deck = tag.** Deck bawaan (`FlashcardDeck`) dibentuk dari tag taxonomy yang bertanda
  `deck: true`. Kata termasuk deck bila `tags`-nya memuat slug deck itu, sehingga 食事 bisa ada
  di "JLPT N5" sekaligus "Makanan & minuman". 71% kata ada di dua deck atau lebih.
- **Kartu milik satu deck** (`FlashcardCard`, primary key `userId + deckId + vocabId`), seperti
  di Anki. Kata yang ada di dua deck adalah dua kartu dengan jadwal masing-masing, sehingga
  direview terpisah di tiap deck. Baris kartu dibuat saat kata pertama kali disentuh di deck itu
  (dijawab, ditunda, atau di-suspend); kata tanpa baris adalah kartu baru di deck itu.
- **Langganan** (`FlashcardDeckSubscription`): deck yang dipilih user, sekaligus pemilik kartu
  dan pengaturan penjadwalan deck itu. Melepas deck hanya mengisi `unsubscribedAt`: kartu dan
  pengaturannya dibekukan (tidak masuk statistik beban review) dan kembali utuh saat deck
  ditambahkan lagi. Barisnya tidak pernah dihapus selama user ada.
- Deck dengan kata kurang dari `deckMinNotes` (10) tidak ditampilkan; ini juga membuat deck
  topik yang kata-katanya belum digenerate tetap tersembunyi. Halaman deck, mode coba, belajar,
  dan tombol tambah deck memakai katalog yang sama, jadi deck tersembunyi tidak bisa dibuka
  atau ditambahkan lewat URL langsung.
- **Taxonomy** (`src/flashcard-data/taxonomy.json`) adalah satu-satunya daftar tag. Lima
  dimensi: level (diisi otomatis dari daftar kata), kelas kata, ragam bahasa, kategori, dan
  topik. Aplikasi, prompt AI, dan validator seed membaca file yang sama.

## Kartu

- **Sisi depan**: hanya tulisan kata tanpa furigana (`wordPlain`).
- **Sisi belakang**: kata dengan furigana, arti Indonesia (utama) dan Inggris, 1-2 contoh
  kalimat dengan kata target disorot, terjemahan ID/EN, catatan, dan tag (tanpa tag level).
- Semua teks Jepang memakai markup `parseJapaneseMarkup` (`{漢字|かな}`, `__target__`). Di
  flashcard, `__...__` dirender sebagai sorotan, bukan garis bawah 下線部.
- Pengaturan tampilan per user: **ukuran teks** (80-160%, default 100%) dan **furigana langsung
  di sisi belakang** (default aktif; bila mati, furigana disembunyikan dengan `visibility`
  dan muncul saat diketuk atau tombol `F`).

## Penjadwalan

- FSRS-6 lewat `ts-fsrs`, dengan fallback SM-2 saat FSRS dimatikan. Scheduler (`lib/scheduler/`)
  tidak berubah dari rancangan lama.
- **Pengaturan penjadwalan per deck** (`FlashcardDeckSubscription.config`), seperti deck options
  Anki: batas harian, learning/relearning steps, urutan, FSRS, dan desired retention. Kartu
  selalu dijadwalkan dengan pengaturan deck pemiliknya, jadi tidak pernah ambigu.
- **Alur tambah deck:** tombol Tambahkan langsung mengaktifkan deck dengan nilai bawaan lalu membuka
  `/flashcard/deck/[slug]/settings?new=1`, yang menawarkan "Pakai bawaan" atau mengubahnya dulu.
  Form bisa diisi dari pengaturan deck lain milik user ("Salin dari deck lain"); salinan baru
  berlaku setelah disimpan. Menyimpan kembali ke halaman deck, seperti dialog deck options Anki.
- **Batas harian per deck, tanpa batas gabungan.** Kartu baru dan review hari ini dihitung dari
  `FlashcardRevlog.deckId`. Sepuluh deck dengan 20 kartu baru berarti sampai 200 kartu baru per
  hari; itu disengaja.
- **Tampilan** (ukuran teks, furigana) dan jam pergantian hari tetap satu per user
  (`FlashcardCollection`).
- Nilai bawaan mengikuti deck options Anki milik pemilik project:

  | Setting | Bawaan |
  |---|---|
  | Kartu baru per hari | 20 (per deck) |
  | Maksimum review per hari | 9999 |
  | Learning steps | `1m 2h 3h` |
  | Insertion order | Sequential |
  | Relearning steps | `1m 1h` |
  | New card gather order | Random cards |
  | New card sort order | Order gathered |
  | New/review order | Show after reviews |
  | Interday learning/review order | Show before reviews |
  | Review sort order | Descending retrievability |
  | FSRS | aktif |
  | Desired retention | 95% |

  Setting lain (parameter FSRS, setting SM-2, leech) tidak ditampilkan dan memakai default Anki.
  Setiap field di form pengaturan deck punya tombol ↺ ke nilai bawaannya.
- Urutan pengambilan antrean mengikuti scheduler v3 Anki: intraday learning → interday learning
  → review → new. Opsi urutan yang membedakan subdeck atau note bersaudara jatuh ke padanan
  terdekatnya, karena deck tidak punya subdeck dan satu kata hanya punya satu kartu.
- **Insertion order** dihitung, bukan disimpan: "sequential" mengikuti urutan katalog (level
  termudah dulu, lalu urutan daftar sumber), "random" memakai hash per user yang stabil.
  Mengganti opsi ini langsung berlaku untuk semua kartu baru, seperti di Anki.
- **Learn ahead 20 menit.** Kartu learning hanya tampil saat jatuh tempo (atau dalam 20 menit ke
  depan). Kartu dengan step 2 jam ditahan reviewer dan tampil tepat waktu dalam sesi yang sama;
  bila tidak ada kartu lain, reviewer menampilkan jam tampil berikutnya. Kode lama memasukkan
  semua kartu learning hari ini sekaligus, sehingga step jam tidak pernah dihormati.
- **Tunda** menyimpan `buriedUntil` (awal hari berikutnya), **suspend** menyimpan
  `isSuspended`. Keduanya tidak menimpa jadwal kartu, dan kartu tertunda muncul lagi tanpa job
  unbury.
- **Undo** memulihkan salinan kartu yang disimpan di `FlashcardRevlog.previousState`, sehingga
  keadaannya kembali persis (termasuk learning step). Hanya review terakhir sebuah kartu yang
  bisa dibatalkan.
- **Idempotency** lewat `clientToken` per user. Retry dengan token yang sudah tercatat
  mengembalikan hasil yang tersimpan, termasuk untuk kartu yang belum jatuh tempo lagi.
- Server menolak menjawab kartu yang di-suspend, ditunda, belum jatuh tempo, atau melewati batas
  kartu baru hari ini.
- Leech: setelah 8 lapse kartu diberi `isLeech` (default `tagOnly`).

## Halaman

| Route | Isi |
|---|---|
| `/flashcard` | Guest: katalog dengan tombol "Coba deck ini". Login: deck milik user dengan hitungan baru/belajar/ulang hari ini. |
| `/flashcard/add` | Katalog per Level JLPT, Topik, dan Kategori dengan tombol tambah/lepas. |
| `/flashcard/deck/[slug]` | Hitungan hari ini dan pemakaian batas harian deck, tombol belajar, pengaturan deck, tambah/lepas deck, [statistik deck](#statistik), dan daftar kata read-only (pencarian kata/bacaan/arti, filter status, 50 per halaman, suspend, reset, dan laporkan per kata). |
| `/flashcard/deck/[slug]/settings` | Pengaturan penjadwalan deck ini (deck options Anki). Hanya untuk deck yang sedang ditambahkan; selain itu dialihkan ke halaman deck. |
| `/flashcard/deck/[slug]/study` | Reviewer. Hanya untuk deck yang sudah ditambahkan. Antrean dikirim per 200 kartu; tombol "Lanjutkan" membangun antrean berikutnya. Lihat [Layar belajar](#layar-belajar). |
| `/flashcard/settings` | Tampilan kartu untuk semua deck: ukuran teks dan furigana. |
| `/flashcard/stats` | True retention, kematangan kartu, perkiraan 30 hari, riwayat review, dan sebaran interval; semua deck atau satu deck (`?deck=slug`). |
| `/flashcard/try/[slug]` | Mode coba 20 kata pertama deck, selalu ephemeral. Guest boleh melaporkan kartu (dengan Turnstile). |

## Layar Belajar

- **Tombol kembali** di atas reviewer menuju halaman deck (mode coba: katalog). Keluar di tengah
  sesi aman karena setiap jawaban langsung tersimpan.
- **Hitungan Baru · Belajar · Ulang** berkurang langsung selama sesi, seperti di Anki: kartu yang
  sedang tampil ikut dihitung dan jenisnya digaris bawah, kartu baru yang dijawab lalu kembali
  hari ini pindah ke "Belajar", dan kartu learning yang menunggu jatuh tempo tetap masuk hitungan
  "Belajar". Kartu di luar potongan 200 yang dikirim ikut dihitung (`unloadedCounts`), jadi
  angkanya sama dengan halaman deck.
- **Progress bar** (dijawab / dijawab + sisa) dan **jam sesi**.
- **Ringkasan sesi** di layar akhir (dan "Sesi sejauh ini" di layar istirahat): jumlah jawaban,
  kartu unik dan kartu baru, persentase benar (selain Again), rata-rata detik per jawaban, durasi,
  sebaran Again/Hard/Good/Easy, lima kartu yang paling sering terlupa, leech baru, dan perkiraan
  kartu deck ini yang jatuh tempo besok.
- Semua angka diturunkan di client dari daftar jawaban sesi (`lib/session-summary.ts`), sehingga
  undo cukup membuang jawaban terakhir. Perkiraan besok = kartu deck yang memang jatuh tempo besok
  saat antrean dibangun (dihitung server) + kartu sesi ini yang jadwal terakhirnya jatuh besok.
- Ringkasan tidak disimpan: tombol "Lanjutkan" memulai potongan antrean baru dengan ringkasan
  baru, dan statistik jangka panjang tetap di `/flashcard/stats`.

## Statistik

- **Halaman deck** (hanya deck yang sedang ditambahkan): progres "X dari Y kata dipelajari",
  kematangan kartu (baru / belajar / young / mature / suspend, ambang mature 21 hari seperti
  Anki), true retention dan jumlah jawaban 30 hari, perkiraan jatuh tempo 7 hari, dan lima kata
  dengan lapse terbanyak beserta tanda leech. Semuanya hanya kartu deck itu, untuk kata yang
  masih termasuk deck dan belum pensiun (`getDeckStats`).
- **`/flashcard/stats`**: agregat semua deck yang sedang ditambahkan, atau satu deck lewat filter
  `?deck=slug` (nilai lain berarti semua deck). Kata yang ada di beberapa deck dihitung sebagai
  kartu di tiap deck. Kartu deck yang dilepas tidak ikut beban review dan kematangan; riwayat
  review tetap memuatnya.
- Rumus (`lib/stats.ts`): true retention hanya review kartu matang (`kind = REVIEW`, selain
  Again), kartu lewat due dihitung di hari ini pada perkiraan, dan kartu suspend dihitung
  terpisah apa pun jenisnya.

## Laporan Kartu

Isi kartu ditulis AI, jadi bisa saja ada yang salah. Kartu dilaporkan lewat
[modul report](report.md) dengan target `FLASHCARD_VOCAB`, yang menunjuk kata di katalog
(`vocabId`), bukan kartu milik user.

- Tombol "Laporkan kartu" ada di reviewer (hanya setelah sisi belakang dibuka), daftar kata
  `/flashcard/deck/[slug]`, dan mode coba guest. Dialognya sama dengan laporan soal dan terbuka di
  tempat; laporan tidak me-render ulang halaman, jadi sesi belajar tidak ter-reset, dan pintasan
  keyboard reviewer mati selama dialog terbuka.
- Kategori: bacaan/furigana salah, arti atau catatan keliru, contoh kalimat bermasalah, tag atau
  deck tidak cocok, ada yang error, dan lainnya. Alasan pemisahannya di
  [report.md](report.md#kategori-dibatasi-target).
- Kartu **tidak** diedit dari admin. `/admin/report` menampilkan isi kartu sekarang, level, dan
  key-nya beserta perintah perbaikan: sunting `content` di fixture atau
  `npm run gen:flashcard -- --key "<key>" --overwrite`, lalu `npm run seed:flashcard`. Bacaan kata
  yang keliru diselesaikan lewat peninjau kata ragu, karena bacaan itu bagian dari key.

## Pipeline Konten

Kontrak lengkapnya di [seed-flashcard.md](../seed-flashcard.md):

1. `npm run flashcard:extract` — daftar kata dari `data/anki/exported_anki.apkg` (file ini
   tidak di-commit).
2. `npm run gen:flashcard` — isi kartu oleh AI, hanya untuk kata yang belum terisi.
3. `npm run seed:flashcard` — fixture ke database.

## Perbedaan dari Anki yang Disengaja

- Tidak ada konten buatan user, custom card template, maupun impor `.apkg` oleh user.
- Pengaturan melekat ke deck, bukan preset yang bisa dipakai bersama beberapa deck; tidak ada
  tab "This deck" untuk desired retention. Tampilan kartu tetap satu per user.
- Kata yang ada di beberapa deck bawaan menjadi kartu terpisah di tiap deck (di Anki, deck yang
  diimpor terpisah juga punya kartu masing-masing).
- Satu template kartu (kata → arti), jadi tidak ada sibling burying.
- `FlashcardCard.due` timestamp absolut, bukan integer relatif `col.crt`.
- Learning steps dibatasi < 1 hari dan tanpa satuan detik, karena `ts-fsrs` merusak keduanya
  diam-diam (lihat komentar di `schemas.ts`).
- Tidak ada custom scheduling dan tidak ada optimizer parameter FSRS.
- Tidak ada audio.

## Yang Belum Ada

- Audio atau tombol dengar (TTS browser seperti modul kana bisa ditambahkan tanpa file).
- Halaman admin untuk meninjau kata bertanda ragu dari generator AI. Sementara memakai
  `npm run flashcard:doubts` dan `npm run fix:flashcard-doubts` di terminal, lalu seed ulang.

## File Utama

- `prisma/schema.prisma` — model `Flashcard*`
- `src/flashcard-data/taxonomy.json`, `src/flashcard-data/vocab/*.json`
- `prisma/flashcard-vocab.mjs`, `flashcard-anki.mjs`, `flashcard-vocab-prompt.mjs`,
  `japanese-markup-check.mjs`
- `prisma/extract-flashcard-anki.mjs`, `generate-flashcard-vocab.mjs`, `seed-flashcard.mjs`,
  `report-flashcard-doubts.mjs`
- `src/features/flashcard/data.ts` — query katalog, deck, daftar kata, sesi belajar
- `src/features/flashcard/actions.ts` — jawab, undo, tunda, suspend, reset, langganan, pengaturan
- `src/features/flashcard/lib/scheduler/`, `lib/queue/`, `lib/collection.ts`,
  `lib/session-summary.ts`
- `src/features/flashcard/schemas.ts`, `settings-form.ts`, `taxonomy.ts`, `types.ts`
- `src/features/flashcard/components/` — reviewer, ringkasan sesi, tampilan kartu, katalog, form
  tampilan (`flashcard-display-form.tsx`) dan form pengaturan deck (`deck-config-form.tsx`)
- `src/features/flashcard/**/*.test.ts` — scheduler, antrean, pipeline seed, pengaturan, statistik,
  ringkasan sesi
