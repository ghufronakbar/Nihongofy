# Rencana Implementasi Mini Games dan Kotoba Clash

Tanggal: **16 Oktober 2026 (Asia/Jakarta)**.
Pembaruan budget: **17 Oktober 2026**.
Status: **Implementasi C-E tersedia; verifikasi lokal lulus, UAT produk Hobby dan budget masih menjadi gate aktivasi.**

Keputusan 17 Oktober 2026: user meminta "lanjut saja dulu" setelah menerima laporan budget
parsial. Pengembangan fondasi dan fitur boleh berjalan; pengukuran budget yang tersisa tetap
wajib sebelum aktivasi publik. Keputusan ini mengganti dependensi gate A untuk memulai B,
tanpa menyatakan bahwa free tier atau kapasitas rilis sudah terjamin.

## 1. Sumber Kebenaran dan Ruang Lingkup

- [Modul Mini Games](../module/mini-games.md): katalog publik, navigasi, registry, dan flag.
- [Modul Kotoba Clash](../module/kotoba-clash.md): aturan game, persistence, waktu, dan protokol.
- [Checklist UAT](../verification/mini-games-kotoba-clash-uat.md): expected result dan bukti.
- [Laporan fase A](../verification/kotoba-clash-phase-a.md): versi, runbook, bukti, dan batas pengukuran.
- [Engineering baseline](../operations/engineering-baseline.md),
  [migration](../operations/migrations.md), dan [release](../operations/release-and-incidents.md).

Urutan ini melanjutkan persetujuan user atas WebSocket sendiri, target seluruh infrastruktur di
free tier, kapasitas 2-20 pemain, serta penundaan choukai. Nama tampilan game pertama ditetapkan
untuk rancangan sebagai **Kotoba Clash**, slug `kotoba-clash`, di bawah `/mini-games`.

Probe A menguji adapter Hobby terisolasi. Fondasi B menambahkan schema/engine, dan user melaporkan
migration sudah diterapkan pada 17 Oktober 2026; status/metadata Supabase telah dikonfirmasi
read-only tanpa write data. Integrasi C-E tidak menambah migration: katalog,
lobby, runner, hasil/rematch, transport dan cleanup tersedia dalam kode, flags tetap mati.
Bukti [C-E](../verification/kotoba-clash-phase-c-e.md) mencatat 638 tes, 10 kelompok integrasi lokal,
visual desktop/mobile dan smoke flag off. Checkbox implementasi lokal tidak meluluskan UAT produk
Hobby, acceptance user, atau budget. Exit criteria fase penuh tetap terbuka sampai bukti itu ada.

## 2. Urutan dan Gate

| Fase | Keluaran utama | Dependensi | Status awal |
|---|---|---|---|
| A | Bukti WebSocket pada Vercel Hobby dan profil penggunaan | Deployment pengujian yang terisolasi | Transport PASS; budget parsial, gate BLOCKED |
| B | Kontrak beku, domain, persistence, auth, dan migration | Transport A lulus; kelanjutan disetujui user | Kode/lokal dan metadata migration remote lulus; drain cloud tersisa |
| C | Katalog Mini Games, landing, room, invite, lobby | Fondasi B | Kode dan pemeriksaan lokal tersedia; UAT browser host/guest tersisa |
| D | Pertandingan teks end-to-end | Lobby C dan aturan B | Kode dan tes lokal tersedia; game lengkap browser/Hobby belum diuji |
| E | Recovery, spectator, hasil, rematch, cleanup | Runner D | Kode dan integrasi repository lulus; outage/drain produk cloud tersisa |
| F | Verifikasi lengkap dan aktivasi bertahap | A-E dan UAT | Gate engineering lulus; UAT/budget belum selesai, flags off |

Fase A mengurangi risiko investasi UI/data pada adapter yang belum terbukti. Belum ada janji
bahwa 20 pemain atau jumlah room tertentu selalu masuk kuota gratis. Batas room serentak dan
spectator produksi ditetapkan setelah pengukuran, bukan disimpulkan dari kapasitas per room.

## 3. Fase A - Validasi WebSocket dan Free Tier

Tujuan: membuktikan endpoint sesuai Next.js terpasang dan batas Vercel Hobby pada project ini.

- [x] Baca ulang panduan Route Handler di `node_modules/next/dist/docs/` serta API upgrade Vercel
  yang berlaku. Catat versi Node/Next/SDK dan aktifnya Fluid Compute.
- [x] Implementasikan probe minimal terisolasi: autentikasi/Origin, subscribe room uji,
  snapshot sederhana, ACK, reconnect, dan Redis Pub/Sub. Jangan membuka probe tanpa guard.
