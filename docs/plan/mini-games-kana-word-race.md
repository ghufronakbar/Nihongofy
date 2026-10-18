# Rencana Implementasi Mini Games - Kana Word Race

Tanggal: **18 Oktober 2026 (Asia/Jakarta)**.
Status: **Dokumentasi rancangan; belum ada implementasi atau perubahan database.**

Nama **Kana Word Race** dan slug `kana-word-race` adalah nama kerja. User menyetujui pembuatan
plan setelah diskusi game tebak kana multiplayer; nama final dan detail yang belum diputuskan
dicatat di dokumen modul, bukan dianggap sudah disetujui atau terimplementasi.

## 1. Sumber Kebenaran dan Batas Pekerjaan

- [Modul Kana Word Race](../module/kana-word-race.md): keputusan, aturan, data dan protokol.
- [Checklist UAT](../verification/kana-word-race-uat.md): skenario, expected result dan bukti.
- [Mini Games](../module/mini-games.md) dan [Kotoba Clash](../module/kotoba-clash.md): katalog,
  pengalaman room, dan fondasi realtime yang dapat diaudit untuk dipakai ulang.
- [Flashcard](../module/flashcard.md), [seed flashcard](../seed-flashcard.md),
  [aturan project](../project-rules.md), [database](../database.md),
  [migration](../operations/migrations.md), dan [engineering baseline](../operations/engineering-baseline.md).

Hasil pekerjaan saat ini hanya dokumen modul, plan, UAT dan tautan indeks. Tidak menambah game
palsu pada registry publik, mengubah schema/fixture flashcard, memasang library, menjalankan
seed/migration, atau mengaktifkan production.

## 2. Urutan dan Gate

| Fase | Keluaran | Dependensi | Status |
|---|---|---|---|
| A | Identitas, aturan beku dan audit input/kamus/realtime | Diskusi terdokumentasi | Belum dimulai |
| B | Kamus game terkurasi dan release immutable | Aturan normalisasi/alfabet A | Belum dimulai |
| C | Domain, persistence, identitas dan migration | A; format kamus B | Belum dimulai |
| D | Katalog, landing, room dan lobby | Fondasi C; stok B | Belum dimulai |
| E | Input kana/romaji, papan dan evaluator | A; kontrak C; fixture B | Belum dimulai |
| F | Multiplayer end-to-end, hasil dan recovery | D-E | Belum dimulai |
| G | Verifikasi, UAT, pengukuran dan rilis | B-F | Belum dimulai |

B dan rancangan domain C dapat berjalan berdampingan setelah kontrak A dibekukan. UI prototipe
boleh memakai fixture lokal yang jelas, tetapi tidak menjadi bukti integrasi server/room.

## 3. Fase A - Bekukan Aturan dan Audit Fondasi

- [ ] Baca aturan repository dan panduan Next.js yang relevan di `node_modules/next/dist/docs/`
  sebelum menulis kode: route/action, caching, request API, proxy dan adapter realtime.
- [ ] Bekukan nama/slug, kapasitas pemain, jumlah ronde, timer menurut panjang, countdown,
  reveal, distribusi acak, kategori, scoring/tie, dan pengulangan kata di modul.
- [ ] Bekukan alfabet game, satuan kotak, normalisasi, small kana, dakuten/handakuten dan `ー`.
  Audit kata 3-7 karakter terhadap tombol yang benar-benar tersedia.
- [ ] Evaluasi WanaKana atau alternatif: pending romaji, `n/nn/n'`, konsonan ganda, kana kecil,
  batas kotak, paste, Backspace dan IME native. Catat dependency/version bila dipilih.
- [ ] Audit room/guest/revision/lease/transport/runtime-control Kotoba Clash; catat bagian yang
  aman dipakai ulang dan bagian yang terikat game. Jangan merombak engine existing tanpa bukti.
- [ ] Tetapkan scope satu room per host, perilaku room host lintas game, late join, host keluar,
  spectator, guest expiry, multi-tab, retensi dan cleanup release.
- [ ] Tetapkan kontrak kamus target versus tebakan dan versi immutable, serta cara snapshot
  personal dikirim tanpa masuk channel broadcast room.

**Exit criteria:** keputusan terbuka pada modul terisi; alfabet/input/data/scoring dapat
diverifikasi dengan contoh; kapasitas dan budget masih dinyatakan target sampai diukur.

## 4. Fase B - Pipeline Kamus dan Kurasi

- [ ] Tambahkan laporan kandidat yang read-only dari fixture flashcard memakai bacaan turunan
  `content.word` yang sama dengan seed existing; jangan split `key` atau mengubah sumber.
