# Checklist UAT Kana Word Race

Tanggal awal: **18 Oktober 2026 (Asia/Jakarta)**.
Status: **Engineering dan visual lokal telah diuji; UAT production/acceptance user belum dijalankan.**

Rujukan: [modul](../module/kana-word-race.md), [plan](../plan/mini-games-kana-word-race.md),
dan [checklist umum](manual-test-checklist.md).

## 1. Bukti dan Environment

Bukti lokal 18 Oktober 2026: PostgreSQL 17 disposable pada loopback, Next 16.3.5/React 19,
Prisma 6.19.3, WanaKana 5.3.1; flag hanya dinyalakan pada dev lokal. Tidak ada write ke
Supabase/Upstash production, deployment, atau aktivasi publik.

- `npm run verify`: PASS (lint, TypeScript, 54 file/686 tes, build produksi).
- Prisma validate, dictionary check, seed validation dan seed/reseed lokal: PASS.
- Prisma migrate diff tidak menemukan drift objek Kana Race. Satu drift existing pada
  `Report.updatedAt` (migration DEFAULT now(), schema tanpa default) dibiarkan di luar scope.
- Checker integrasi: 10 kelompok PASS; termasuk Lua Redis nyata pada server loopback.
- Smoke build produksi lokal dengan flag off: landing/room/socket 404, katalog tanpa link game.
  Checksum/artefak kamus tidak masuk bundle client produksi.
- Release: `dfe413f2ad5aa0e3b06b7391237dc5e773bf433bc59e7806c4278536e067f61e`.
- Migration `20261018035428_kana_word_race` dibuat lewat Prisma create-only pada generator
  baseline disposable, ditinjau dan direplay bersama 44 migration sebelumnya. Role lokal
  Supabase disediakan untuk replay; tidak menggunakan `db push`.
- [Laporan engineering](evidence/2026-10-18-kana-race-engineering.json).
- Browser: landing 1280x900, papan komponen asli 320x800 melalui fixture sementara yang sudah
  dihapus. Lebar dokumen sama dengan viewport; tujuh tile satu baris (tile sekitar 36,85px).
  `inta-netto` -> `いんたーねっと`, pending `n`, `nn`, Backspace dan dakuten dicoba.
  Ini bukti komponen lokal; bukan bukti permainan dua perangkat/adapter production.

### Perapian UI dan mode solo (18 Oktober 2026)

- `npm run verify`: PASS (lint, TypeScript, 54 file/690 tes, build produksi).
  Prisma validate dan checker PostgreSQL terbaru: PASS, 11 kelompok tanpa opsi Redis.
  Uji Lua Redis dari bukti v1 tetap terpisah; tidak diulang pada perubahan UI/solo ini.
- Landing, create/join, pengaturan, lobby, papan/keyboard dan hasil memakai font/border/shadow
  neo brutalism yang konsisten dengan Kotoba Clash. Kode/link undangan menjadi kontrol terpisah.
  Aksen utama diperbarui menjadi hijau neo pada header, sticker, mode terpilih, tombol utama
  dan checkbox agar identitas game berbeda dari Kotoba Clash; feedback posisi tetap semantik.
  Perubahan aksen lulus lint komponen, TypeScript dan build produksi; landing/pemilih mode
  diperiksa pada browser lokal desktop dan lebar 320px, tanpa screenshot tersimpan di repository.
- Browser komponen asli melalui fixture sementara: landing akun, lobby multiplayer/solo,
  papan tujuh kana dan hasil pada 320x800; dokumen tidak melebar. Landing/hasil juga diperiksa
  desktop 1280px. Pemilih mode, select, simpan pengaturan, romaji dan submit feedback bekerja.
  Fixture dan screenshot tidak disimpan dalam repository; ukuran browser dikembalikan.
- Mode solo: akun menyiapkan sesi, mengatur panjang/ronde/waktu/kategori lalu Start tanpa ready.
  UI menampilkan skor pribadi/review dan latihan lagi; kode/undangan tidak ditampilkan.
