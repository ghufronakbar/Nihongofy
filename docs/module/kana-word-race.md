# Modul Kana Word Race (Nama Kerja)

Tanggal rancangan: **18 Oktober 2026 (Asia/Jakarta)**.

## Status Aktual

**Rancangan saja; implementasi belum dimulai.** User meminta dokumentasi modul dan rencana
setelah diskusi konsep. Belum ada route, entry registry, feature flag, dependency konversi,
tabel, migration, seed kamus game, atau deployment untuk game ini. Kotoba Clash tetap menjadi
satu-satunya game yang tersedia dalam kode katalog saat dokumen ini dibuat.

**Kana Word Race** adalah nama kerja untuk dokumentasi, bukan nama final pilihan user.
Slug `kana-word-race`, nama model, route, dan flag di bawah merupakan usulan implementasi.
Bekukan identitas sebelum membuat migration atau membuka URL publik.

Rujukan:

- [Rencana implementasi](../plan/mini-games-kana-word-race.md): urutan, dependensi, dan gate.
- [Checklist UAT](../verification/kana-word-race-uat.md): expected result dan bukti penerimaan.
- [Mini Games](mini-games.md): katalog, navigasi, dan pemisahan antar-game.
- [Kotoba Clash](kotoba-clash.md): rujukan pengalaman room dan transport existing.
- [Flashcard](flashcard.md) dan [kontrak fixture](../seed-flashcard.md): sumber kosakata.
- [Aturan project](../project-rules.md), [database](../database.md), dan
  [migration](../operations/migrations.md): batas implementasi.

## 1. Tujuan dan Keputusan Produk

Permainan tebak kata berbasis kana dengan feedback posisi seperti Wordle. Pemain dalam satu
room berlomba menemukan bacaan rahasia yang sama, dengan papan dan kesempatan masing-masing.
Kanji, arti, dan contoh belajar ditampilkan setelah ronde dibuka untuk semua pemain.

| Topik | Keputusan hasil diskusi |
|---|---|
| Akses pertandingan | Room undangan seperti Kotoba Clash; kode atau link |
| Host dan peserta | Host login; peserta akun atau guest dengan nickname |
| Target | Bacaan hiragana sepanjang 3, 4, 5, 6, atau 7 karakter |
| Kesempatan | Enam tebakan valid per pemain per ronde |
| Waktu | Ada deadline bersama dari server |
| Input | Keyboard virtual kana; dukungan romaji yang diubah menjadi hiragana |
| Feedback | Tepat posisi, ada di posisi lain, atau tidak ada dalam target |
| Petunjuk tambahan | Kategori opsional, sama untuk seluruh pemain |
| Privasi | Isi tebakan dan feedback pemain tidak dibagikan kepada lawan |
| Akhir ronde | Menunggu seluruh roster selesai atau deadline, termasuk setelah ada yang benar |
| Hasil | Peringkat pertandingan, jawaban/arti, dan rematch dengan room yang sama |
| Sumber konten | Bacaan flashcard yang dinormalisasi dan dikurasi menjadi kamus game |

Rekomendasi rancangan: default lima kotak, host dapat memilih panjang tetap atau acak 3-7.
Panjang kotak berlaku sama untuk seluruh pemain dalam ronde yang sama. Banyaknya kotak bukan
label kesulitan JLPT: kata dasar seperti `しょうがっこう` membutuhkan tujuh kotak.

Hal berikut **belum dibekukan** dan wajib ditulis final di dokumen ini sebelum fase fondasi:

- Nama/slug final; rentang pemain (target awal 2-20 mengikuti pengalaman Kotoba Clash,
  bukan kapasitas game baru yang sudah terukur).
- Pilihan/default jumlah ronde, durasi tiap panjang, countdown, reveal, dan jeda antar-ronde.
- Distribusi panjang pada mode acak dan aturan pengulangan target dalam/rematch pertandingan.
- Rumus poin, versi scoring, tie, serta hubungan jumlah tebakan dengan kecepatan.
- Kategori yang tersedia, kriteria publikasi kata, dan fallback bila stok tidak cukup.
- Kuota room/koneksi, spectator, retensi, credential guest, dan scope penggantian room host
  lintas game. Membuat room game ini tidak boleh menutup room Kotoba Clash tanpa keputusan baru.