- [ ] Normalisasi NFKC -> katakana/hiragana -> NFC, validasi alfabet dan panjang 3-7, deduplikasi
  bacaan, kelompokkan sumber homofon, serta catat sumber kosong/pensiun/ragu yang dikeluarkan.
- [ ] Hasilkan ulang hitungan per panjang/level/kategori dan daftar karakter yang tidak didukung.
  Angka 5.714 pada modul adalah pengamatan kandidat mentah 18 Oktober, bukan target kelulusan.
- [ ] Buat fixture kurasi game dengan kelayakan tebakan/target terpisah, alasan penolakan,
  provenance, kategori terverifikasi dan override yang tidak tertimpa regenerasi otomatis.
- [ ] Tinjau target awal: kata umum, bacaan pasti, contoh/arti tepat; kata langka/pengisi/afiks
  tidak otomatis dipublikasikan. Verifikasi stok untuk seluruh kombinasi konfigurasi yang ditawarkan.
- [ ] Definisikan release kamus immutable: checksum/versi aturan serta keanggotaan tebakan dan
  snapshot target. Perubahan seed berikutnya harus membuat release baru.
- [ ] Tambahkan validation-only dan seed idempotent sesuai pola fixture repository; kamus game
  tidak boleh mengubah kartu, jadwal FSRS, atau flag Flashcard.

**Exit criteria:** daftar tebakan/target dapat ditelusuri dan direproduksi; stok nyata diketahui;
homofon tergabung; reseed menjaga kurasi dan release yang masih dirujuk match.

## 5. Fase C - Domain, Persistence, dan Identitas

- [ ] Definisikan kontrak Zod input/event, public room snapshot dan personal snapshot. Data
  tidak dipercaya mulai sebagai `unknown`; pertahankan TypeScript strict tanpa `any`.
- [ ] Buat engine murni untuk lifecycle, enam tebakan, feedback kana berulang, deadline dan
  scoring versioned; pisahkan repository/clock/publisher/adapter hosting.
- [ ] Finalkan model kamus/source/release dan room/member/match/round/player/guess. Dokumentasikan
  unique/check/FK/index, scope same-match, enam slot valid, idempotency dan retensi.
- [ ] Bekukan seluruh material match saat Start: target, kategori, materi reveal dan keanggotaan
  kamus. Buktikan perubahan sumber/release tidak mengubah pertandingan berjalan atau hasil lama.
- [ ] Implementasikan Start/submit/finalisasi dengan transaksi pendek, lock ordering dan clock
  database. Uji race dua submit, submit/deadline, retry setelah commit dan finalisasi berulang.
- [ ] Rancang migration lewat workflow repository dan catat di ledger saat file migration nyata
  dibuat; tanpa `db push`. Audit replay, grant/RLS Prisma server-only dan urutan deploy.
- [ ] Integrasikan auth helper existing, credential guest, lease/takeover, revocation, Origin,
  rate limit dan namespace antar-game. Jangan mempercayai ID pemain/waktu dari client.
- [ ] Tambahkan flag default-off lewat konstanta, runtime-control per game, cache key terpusat,
  TTL/expiry, export/anonimisasi dan redaction log.

**Exit criteria:** migration ditinjau dan diuji pada environment uji; invariant privacy,
retry/concurrency/clock terbukti. Tidak ada perubahan perilaku Kotoba Clash yang tidak disengaja.

## 6. Fase D - Katalog, Landing, Room, dan Lobby

- [ ] Buat landing dan route usulan sesudah identitas dibekukan; registry hanya menawarkan game
  yang tersedia melalui flag. Pertahankan satu menu Mini Games pada shell publik.
- [ ] Guard landing/room/hasil, action dan socket; metadata publik untuk landing, `noindex`
  room/hasil. Jangan masukkan nama game ini ke daftar flag aktif sebelum implementasinya ada.
- [ ] Create/join dengan akun/guest, kode/link origin aktif, nickname, kapasitas atomik, expiry,
  join/Start race dan pesan room penuh/tutup/tidak ditemukan.
- [ ] Form konfigurasi panjang tetap/acak 3-7, jumlah ronde, timer dan kategori sesuai kontrak A;
  tampilkan stok eligible nyata dan tolak konfigurasi yang tidak cukup di server.
- [ ] Lobby presence/ready per revision, reset saat konfigurasi berubah, Start atomik, dan
  alur menunggu bagi pendatang setelah roster dibekukan.

**Exit criteria:** host dan guest dapat masuk dari undangan dan memulai tepat satu match dengan
konfigurasi/roster valid. Flag off tidak meninggalkan link publik atau command aktif.