- Migration `20261018051003_kana_word_race_solo` dibuat via Prisma create-only dan diterapkan
  setelah replay 45 migration existing pada PostgreSQL 17 lokal baru. Tidak ada write remote.
  CHECK tervalidasi: legacy/multiplayer 2-20, solo tepat satu. Tidak ada reseed untuk upgrade.
- Unit mencakup config/create/match legacy serta solo solved/exhausted/timeout, skor dan
  pergantian ronde. Checker PostgreSQL mencakup solo create/Start concurrent tanpa ready,
  mode immutable, penolakan akun lain/guest, resume owner, projection sebelum reveal,
  reveal langsung, pemulihan/retry tebakan, tiga ronde, hasil historis dan rematch.
- Cakupan browser ini memakai state fixture; perjalanan solo dengan auth/WebSocket pada
  hosting target tetap merupakan UAT tersendiri.

### Perbaikan fokus dan tata letak permainan (19 Oktober 2026)

- `npm run verify`: PASS (lint, TypeScript, 60 file/750 tes, build produksi).
- Reproduksi lokal memakai komponen `RaceBoard` asli melalui fixture sementara dengan
  header publik dan susunan panel room. Pada 1280x720 sebelum perbaikan, klik papan/mengetik
  memindahkan scroll dari 0 ke 299,5px karena caret tersembunyi berada di bawah papan.
- Sesudah perbaikan, ketikan fisik `shokudou` -> `しょくどう` dan Enter/ACK mempertahankan
  scroll 0 serta fokus `race-editor`; draft kosong kembali setelah accepted guess.
  Enam baris papan, legend, keyboard dan tombol Tebak terlihat pada viewport 1280x720.
- Pada 320x800, tujuh tile tetap satu baris dan lebar dokumen tetap 320px. Mode romaji
  menyembunyikan keyboard kana; `inta-netto` -> `いんたーねっと`, Backspace, Enter dan ACK
  mempertahankan scroll 0 dan fokus. Panjang tiga kana juga diperiksa dengan tile terbatas.
- Klik koordinat langsung pada hapus, kana, dan Tebak ketika bilah composer menempel
  mempertahankan scroll 592,5px. Error kamus simulasi berada di composer, draft tetap ada.
  Pengujian klik memakai koordinat untuk menghindari auto-scroll locator pengujian.
- Pada 390x844, bilah berada di y=88px saat keyboard digulir. Ketikan `gakkou` -> `がっこう`
  mempertahankan scroll 422px; draft dan tombol Tebak tetap terlihat, tanpa overflow horizontal.
- Background tombol keyboard dengan feedback kini mengikuti warna semantik, sehingga teks
  putih tidak tertimpa background putih tombol. Computed style dan gambar diperiksa untuk
  tepat posisi (`#216e45`), posisi lain (`#8a5b08`) dan tidak ada (`#545960`).
- Bukti: [desktop](evidence/2026-10-19-kana-race-ux-desktop.jpg) dan
  [mobile](evidence/2026-10-19-kana-race-ux-mobile.jpg). Isi papan/feedback pada gambar adalah
  state fixture sintetis, bukan hasil evaluator/server. Fixture dihapus dan viewport dipulihkan.
  Ini pemeriksaan browser desktop dengan ukuran HP; keyboard/IME perangkat fisik dan alur
  auth/WebSocket deployment tetap memerlukan UAT tersendiri.

Saat UAT deployment, lengkapi:

- Tanggal, penguji, commit/build, environment/adapter hosting.
- Versi aturan/input/alfabet, scoring dan release/checksum kamus.
- Status migration/seed/flag, konfigurasi match dan jumlah perangkat/pemain.
- Browser, ukuran layar, metode input, hasil aktual dan bukti yang sudah disanitasi.

Jangan mencatat cookie/token, nickname, kode undangan, email, target ronde aktif, atau tebakan
privat orang lain dalam bukti publik. Bukti engineering tidak menggantikan acceptance user.

## 2. Data dan Release Kamus

- [ ] `アルバイト` menjadi `あるばいと`, lima kotak; `女の人` menjadi `おんなのひと`, enam kotak;
  `小学校` menjadi `しょうがっこう`, tujuh kotak.