- [x] Isolasi namespace data dan traffic probe dari session/auth dan room production.
- [x] Uji 20 koneksi selama 15-20 menit pada Vercel Hobby. Lewati cutoff 300 detik berulang kali
  dan pastikan membership/state uji dipulihkan tanpa membuat pemain baru.
- [x] Buktikan event menyeberang dua instance/proses berbeda. Satu instance dengan 20 tab tidak
  cukup membuktikan Pub/Sub antar-instance. Catat metode dan identitas instance nonpersonal.
- [x] Uji publish gagal, pesan duplikat/hilang, penghentian instance, dan reconnect bersamaan.
  Fault publish/event adalah injeksi; process loss nyata memakai SIGKILL bootstrap Node lokal.
  Vercel diuji melalui cutoff alami. Batas admission setelah crash dicatat pada laporan fase A.
- [ ] Catat CPU, memory-hours, transfer, invocation, command Redis, latency ACK, reconnect,
  serta penggunaan baseline website. Data yang tidak dapat diamati ditulis sebagai belum terukur.
- [x] Catat snapshot Usage 30 hari dari user: CPU, invocation, dan transfer Vercel tersedia.
  Snapshot agregat belum memisahkan biaya probe/baseline; memory-hours dan command Redis bulanan
  belum tersedia. Rincian angka dan sisa kuota dicatat pada laporan A, pembaruan 17 Oktober.
- [ ] Tetapkan rekomendasi batas room aktif global, total koneksi, spectator, idle timeout,
  dan rate limit berdasarkan hasil. Buat estimasi penggunaan harian/bulanan dengan asumsi jelas.
- [x] Isi bagian bukti fase A pada UAT. Hapus/nonaktifkan endpoint dan data probe setelah selesai.

Hasil 16 Oktober: 20 peserta selama 960 detik, 60 reconnect, 1.800 mutasi fixture, snapshot akhir
konsisten, ACK p95 57 ms (maksimum 11.131 ms). Kedua preview dan credential sementara dibersihkan.
Snapshot Usage yang ditinjau 17 Oktober menunjukkan sisa CPU 2 jam 52 menit, sekitar 830 ribu
invocation, Fast Origin Transfer 8,58 GB, dan Fast Data Transfer 96,42 GB. Ini angka agregat
30 hari, bukan delta biaya satu room. Memory-hours, command Redis bulanan, dan biaya probe yang
terpisah dari baseline masih belum terukur; rekomendasi kapasitas belum ditetapkan. Tidak
menutup gate budget atau mengaktifkan fitur publik sebelum pengukuran diselesaikan. Pengembangan
fase B dilanjutkan sesuai keputusan user 17 Oktober. Rincian ada pada laporan A.

**Exit criteria:** koneksi dan resync terbukti pada deployment Hobby nyata, event antar-instance
terbukti, tidak ada state penting yang bergantung pada memori proses, dan tersedia profil budget.
Jika gagal, catat blocker dan revisi adapter sebelum melanjutkan. Build lokal saja tidak meluluskan A.

## 4. Fase B - Kontrak Domain, Data, dan Identitas

- [x] Bekukan aturan detail pada dokumen modul: timer per tipe, cutoff, rumus/versi scoring,
  tie-break, status ready, roster freeze, rematch, kuota, credential guest, dan retensi.
  Kuota satu room/5 spectator hanya batas uji rancangan, belum kapasitas rilis terukur.
- [x] Pisahkan engine murni, repository, clock, publisher, dan adapter hosting. Engine tidak
  mengimpor Next.js/Vercel atau mengakses env/cookie secara langsung.
- [x] Definisikan input/event/snapshot dengan Zod dan TypeScript strict. Semua input wire mulai
  dari `unknown`; jangan memakai `any` atau mempercayai principal dari payload client.
- [x] Rancang room/member/match/match-player/round/answer, snapshot soal privat, index FK,
  unique answer, kesamaan match pada relasi answer, dan batas satu match aktif per room.
- [x] Implementasikan transaksi Start/answer/finalisasi yang pendek dan idempotent. Putuskan
  lock ordering serta penerimaan berdasarkan clock database sebelum menulis agregat nilai.
- [x] Buat dan review migration melalui workflow repository; tanpa `db push`. Pastikan RLS
  dan grant Data API mengikuti model Prisma server-only existing.
  Replay dan constraint diuji pada PostgreSQL 17.11 lokal; kendala shadow legacy dicatat pada laporan B.
- [ ] Tambahkan credential guest terpisah, pemeriksaan akun/host, resume, multi-tab, expiry,
  revalidasi session/revocation, dan pembatasan handshake.
- [x] Rancang pengecualian proxy untuk endpoint guest/socket secara spesifik; route akun/API lain
  tetap memakai proteksi existing.