V1 berfokus pada room undangan. Matchmaking publik, ranked global, chat, custom word dari host,
penilaian AI saat bermain, dan perubahan nilai/progres SRS tidak termasuk rancangan awal.

## 2. Room dan Lifecycle Pertandingan

Alur: landing -> buat/gabung room -> konfigurasi -> ready -> countdown -> ronde -> reveal ->
ronde berikutnya -> hasil -> lobby/rematch. Route usulan:

| Route | Isi dan akses |
|---|---|
| `/mini-games/kana-word-race` | Aturan, Buat Room, dan form kode; landing publik |
| `/mini-games/kana-word-race/room/[code]` | Join/lobby/runner; membership wajib diverifikasi |
| `/mini-games/kana-word-race/room/[code]/results/[matchId]` | Hasil per match dalam retensi; membership wajib |

- Perubahan konfigurasi menaikkan revision dan mereset ready. Start memverifikasi ulang host,
  kehadiran/kesiapan roster, konfigurasi, serta stok kata secara atomik di server.
- Roster dibekukan saat Start. Pendatang baru tidak mendapat enam kesempatan baru di tengah
  pertandingan; rancangan awal menawarkan menunggu pertandingan berikutnya. Spectator hanya
  ditambahkan setelah batas akses dan kapasitasnya diputuskan.
- Setiap ronde memiliki target privat, panjang, kategori bila aktif, waktu mulai, dan deadline.
  Semua pemain memakai target dan deadline yang sama; refresh tidak memulai ulang timer.
- Status per pemain: `PLAYING`, `SOLVED`, `EXHAUSTED`, atau `TIMED_OUT`. Satu tebakan benar
  langsung menutup input pemain itu; enam tebakan valid yang salah menghabiskan kesempatan.
- Pemain yang sudah selesai tetap tidak menerima target, kanji, arti, atau contoh lengkap
  sebelum reveal bersama. Feedback hijau dari tebakan benarnya sendiri tetap boleh tampil.
- Ronde berakhir ketika seluruh roster terminal atau deadline tercapai. Pemain offline yang
  masih `PLAYING` menunggu deadline; disconnect bukan penyelesaian otomatis.
- Reveal membuka target dan materi belajar untuk semua anggota yang berhak. Rematch membuat
  match, roster, serta ledger baru tanpa menimpa hasil lama.

Kecepatan dihitung dari waktu mulai ronde sampai tebakan benar **diterima server**. Client
tidak mengirim waktu yang dipercaya untuk ranking. Rancangan awal menempatkan pemain yang
lebih cepat menjawab benar pada peringkat ronde lebih tinggi; angka poin/tie wajib dibekukan
sebelum diimplementasikan. Skor agregat harus dapat direkonstruksi dari ledger dan tidak
bertambah dua kali saat finalisasi diulang.

## 3. Kotak Kana dan Input

### 3.1 Satuan karakter

Satu kotak memuat satu karakter kana setelah normalisasi, bukan satu romaji, kanji, atau mora.
Gunakan aturan yang identik pada importer, input, validasi server, dan evaluator.

| Bacaan | Isi kotak | Jumlah |
|---|---|---:|
| `がっこう` | `が・っ・こ・う` | 4 |
| `きょう` | `き・ょ・う` | 3 |
| `しょうがっこう` | `し・ょ・う・が・っ・こ・う` | 7 |
| `えーっと` | `え・ー・っ・と` | 4 |

Normalisasi: Unicode NFKC -> katakana ke hiragana -> NFC -> validasi karakter -> hitung
karakter hasil normalisasi. `が` yang semula berupa huruf dan combining dakuten menjadi satu
karakter. Batasi alfabet game pada kana yang benar-benar disediakan keyboard. Karakter kecil,
gabungan katakana yang tidak terwakili, dan karakter lama wajib diaudit pada kurasi.

`っ`, `ゃ`, `ゅ`, `ょ`, dan `ー` memiliki kotak sendiri. Dakuten/handakuten menyunting kana pada
kotak yang sama. Jangan menghapus tanda panjang atau menyamakan `おう`, `おお`, dan `ー`;
ejaan bacaan merupakan bagian jawaban. Aturan ini berlaku sama untuk tebakan dan target.

### 3.2 Editor satu input

Papan enam baris ditampilkan seperti Wordle. Baris aktif memakai satu editor/input dengan
representasi kotak; jangan membuat tujuh input terpisah yang memecah komposisi romaji/IME.