- [ ] Bentuk Unicode berbeda yang setara menjadi kana yang sama; `が` tidak terpecah menjadi
  dua kotak. Hiragana/katakana setara diterima setelah normalisasi.
- [ ] Kata dua/delapan karakter, afiks bersimbol, sumber tanpa content/pensiun, serta alfabet
  tidak didukung ditolak/dikeluarkan dengan alasan. Tidak ada pemotongan menjadi kata baru.
- [ ] Kana homofon tergabung dengan beberapa sumber; kategori target sesuai sumber yang dikurasi.
- [ ] Target merupakan subset tebakan; entri ragu tidak otomatis menjadi target. Seed ulang
  idempotent dan mempertahankan override/release yang masih dirujuk.
- [ ] Stok tidak cukup menolak Start secara jelas. Acak panjang menghasilkan panjang bersama
  yang sama dan target unik sesuai aturan konfigurasi.
- [ ] Perubahan/pensiun flashcard dan penerbitan release baru saat match berjalan tidak mengubah
  target, accepted dictionary, kategori atau materi reveal match tersebut.

## 3. Input dan Feedback

- [ ] Semua kana alfabet target dapat dimasukkan lewat keyboard virtual, termasuk huruf kecil,
  dakuten/handakuten dan `ー`; tidak perlu keyboard Jepang terpasang.
- [ ] `k` pending, `ka` menjadi `か`, `kyo` menjadi dua kotak `きょ`, `gakkou` menjadi empat
  kotak `がっこう`; perilaku `n/nn/n'` dan konsonan ganda sesuai kontrak final.
- [ ] Backspace menghapus pending dahulu lalu kana; Enter tidak mengirim konversi yang belum
  selesai. Tujuh kotak penuh tidak memicu submit otomatis.
- [ ] IME Jepang dapat menyelesaikan komposisi tanpa sekaligus mengirim tebakan; paste dan
  pergantian metode input tidak menggandakan karakter atau melampaui kotak.
- [ ] Kata tidak dikenal, panjang salah, karakter ilegal dan tebakan duplikat tidak menghabiskan
  kesempatan. Pesan tidak menyatakan semua kata yang belum dikenal sebagai bahasa yang salah.
- [ ] Evaluator memeriksa posisi tepat dahulu dan membatasi kuning berdasarkan jumlah sisa kana.
  Contoh target `かたかな`, tebakan `かかかか`: tepat/absen/tepat/absen.
- [ ] `か/が` dan `つ/っ` berbeda. Keyboard tidak menurunkan status yang lebih kuat akibat
  kemunculan duplikat; label feedback dapat dipahami tanpa mengandalkan warna.

## 4. Room dan Pertandingan

- [ ] Mode solo: akun Start tanpa pemain kedua/ready, mengisi enam tebakan dengan timer;
  solved/exhausted/timeout membuka jawaban, skor/review benar, lalu bisa latihan lagi.
- [ ] Solo tetap satu pemain: URL/kode yang diketahui tidak memberi akses ke akun lain/guest;
  mode tidak dapat diganti dengan command configure. Reload memulihkan accepted guesses.
- [ ] Host login membuat room; akun/guest bergabung dari kode/link dengan nickname tervalidasi.
  Room salah/penuh/closed/expired dan retry create/join mempunyai hasil yang benar.
- [ ] Perubahan konfigurasi mereset ready; Start serentak hanya membuat satu match. Host
  game ini tidak menutup room game lain tanpa aturan lintas game yang eksplisit.
- [ ] Semua pemain mendapat target/panjang/kategori/deadline sama dan masing-masing enam slot.
  Tebakan ditolak tidak mengisi slot; dua submit/retry token sama tidak menggandakan slot.
- [ ] Benar pada tebakan 1 dan tebakan 6 menutup input pribadi. Enam salah menjadi `EXHAUSTED`;
  deadline mengubah pemain belum selesai menjadi `TIMED_OUT`.
- [ ] Pemain tercepat selesai tidak membuka target ke lawan dan tidak mengakhiri kesempatan
  lawan. Reveal terjadi saat seluruh roster terminal atau deadline server.
- [ ] Boundary awal/deadline, lock menunggu dan client clock dimanipulasi mengikuti waktu server.
  Timestamp client tidak memengaruhi skor/tie.