- [x] Definisikan key/TTL Redis dan commit-then-publish beserta recovery jika publish gagal.
  Tentukan invalidation/revision; jangan memakai cache Next lintas user untuk live state.
- [x] Tambahkan env/flag melalui `src/constants/index.ts`, key cache melalui konstanta existing,
  dan `.env.example` tanpa secret. Flag deployment tetap off sampai gate rilis selesai.
- [ ] Tetapkan invalidasi/drain socket deployment lama saat flag dimatikan atau protokol berubah;
  proses lama tidak otomatis membaca env baru. Uji prosedurnya pada deployment yang berdampingan.
- [x] Integrasikan relasi personal dengan anonimisasi, export, dan retensi sebelum data nyata masuk.
  Export/anonimisasi/retensi cron terintegrasi, termasuk hasil offline dan guest expired; lokal lulus.

Endpoint snapshot, takeover lease nyata, handshake/rate guard dan runtime drain sekarang tersedia.
Tes socket memakai loopback dengan adapter auth/persistence/Redis dimock; Lua takeover dan repository
memakai Redis/PostgreSQL lokal nyata. Flow cookie HTTPS/handshake serta drain lintas deployment
produk belum diuji di Hobby, sehingga item identitas/drain dan exit fase B belum diluluskan penuh.

**Exit criteria:** kontrak terukur dan dapat diuji, migration ditinjau/terverifikasi pada environment
uji, serta retry/concurrency tidak membuat match, jawaban, atau poin ganda. Engine dapat dijalankan
tanpa bootstrap Vercel. Catatan migration mencakup urutan deploy sebelum kode pembaca tabel baru.

## 5. Fase C - Mini Games, Room, dan Lobby

- [x] Bangun registry statis dan katalog `/mini-games` yang bisa menampung game berikutnya.
  Awalnya hanya satu kartu game nyata; jangan membuat game atau angka pemain palsu.
- [x] Bangun landing `/mini-games/kotoba-clash`: cara bermain, Buat Room, dan Masukkan Kode.
- [x] Implementasikan menu Mini Games pada header desktop/mobile dan entry dashboard/home
  yang relevan, mengikuti flag dan bahasa visual existing.
- [x] Tambahkan guard katalog/game/action/socket, metadata canonical landing, sitemap publik,
  dan `noindex` untuk room/hasil. Tampilkan empty state jika semua game mati.
- [x] Implementasikan create room oleh akun, kode unik, invitation link environment aktif,
  lookup/join dengan akun/guest, validasi nickname, dan batas kapasitas atomik.
- [x] Bangun konfigurasi level/kategori/subkategori dan jumlah soal dari stok eligible nyata.
  Parent checkbox mendukung seluruh/sebagian; jumlah tidak cukup ditolak ulang oleh server.
- [x] Implementasikan daftar peserta, presence, ready per `configRevision`, dan reset ready
  saat host mengubah konfigurasi. Freeze roster dan assignment secara atomik saat Start.
- [ ] Uji guest refresh, kode tidak valid/penuh/expired, Start bersamaan, dan race join/Start.

**Exit criteria:** user dapat menemukan game dari katalog, membuat room, mengundang guest, memilih
konfigurasi valid, dan memulai tepat satu pertandingan dengan roster benar. Mobile/keyboard dan
flag off tidak meninggalkan link/CTA rusak.

## 6. Fase D - Runner, Reveal, dan Scoring

- [x] Sampling soal teks unik, sebaran subkategori, konteks lengkap, urutan bersama, dan snapshot
  kunci privat. Soal yang bergantung pada audio tidak eligible.
- [x] Persist schedule lengkap: countdown, awal/deadline tiap soal, reveal, dan akhir match.
- [x] Runner satu soal, countdown dari waktu server, pending/ACK jawaban, dan jawaban pertama final.
- [x] Validasi roster/ronde/pilihan/deadline; jangan mengirim hasil benar/salah pada ACK.
- [x] Implementasikan scoring v1, reset streak pada salah/kosong, dan agregasi yang dapat
  direkonstruksi serta tidak bertambah dua kali saat finalisasi retry.
- [x] Tampilkan reveal 8 detik, pembahasan singkat/fallback jujur, dan leaderboard ronde selesai.
  Tetap tunggu deadline meski semua pemain sudah menjawab.
- [ ] Audit props RSC, event, snapshot, error, cache, dan export: kunci/pembahasan/furigana/skor
  ronde aktif tidak bocor sebelum reveal. Jangan melonggarkan guard answer-key existing.
- [ ] Selesaikan 5/10/15/20 soal dengan kombinasi benar/salah/kosong dan verifikasi hasil manual.