- Keyboard virtual memasukkan kana; sediakan huruf kecil, dakuten/handakuten, `ー`, hapus,
  dan kirim. Pemetaan tombol lengkap dibekukan setelah audit alfabet kamus.
- Romaji dikonversi bertahap. `k` masih pending, `ka` menghasilkan `か`, `kyo` menghasilkan
  `きょ`, dan `gakkou` menghasilkan `がっこう`. Pending romaji terlihat tanpa mengisi kotak
  sebagai huruf Latin. Pastikan panjang tidak melewati jumlah kotak.
- Tetapkan dan jelaskan perilaku `n`, `nn`, `n'`, konsonan ganda, huruf kecil, serta tanda
  panjang. WanaKana adalah kandidat dependency; belum terpasang dan perlu evaluasi/pinning.
- Backspace menghapus pending romaji dahulu, lalu kana terakhir. Reset komposer ketika ronde
  berganti, refresh, atau aksi virtual mengganti metode input; tidak boleh ada huruf tertahan
  yang muncul kembali tanpa tindakan user.
- Keyboard Jepang native menghormati composition events/`isComposing`. Enter yang mengakhiri
  komposisi tidak sekaligus mengirim tebakan; jangan mengonversi input IME dua kali.
- Paste divalidasi/dinormalisasi utuh. Kirim hanya jika tepat panjang, alfabet valid, dan tidak
  ada komposisi tertunda. Jangan auto-submit hanya karena kotak sudah penuh.
- Di HP, keyboard virtual game menjadi pilihan awal. Keyboard sistem muncul saat user memilih
  input teks/romaji supaya dua keyboard tidak mengambil ruang secara bersamaan.

### 3.3 Feedback dan penggunaan kesempatan

Evaluator memproses posisi tepat terlebih dahulu, lalu membagikan status posisi lain menurut
sisa jumlah kemunculan kana dalam target. Kana berulang tidak boleh mendapat kuning melebihi
jumlah yang tersedia. `か`, `が`, `っ`, dan `つ` adalah karakter berbeda.

Tebakan yang tidak lengkap, ilegal, belum dikenal kamus, sudah pernah ditebak pada ronde itu,
atau ditolak sebelum deadline tidak menghabiskan kesempatan. Keputusan penerimaan akhir ada
di server; UI tidak menaikkan nomor tebakan sebelum ACK sukses. Kata yang belum dikenal diberi
pesan "Kata belum tersedia di kamus game", bukan dianggap bahasa Jepang yang salah.

## 4. Kamus Game dan Kurasi

### 4.1 Sumber dan pengamatan awal

`FlashcardVocab.reading` adalah sumber bacaan; `key` tetap identitas stabil sumber. Pada fixture,
gunakan bacaan turunan `readingFromMarkup(content.word)` sebagaimana `toVocabRow()` pada seed
flashcard, agar sesuai bacaan kartu yang sudah diperbaiki. Jangan sekadar split `key` atau
mengandalkan `note.reading` lama. Data pensiun/tanpa content tidak masuk sumber aktif.

Pemeriksaan **file lokal** pada 18 Oktober 2026 menemukan 6.722 entri. Setelah normalisasi dan
filter dasar hiragana/`ー` sepanjang 3-7, ada kandidat berikut:

| Panjang | Bacaan unik sebelum kurasi |
|---|---:|
| 3 | 1.660 |
| 4 | 2.324 |
| 5 | 1.055 |
| 6 | 472 |
| 7 | 203 |
| Total | 5.714 |

Ini bukan jumlah jawaban siap rilis atau pemeriksaan database production. Perhitungan masih
mencakup entri dengan keraguan bacaan/AI, kata langka, dan alfabet yang perlu ditinjau.
Laporan kandidat harus dapat dihasilkan ulang saat fixture berubah.

| Sumber | Normalisasi | Hasil kurasi awal yang disarankan |
|---|---|---|
| `えーっと` | `えーっと` (4) | Kata pengisi; keluarkan dari target awal |
| `アルバイト` | `あるばいと` (5) | Kandidat target umum |
| `女の人` | `おんなのひと` (6) | Kandidat target; tidak perlu dipotong |
| `小学校` | `しょうがっこう` (7) | Kandidat target umum |

### 4.2 Pipeline dan pemisahan kelayakan