## 7. Fase E - Input, Papan, dan Feedback

- [ ] Buat enam baris dengan 3-7 kotak dan satu editor aktif; keyboard virtual lengkap,
  komposer romaji dan jalur IME native mengikuti aturan A.
- [ ] Pending Latin tidak memenuhi kotak; Backspace, paste, Enter komposisi dan perubahan metode
  input tidak menggandakan huruf atau mengirim tebakan tanpa sengaja.
- [ ] Validasi tepat panjang dan alfabet sebelum submit; server tetap mengulang validasi.
  ACK accepted mengunci baris; pending/rejected tidak mengurangi kesempatan.
- [ ] Evaluator dua tahap untuk kana duplikat, serta indikator keyboard yang mempertahankan
  informasi terkuat. Tidak ada evaluasi menggunakan target yang dikirim ke client.
- [ ] Audit HP sempit untuk tujuh kotak, enam baris, keyboard, timer, kategori, fokus dan scroll;
  dukung keyboard fisik, label aksesibel, kontras dan reduced motion.

**Exit criteria:** contoh input/normalisasi dan repeated-kana sesuai kontrak, seluruh target
dapat diketik, dan papan mobile tetap terbaca tanpa memecah baris tebakan.

## 8. Fase F - Multiplayer, Hasil, dan Recovery

- [ ] Integrasikan submit privat dengan server deadline/kamus release/slot/idempotency. Broadcast
  hanya progres yang disetujui; pribadi menerima kata/feedback miliknya saja.
- [ ] Terapkan `PLAYING/SOLVED/EXHAUSTED/TIMED_OUT`; pemenang awal tidak mengakhiri hak lawan.
  Reveal hanya saat seluruh roster terminal atau deadline, tanpa menunggu timer proses tertentu.
- [ ] Skor/ranking dari clock server dan ledger versi beku; hasil per match, jawaban/artinya,
  beberapa sumber homofon dan rematch pada room yang sama.
- [ ] Reconnect memulihkan accepted guesses/status/waktu; retry setelah ACK hilang tidak memakai
  dua kesempatan. Snapshot personal tetap privat pada takeover multi-tab.
- [ ] Pulihkan event hilang/duplikat, publish gagal, proses mati, Redis/DB outage, host offline,
  deployment lama, flag drain dan expiry; gunakan bootstrap/pola hosting yang sudah diaudit.
- [ ] Cleanup room/match/guess dan release tak terpakai sesuai retensi; verifikasi export,
  anonimisasi, privacy disclosure serta larangan membocorkan tebakan lawan.

**Exit criteria:** match dapat selesai dan direkonstruksi dengan hasil benar; reconnect/rematch
tidak menggandakan state; target/papan pribadi tidak bocor sebelum batas aksesnya.

## 9. Fase G - Verifikasi dan Rilis

- [ ] Jalankan validation fixture, Prisma validate bila schema berubah, dan `npm run verify`
  sesuai engineering baseline; manfaatkan tooling existing tanpa framework test baru.
- [ ] Audit payload RSC/HTML/event/snapshot/error/cache/log/export dan dictionary asset client.
  Enam kesempatan valid harus tetap menjadi batas server, termasuk concurrent/invalid spam.
- [ ] Jalankan [UAT](../verification/kana-word-race-uat.md) desktop/mobile, host/guest dan lintas
  instance pada deployment target; reconnect melewati batas umur koneksi yang relevan.
- [ ] Ukur budget tambahan per submit/room, koneksi, Redis, PostgreSQL dan dampak terhadap situs
  serta Kotoba Clash. Tetapkan kapasitas operasional dari bukti, bukan kuota provider semata.
- [ ] Perbarui modul/plan/UAT, hub, indeks, overview, ledger migration dan runbook sesuai kondisi
  nyata. Bedakan kode tersedia, migration applied, deployed dan acceptance user.
- [ ] Serahkan urutan migration -> release kamus -> deploy flag-off -> verifikasi -> aktivasi,
  beserta rollback/drain dan known issue sebelum rilis.

**Exit criteria:** gate engineering dan UAT wajib lulus, kapasitas terukur, dan status rilis
memiliki bukti. Selesainya dokumen ini tidak meluluskan fase implementasi mana pun.

## 10. Aturan Pembaruan

Centang pekerjaan hanya setelah keluaran nyata dan verifikasinya tersedia. Perubahan aturan
ditulis dahulu di modul, checklist pekerjaan diselaraskan di sini, dan hasil pemeriksaan dicatat
di UAT dengan tanggal/environment. Jangan mengubah hasil UAT menjadi PASS hanya karena build lulus.