**Exit criteria:** pertandingan nyata selesai otomatis, setiap peserta dapat menjawab secara
independen sampai cutoff, dan hasil sesuai ledger jawaban dengan informasi privat tetap tertutup.

## 7. Fase E - Recovery, Hasil, Rematch, dan Cleanup

- [x] Reconnect/resubscribe/snapshot dengan revision, backoff+jitter, dan pending answer retry.
- [x] Pulihkan fase dari schedule jika instance mati, event hilang, host keluar, atau semua offline.
  State logis tidak bergantung pada ketepatan callback timer.
- [x] Bedakan pemain roster yang kembali dan identitas baru yang menjadi spectator; spectator
  mempunyai kuota sendiri dan tidak pernah dapat submit jawaban.
- [x] Bangun hasil/ranking dengan tie bersama, statistik, review lengkap, dan URL hasil per match.
  UI memakai tabel peringkat; belum ada podium grafis atau persentase akurasi.
- [x] Rematch mempertahankan kode/link room dan membuat match/roster/ready baru. Spectator dapat
  memilih ikut pada lobby berikutnya; skor pertandingan lama tidak berubah.
- [x] Terapkan batas global room/koneksi, rate limit create/join/answer, TTL cache/lease, idle
  close, retensi detail, dan cleanup PostgreSQL batch melalui cron existing bila diperlukan.
- [x] Lengkapi anonimisasi akun, export privat, cookie disclosure, dan copy retensi yang benar.
- [ ] Lengkapi error state: Redis/DB tidak tersedia, socket gagal, room penuh/closed, dan data expired.
  Pakai logger existing tanpa token, nickname, kode room, pilihan, kunci, atau PII.

**Exit criteria:** reconnect/retry tidak mengulang pertandingan atau menggandakan nilai; room dapat
dipakai rematch dan data sementara/personal mempunyai lifecycle yang terverifikasi.

## 8. Fase F - Verifikasi dan Rilis

- [x] Jalankan `npm run verify` (lint, typecheck, test existing, build) dan validasi Prisma bila ada
  perubahan schema. Jangan menambah test framework baru untuk fase ini.
- [ ] Jalankan seluruh UAT yang relevan: desktop, mobile, guest/akun, concurrency, cutoff,
  disconnect, leak audit, flag, cleanup, dan resource budget.
- [ ] Verifikasi ulang pada deployment yang memakai adapter dan env final, termasuk reconnect
  melewati 5 menit. Uji proses VPS secara terpisah bila klaim bootstrap VPS sudah siap dibuat.
- [x] Perbarui modul, indeks, overview, ledger migration, dan catatan verifikasi sesuai kode aktual.
  Catat setiap known issue dengan severity/owner dan keputusan rilis sesuai aturan project.
- [ ] Aktifkan flag bertahap dengan limit hasil pengukuran dan verifikasi ulang menu/sitemap/robots.
- [ ] Serahkan ringkasan perubahan, migration/seed/cache yang diperlukan, hasil gate, dan UAT user.

**Exit criteria:** semua gate wajib lulus dengan bukti; tidak ada blocker correctness/leakage atau
kompatibilitas Hobby yang terbuka; kapasitas rilis sesuai profil penggunaan yang diukur.

## 9. Handoff 17 Oktober 2026

- Migration fondasi terkonfirmasi applied pada Supabase melalui status/metadata read-only. Tidak
  menjalankan write remote; tidak ada migration, seed, backfill, atau cache reset baru.
- Gate engineering lulus 638 tes /47 file. Foundation checker 8 kelompok dan room checker 10
  kelompok lulus pada cluster disposable. Catalogue/landing desktop dan mobile lulus visual lokal.
- Room/result/socket flag-off 404 dan home/sitemap tanpa link sudah diuji dengan production build.
- Selesaikan UAT produk browser/Hobby, 20 pemain, cutoff, drain, 5/10/15/20 soal serta leak audit;
  ukur memory-hours dan Redis terhadap baseline sebelum aktivasi. Jangan memakai probe A sebagai
  pengganti bukti game final atau jaminan free tier.
- Runbook runtime drain, limit sementara, known issues/owner, dan cara pengujian ada di laporan C-E.

## 10. Aturan Pemeliharaan Rencana

Centang hanya setelah implementasi dan verifikasi relevan selesai. UAT user tetap dibedakan dari
check otomatis developer. Perubahan default ditulis pada modul sebelum kode diubah; status layanan
beta, kuota, dan versi adapter diperiksa kembali saat fase A dijalankan.

Jangan memulai integrasi Supabase Realtime, QStash, choukai, atau layanan berbayar sebagai cara
melewati gate yang gagal tanpa memperbarui keputusan arsitektur bersama user.