- [ ] Kategori off menyembunyikannya dari payload; on menampilkan kategori yang sama sejak awal.
  Reveal menampilkan bacaan, kanji dan arti yang sesuai snapshot.
- [ ] Skor, tie, peringkat match dan hasil per ronde cocok dengan ledger/aturan final. Finalisasi
  diulang tidak menambah poin; rematch menjaga kode tetapi membuat match/hasil baru.

## 5. Privasi, Recovery, dan Operasi

- [ ] Audit RSC/HTML, network, websocket, error, cache dan asset client: tidak ada target,
  candidate answer set, hash target, materi reveal atau tebakan lawan sebelum diizinkan.
- [ ] Host menerima hak papan yang sama dengan pemain lain; personal ACK/snapshot tidak masuk
  channel broadcast. Late join/spectator tidak menerima papan pribadi atau hak submit.
- [ ] Manipulasi member/round/match/revision tidak memberi akses; logout/revocation dan guest
  expiry berlaku pada command serta reconnect, bukan hanya saat masuk room.
- [ ] Refresh/reconnect memulihkan accepted guesses, sisa kesempatan dan deadline. ACK hilang
  setelah commit dipulihkan dengan retry token sama; takeover multi-tab tetap konsisten.
- [ ] Proses mati, event hilang/duplikat, publish gagal dan host offline tidak mereset match.
  Outage DB/Redis memberi state yang benar tanpa menerima tebakan/poin lokal palsu.
- [ ] Flag-off/drain menutup command lama dan menyembunyikan route/link; game lain tetap berjalan.
- [ ] Rate limit berlaku untuk submit invalid/spam juga. Uji beban dan reconnect di deployment
  final; catat delta biaya serta dampak terhadap Kotoba Clash dan situs utama.
- [ ] Retensi menolak akses kedaluwarsa sebelum cron; cleanup tidak menghapus release yang masih
  diperlukan. Export/anonimisasi benar dan tidak menyertakan papan privat lawan.

## 6. Visual dan Aksesibilitas

- [ ] Desktop dan HP sempit memuat tujuh kotak dalam satu baris, enam baris serta keyboard
  yang nyaman; kana kecil/dakuten jelas, tanpa overflow atau target sentuh terlalu kecil.
- [ ] Fokus/caret tidak hilang saat progres lawan berubah. Keyboard sistem/virtual tidak
  menumpuk tanpa pilihan user; zoom dan scroll tetap dapat digunakan.
- [ ] Timer, pending/ACK/retry, salah kata, solved/exhausted/timeout, reveal dan hasil terbaca.
  Keyboard fisik, label pembaca layar, light/dark dan reduced motion sesuai pola existing.

## 7. Hasil dan Pekerjaan Tersisa

Engineering lokal mencakup unit input/domain/kamus, WebSocket loopback dengan dependency
Redis/auth terkontrol, admission HTTP, serta transaksi PostgreSQL nyata. Checker PostgreSQL
menguji concurrent create/Start, tujuh submit untuk enam slot, private projection/export,
clock setelah lock, shared reveal, finalisasi, redaksi kata/identitas dengan skor tetap,
FK same-room, RLS/grant, immutable release, retensi dan admission 20 pemain.

Checkbox skenario di atas tetap merupakan acceptance manual menyeluruh. Belum ada bukti
adapter Vercel/Upstash nyata untuk game ini, dua perangkat, native IME mobile, koneksi >270s,
load/budget, outage lintas instance atau review manusia seluruh konten. Tidak menyatakan
20 pemain sebagai kapasitas produksi. Release Owner menjalankan gate tersebut sebelum
aktivasi dan mencatat hasil/commit/environment tanpa credential atau data pribadi.

Retensi v1 adalah 7 hari sejak create/start terakhir untuk room dan 7 hari sejak Start
untuk match, bukan 7 hari setelah seluruh ronde selesai. Lobby idle 30 menit; completed room
idle 30 menit sejak reveal terakhir berakhir. Migration wajib sebelum deploy flag-off karena
export akun, anonimisasi dan cron sudah memakai tabel baru.