Alur: fixture flashcard -> normalisasi/laporan kandidat -> kurasi game dalam fixture terpisah
-> validation -> seed tabel kamus game. Pertahankan pola fixture/version control/seed repository;
tidak membuat CMS kata atau memutasi data/progres flashcard untuk memenuhi aturan game.

- Kamus **tebakan** berisi bacaan valid yang diterima. Kamus **target** adalah subset yang
  sudah ditinjau untuk kelaziman, ketepatan bacaan, dan kategori bila dipakai.
- Kurasi menyimpan alasan penolakan/override. Afiks, potongan pola, frasa bermasalah, kata
  pengisi, nama diri, bacaan ragu, dan karakter tidak didukung tidak otomatis menjadi target.
- Deduplikasi berdasarkan bacaan kana yang dinormalisasi. Homofon seperti `公園` dan `講演`
  menjadi satu entri `こうえん` dengan beberapa sumber; tulisan kanji tidak membedakan jawaban.
- Kategori petunjuk dipilih dari makna yang dirujuk dan dikurasi. Tidak menyalin semua tag
  flashcard sebagai petunjuk. Jika aktif, hanya pilih target yang punya kategori terverifikasi;
  seluruh pemain melihat kategori yang sama sejak awal ronde.
- Panjang disaring berdasarkan karakter; kata terlalu panjang ditolak utuh, tidak dipotong.
  Normalisasi juga tidak boleh menghapus simbol agar afiks berubah menjadi kata valid palsu.
- Start memverifikasi stok target unik sesuai jumlah ronde dan distribusi panjang; berikan
  pesan stok tidak cukup, bukan diam-diam mengubah pengaturan atau mengulang kata.

### 4.3 Bentuk penyimpanan yang diusulkan

Nama model berikut konseptual, belum schema final:

| Model | Tanggung jawab |
|---|---|
| `KanaWord` | Kana unik, panjang, kelayakan tebakan/target, kategori terkurasi, status pensiun |
| `KanaWordSource` | Relasi banyak sumber `FlashcardVocab` per bacaan untuk provenance/review |
| Dictionary release | Versi normalisasi, versi alfabet, checksum, dan keanggotaan kamus immutable |
| Room/member/match | Identitas, konfigurasi, roster, revision, lifecycle dan retensi game sendiri |
| Round/player/guess | Target privat, deadline, snapshot belajar, enam slot tebakan dan waktu server |

Game menyimpan data turunan/kurasi, bukan clone seluruh `FlashcardVocab`. Pastikan target selalu
boleh ditebak, panjang 3-7 sesuai kana, sumber tidak ganda, dan FK/query memiliki index yang
sesuai. Angka waktu memakai timestamp dengan timezone; pilihan tipe/constraint final ditulis
saat fase fondasi bersama aturan grant/RLS Prisma server-only existing.

Saat Start, bekukan konfigurasi, roster, versi aturan, target, kategori, materi reveal, dan
**keanggotaan kamus tebakan**. Referensi angka versi saja tidak cukup: release lama harus tetap
tersedia atau snapshot kamusnya disimpan selama match dapat diakses. Reseed/pensiun/perbaikan
flashcard berikutnya tidak mengubah match berjalan atau hasil historisnya.

Game hanya bergantung pada ketersediaan data sumber saat penyiapan kamus, bukan pada aktifnya
UI/flag Flashcard. Mematikan Flashcard tidak ikut mematikan game dengan kamus yang sudah terbit.

## 5. Server, Privasi, dan Recovery

- Gunakan pola room/guest/lease/revision/transport yang terbukti di Kotoba Clash setelah audit
  pemisahan game. Jangan membuat engine universal atau memaksa engine jawaban tunggal menjadi
  engine enam tebakan. Namespace room, cache, rate limit, credential, dan runtime control harus
  jelas agar command satu game tidak diterima game lain.
- Principal akun melalui helper auth existing; nickname/kode room bukan bukti identitas.
  Credential guest perlu expiry, scope, takeover multi-tab, dan revocation yang dibekukan.
- Zod memvalidasi input `unknown`. Server memverifikasi membership/roster, status pemain,
  round/revision, bentuk kata, kamus release, jumlah kesempatan, dan deadline pada setiap submit.
- Serialisasikan submit untuk pemain/ronde yang sama, idempotency token retry, serta finalisasi
  ronde. Retry mengembalikan ACK yang sama; command bersamaan tidak memakai slot atau poin ganda.
  Finalisasi dan penerimaan tebakan harus mempunyai urutan lock dan clock database yang konsisten.
