# Rencana Implementasi Mini Games dan Kotoba Clash

Tanggal: **16 Oktober 2026 (Asia/Jakarta)**.
Status: **Dokumentasi rancangan; implementasi belum dimulai.**

## 1. Sumber Kebenaran dan Ruang Lingkup

- [Modul Mini Games](../module/mini-games.md): katalog publik, navigasi, registry, dan flag.
- [Modul Kotoba Clash](../module/kotoba-clash.md): aturan game, persistence, waktu, dan protokol.
- [Checklist UAT](../verification/mini-games-kotoba-clash-uat.md): expected result dan bukti.
- [Engineering baseline](../operations/engineering-baseline.md),
  [migration](../operations/migrations.md), dan [release](../operations/release-and-incidents.md).

Urutan ini melanjutkan persetujuan user atas WebSocket sendiri, target seluruh infrastruktur di
free tier, kapasitas 2-20 pemain, serta penundaan choukai. Nama tampilan game pertama ditetapkan
untuk rancangan sebagai **Kotoba Clash**, slug `kotoba-clash`, di bawah `/mini-games`.

Perubahan saat ini hanya Markdown. Tidak ada implementasi, dependency, schema/data, flag aktif,
atau deployment baru. Status migration saat ini **not required**. Seluruh checkbox implementasi
di bawah tetap kosong sampai pekerjaan dan verifikasinya selesai.

## 2. Urutan dan Gate

| Fase | Keluaran utama | Dependensi | Status awal |
|---|---|---|---|
| A | Bukti WebSocket pada Vercel Hobby dan profil penggunaan | Deployment pengujian yang terisolasi | Belum dimulai |
| B | Kontrak beku, domain, persistence, auth, dan migration | Gate A lulus | Belum dimulai |
| C | Katalog Mini Games, landing, room, invite, lobby | Fondasi B | Belum dimulai |
| D | Pertandingan teks end-to-end | Lobby C dan aturan B | Belum dimulai |
| E | Recovery, spectator, hasil, rematch, cleanup | Runner D | Belum dimulai |
| F | Verifikasi lengkap dan aktivasi bertahap | A-E dan UAT | Belum dimulai |

Fase A mengurangi risiko investasi UI/data pada adapter yang belum terbukti. Belum ada janji
bahwa 20 pemain atau jumlah room tertentu selalu masuk kuota gratis. Batas room serentak dan
spectator produksi ditetapkan setelah pengukuran, bukan disimpulkan dari kapasitas per room.

## 3. Fase A - Validasi WebSocket dan Free Tier

Tujuan: membuktikan endpoint sesuai Next.js terpasang dan batas Vercel Hobby pada project ini.

- [ ] Baca ulang panduan Route Handler di `node_modules/next/dist/docs/` serta API upgrade Vercel
  yang berlaku. Catat versi Node/Next/SDK dan aktifnya Fluid Compute.
- [ ] Implementasikan probe minimal terisolasi: autentikasi/Origin, subscribe room uji,
  snapshot sederhana, ACK, reconnect, dan Redis Pub/Sub. Jangan membuka probe tanpa guard.
- [ ] Isolasi namespace data dan traffic probe dari session/auth dan room production.
- [ ] Uji 20 koneksi selama 15-20 menit pada Vercel Hobby. Lewati cutoff 300 detik berulang kali
  dan pastikan membership/state uji dipulihkan tanpa membuat pemain baru.
- [ ] Buktikan event menyeberang dua instance/proses berbeda. Satu instance dengan 20 tab tidak
  cukup membuktikan Pub/Sub antar-instance. Catat metode dan identitas instance nonpersonal.
- [ ] Uji publish gagal, pesan duplikat/hilang, penghentian instance, dan reconnect bersamaan.
- [ ] Catat CPU, memory-hours, transfer, invocation, command Redis, latency ACK, reconnect,
  serta penggunaan baseline website. Data yang tidak dapat diamati ditulis sebagai belum terukur.
- [ ] Tetapkan rekomendasi batas room aktif global, total koneksi, spectator, idle timeout,
  dan rate limit berdasarkan hasil. Buat estimasi penggunaan harian/bulanan dengan asumsi jelas.
- [ ] Isi bagian bukti fase A pada UAT. Hapus/nonaktifkan endpoint dan data probe setelah selesai.

**Exit criteria:** koneksi dan resync terbukti pada deployment Hobby nyata, event antar-instance
terbukti, tidak ada state penting yang bergantung pada memori proses, dan tersedia profil budget.
Jika gagal, catat blocker dan revisi adapter sebelum melanjutkan. Build lokal saja tidak meluluskan A.

