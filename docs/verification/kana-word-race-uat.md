# Checklist UAT Kana Word Race

Tanggal awal: **18 Oktober 2026 (Asia/Jakarta)**.
Status: **Belum dijalankan; fitur masih rancangan.** Nama game adalah nama kerja.

Rujukan: [modul](../module/kana-word-race.md), [plan](../plan/mini-games-kana-word-race.md),
dan [checklist umum](manual-test-checklist.md).

## 1. Bukti dan Environment

Isi saat pengujian benar-benar berlangsung:

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

Belum ada eksekusi UAT, hasil PASS/FAIL, migration atau bukti deployment untuk game ini.
Saat diuji, catat hasil per skenario, blocker/owner, perbaikan yang dilakukan dan verifikasi
ulang. Status modul/plan/indeks baru berubah setelah bukti yang sesuai tersedia.