- Batasi submit saat ACK pending. Rate limit juga melindungi percobaan kata invalid, yang tidak
  menghabiskan enam kesempatan tetapi tetap memakai sumber daya.
- Snapshot personal hanya membawa tebakan/feedback milik penerima. Broadcast room hanya presence,
  status, jumlah percobaan, revision, dan informasi publik yang ditetapkan; jangan publish papan
  personal ke channel bersama. Hal ini berlaku juga untuk host, spectator, replay, dan error.
- Target, kandidat jawaban, materi reveal, serta checksum/hash target yang mudah ditebak tidak
  boleh masuk props RSC/client, HTML, log, cache publik, atau snapshot sebelum reveal bersama.
  Pengecualian yang disengaja hanya feedback posisi milik pemain itu sendiri.
- Commit ke database sebelum publish. Event hilang/duplikat atau publish gagal dipulihkan lewat
  snapshot otoritatif. State penting tidak bergantung pada memori/timer satu proses.
- Reconnect memulihkan tebakan ter-ACK, kesempatan, deadline dan status. Draft/pending romaji
  boleh hilang; tebakan accepted tidak hilang. Client retry dengan token lama sebelum membuat
  submit baru jika koneksi terputus sebelum menerima ACK.
- Rencana hosting mengikuti fondasi Vercel/Upstash/PostgreSQL existing; biaya tambahan per tebakan
  dan room serentak tetap harus diukur. Tidak mengasumsikan probe Kotoba Clash meluluskan game ini.

## 6. Integrasi, UI, dan Operasi

Feature usulan berada di `src/features/kana-word-race`, dengan domain murni, kontrak, server,
dan komponen terpisah. Entry katalog baru ditambahkan setelah game tersedia untuk diuji,
mengikuti bahasa visual neo-brutalist existing dan dukungan light/dark/reduced motion.

- Usulan flag `FEATURES_KANA_WORD_RACE` default **false** dan mewajibkan `FEATURES_MINI_GAMES`.
  Tambahkan lewat konstanta existing, bukan akses env langsung. Flag ini belum ada sekarang.
- Landing mengikuti metadata publik; room/hasil `noindex` dan membership terverifikasi.
  Guard wajib ada pada route, action, handshake dan command, termasuk koneksi deployment lama.
- Rancang runtime drain per game agar mematikan game ini tidak menutup Kotoba Clash. Audit
  kapasitas shared infrastructure dan jangan menyalin kontrol global tanpa memeriksa scope.
- Papan enam baris, tujuh kotak, timer, kategori dan keyboard harus nyaman pada HP sempit tanpa
  memecah satu tebakan menjadi dua baris. Fokus editor tidak hilang ketika event lawan masuk.
- Feedback tidak bergantung warna saja; beri label aksesibel posisi, nomor percobaan, status
  keyboard dan error. Detail kana kecil/dakuten tetap terbaca, termasuk reduced motion.
- Freeze aturan indikator warna keyboard; prioritas informasi tepat posisi tidak diturunkan oleh
  hasil abu-abu dari kemunculan duplikat pada tebakan lain.
- Tetapkan lobby idle timeout, retensi room/match/guess/release, cleanup batch dan expiry runtime.
  Referensi release tidak boleh dibersihkan sebelum semua match yang membutuhkannya kedaluwarsa.
- Relasi personal wajib masuk export, `anonymizeAccount`, serta disclosure guest/retensi. Export
  tidak membuka target sebelum reveal atau tebakan lawan. Log tidak menyimpan kata, token,
  nickname, kode room, atau input romaji mentah.

## 7. Pemeliharaan Dokumen

Dokumen ini menjadi sumber aturan produk/data/protokol setelah keputusan dibekukan. Checklist
pekerjaan ada di [plan](../plan/mini-games-kana-word-race.md); bukti dan acceptance ada di
[UAT](../verification/kana-word-race-uat.md). Checkbox implementasi tidak membuktikan UAT.

Setiap fase memperbarui ketiganya beserta [indeks modul](index.md),
[indeks plan](../plan/index.md), dan [hub Mini Games](mini-games.md) bila status berubah.
Route/flag/dependency/migration hanya dinyatakan tersedia setelah benar-benar ditambahkan;
status deployed atau diterima user harus mempunyai bukti environment dan tanggal.