## 4. Fase B - Kontrak Domain, Data, dan Identitas

- [ ] Bekukan aturan detail pada dokumen modul: timer per tipe, cutoff, rumus/versi scoring,
  tie-break, status ready, roster freeze, rematch, kuota, credential guest, dan retensi.
- [ ] Pisahkan engine murni, repository, clock, publisher, dan adapter hosting. Engine tidak
  mengimpor Next.js/Vercel atau mengakses env/cookie secara langsung.
- [ ] Definisikan input/event/snapshot dengan Zod dan TypeScript strict. Semua input wire mulai
  dari `unknown`; jangan memakai `any` atau mempercayai principal dari payload client.
- [ ] Rancang room/member/match/match-player/round/answer, snapshot soal privat, index FK,
  unique answer, kesamaan match pada relasi answer, dan batas satu match aktif per room.
- [ ] Implementasikan transaksi Start/answer/finalisasi yang pendek dan idempotent. Putuskan
  lock ordering serta penerimaan berdasarkan clock database sebelum menulis agregat nilai.
- [ ] Buat dan review migration melalui workflow repository; tanpa `db push`. Pastikan RLS
  dan grant Data API mengikuti model Prisma server-only existing.
- [ ] Tambahkan credential guest terpisah, pemeriksaan akun/host, resume, multi-tab, expiry,
  revalidasi session/revocation, dan pembatasan handshake.
- [ ] Rancang pengecualian proxy untuk endpoint guest/socket secara spesifik; route akun/API lain
  tetap memakai proteksi existing.
- [ ] Definisikan key/TTL Redis dan commit-then-publish beserta recovery jika publish gagal.
  Tentukan invalidation/revision; jangan memakai cache Next lintas user untuk live state.
- [ ] Tambahkan env/flag melalui `src/constants/index.ts`, key cache melalui konstanta existing,
  dan `.env.example` tanpa secret. Flag deployment tetap off sampai gate rilis selesai.
- [ ] Tetapkan invalidasi/drain socket deployment lama saat flag dimatikan atau protokol berubah;
  proses lama tidak otomatis membaca env baru. Uji prosedurnya pada deployment yang berdampingan.
- [ ] Integrasikan relasi personal dengan anonimisasi, export, dan retensi sebelum data nyata masuk.

**Exit criteria:** kontrak terukur dan dapat diuji, migration ditinjau/terverifikasi pada environment
uji, serta retry/concurrency tidak membuat match, jawaban, atau poin ganda. Engine dapat dijalankan
tanpa bootstrap Vercel. Catatan migration mencakup urutan deploy sebelum kode pembaca tabel baru.

## 5. Fase C - Mini Games, Room, dan Lobby

- [ ] Bangun registry statis dan katalog `/mini-games` yang bisa menampung game berikutnya.
  Awalnya hanya satu kartu game nyata; jangan membuat game atau angka pemain palsu.
- [ ] Bangun landing `/mini-games/kotoba-clash`: cara bermain, Buat Room, dan Masukkan Kode.
- [ ] Implementasikan menu Mini Games pada header desktop/mobile dan entry dashboard/home
  yang relevan, mengikuti flag dan bahasa visual existing.
- [ ] Tambahkan guard katalog/game/action/socket, metadata canonical landing, sitemap publik,
  dan `noindex` untuk room/hasil. Tampilkan empty state jika semua game mati.
- [ ] Implementasikan create room oleh akun, kode unik, invitation link environment aktif,
  lookup/join dengan akun/guest, validasi nickname, dan batas kapasitas atomik.
- [ ] Bangun konfigurasi level/kategori/subkategori dan jumlah soal dari stok eligible nyata.
  Parent checkbox mendukung seluruh/sebagian; jumlah tidak cukup ditolak ulang oleh server.
- [ ] Implementasikan daftar peserta, presence, ready per `configRevision`, dan reset ready
  saat host mengubah konfigurasi. Freeze roster dan assignment secara atomik saat Start.
- [ ] Uji guest refresh, kode tidak valid/penuh/expired, Start bersamaan, dan race join/Start.

**Exit criteria:** user dapat menemukan game dari katalog, membuat room, mengundang guest, memilih
konfigurasi valid, dan memulai tepat satu pertandingan dengan roster benar. Mobile/keyboard dan
flag off tidak meninggalkan link/CTA rusak.

## 6. Fase D - Runner, Reveal, dan Scoring

- [ ] Sampling soal teks unik, sebaran subkategori, konteks lengkap, urutan bersama, dan snapshot
  kunci privat. Soal yang bergantung pada audio tidak eligible.
- [ ] Persist schedule lengkap: countdown, awal/deadline tiap soal, reveal, dan akhir match.
- [ ] Runner satu soal, countdown dari waktu server, pending/ACK jawaban, dan jawaban pertama final.
- [ ] Validasi roster/ronde/pilihan/deadline; jangan mengirim hasil benar/salah pada ACK.
- [ ] Implementasikan scoring v1, reset streak pada salah/kosong, dan agregasi yang dapat
  direkonstruksi serta tidak bertambah dua kali saat finalisasi retry.
- [ ] Tampilkan reveal 8 detik, pembahasan singkat/fallback jujur, dan leaderboard ronde selesai.
  Tetap tunggu deadline meski semua pemain sudah menjawab.
- [ ] Audit props RSC, event, snapshot, error, cache, dan export: kunci/pembahasan/furigana/skor
  ronde aktif tidak bocor sebelum reveal. Jangan melonggarkan guard answer-key existing.
- [ ] Selesaikan 5/10/15/20 soal dengan kombinasi benar/salah/kosong dan verifikasi hasil manual.

**Exit criteria:** pertandingan nyata selesai otomatis, setiap peserta dapat menjawab secara
independen sampai cutoff, dan hasil sesuai ledger jawaban dengan informasi privat tetap tertutup.

## 7. Fase E - Recovery, Hasil, Rematch, dan Cleanup

- [ ] Reconnect/resubscribe/snapshot dengan revision, backoff+jitter, dan pending answer retry.
- [ ] Pulihkan fase dari schedule jika instance mati, event hilang, host keluar, atau semua offline.
  State logis tidak bergantung pada ketepatan callback timer.
- [ ] Bedakan pemain roster yang kembali dan identitas baru yang menjadi spectator; spectator
  mempunyai kuota sendiri dan tidak pernah dapat submit jawaban.
- [ ] Bangun podium, tie bersama, statistik, review lengkap, serta URL hasil per match yang sah.
- [ ] Rematch mempertahankan kode/link room dan membuat match/roster/ready baru. Spectator dapat
  memilih ikut pada lobby berikutnya; skor pertandingan lama tidak berubah.
- [ ] Terapkan batas global room/koneksi, rate limit create/join/answer, TTL cache/lease, idle
  close, retensi detail, dan cleanup PostgreSQL batch melalui cron existing bila diperlukan.
- [ ] Lengkapi anonimisasi akun, export privat, cookie disclosure, dan copy retensi yang benar.
- [ ] Lengkapi error state: Redis/DB tidak tersedia, socket gagal, room penuh/closed, dan data expired.
  Pakai logger existing tanpa token, nickname, kode room, pilihan, kunci, atau PII.

**Exit criteria:** reconnect/retry tidak mengulang pertandingan atau menggandakan nilai; room dapat
dipakai rematch dan data sementara/personal mempunyai lifecycle yang terverifikasi.

## 8. Fase F - Verifikasi dan Rilis

- [ ] Jalankan `npm run verify` (lint, typecheck, test existing, build) dan validasi Prisma bila ada
  perubahan schema. Jangan menambah test framework baru untuk fase ini.
- [ ] Jalankan seluruh UAT yang relevan: desktop, mobile, guest/akun, concurrency, cutoff,
  disconnect, leak audit, flag, cleanup, dan resource budget.
- [ ] Verifikasi ulang pada deployment yang memakai adapter dan env final, termasuk reconnect
  melewati 5 menit. Uji proses VPS secara terpisah bila klaim bootstrap VPS sudah siap dibuat.
- [ ] Perbarui modul, indeks, overview, ledger migration, dan catatan verifikasi sesuai kode aktual.
  Catat setiap known issue dengan severity/owner dan keputusan rilis sesuai aturan project.
- [ ] Aktifkan flag bertahap dengan limit hasil pengukuran dan verifikasi ulang menu/sitemap/robots.
- [ ] Serahkan ringkasan perubahan, migration/seed/cache yang diperlukan, hasil gate, dan UAT user.

**Exit criteria:** semua gate wajib lulus dengan bukti; tidak ada blocker correctness/leakage atau
kompatibilitas Hobby yang terbuka; kapasitas rilis sesuai profil penggunaan yang diukur.

## 9. Aturan Pemeliharaan Rencana

Centang hanya setelah implementasi dan verifikasi relevan selesai. UAT user tetap dibedakan dari
check otomatis developer. Perubahan default ditulis pada modul sebelum kode diubah; status layanan
beta, kuota, dan versi adapter diperiksa kembali saat fase A dijalankan.

Jangan memulai integrasi Supabase Realtime, QStash, choukai, atau layanan berbayar sebagai cara
melewati gate yang gagal tanpa memperbarui keputusan arsitektur bersama user.
