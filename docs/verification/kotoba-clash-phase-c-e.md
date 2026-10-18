# Kotoba Clash - Integrasi Katalog, Lobby dan Pertandingan

Tanggal: **17 Oktober 2026 (Asia/Jakarta)**. Owner: Engineering Owner.
Status: **kode C-E/lokal lulus; production diaktifkan user dan UAT awal 2 pemain/5 soal lulus**.
Release decision terbaru: **aktif atas persetujuan user sebelum UAT/budget lengkap**.
`FEATURES_MINI_GAMES` dan `FEATURES_KOTOBA_CLASH` tetap default false di kode.

User melaporkan migration fondasi telah diterapkan dan meminta pengembangan dilanjutkan.
Tidak ada migration/schema/seed/backfill baru pada integrasi ini. `prisma migrate status`
mengonfirmasi 42 migration up to date. Pemeriksaan metadata Supabase dalam transaksi READ ONLY
mengonfirmasi fondasi applied, enam tabel RLS tanpa grant Data API, 22 constraint tervalidasi dan
partial unique index RUNNING yang valid. Tidak melakukan write atau menguji insert pada remote.

Rujukan: [plan](../plan/mini-games-kotoba-clash.md), [hub](../module/mini-games.md),
[game](../module/kotoba-clash.md), [UAT](mini-games-kotoba-clash-uat.md),
[fondasi B](kotoba-clash-phase-b.md), dan [transport A](kotoba-clash-phase-a.md).

## Pembaruan UAT Production

Setelah integrasi ini, user menyetujui aktivasi dan melakukan deployment/pengujian. Pada
17 Oktober 2026, audit READ ONLY room dari tiga screenshot menemukan satu match FINISHED:
N5, 5 soal Moji-Goi, 2 pemain dan 1 late spectator. Sepuluh jawaban tersimpan dalam interval
ronde; seluruh ronde finalized. Skor host 5.152 (4 benar/1 salah/streak 4) dan guest 3.773
(3 benar/2 salah/streak 2) cocok dengan rekonstruksi engine dan screenshot. Spectator tidak
memiliki match-player. Seluruh 19 pemeriksaan integritas lulus, tanpa perubahan data/schema.

Durasi match 195 detik belum menguji rotasi 270 detik/cutoff 300 detik. Rematch, reconnect,
10/15/20 soal, mobile, privasi payload aktif, beban 20 pemain serta budget masih terbuka.
Rincian dan bukti tersanitasi ada pada [UAT](mini-games-kotoba-clash-uat.md#uat-production-user---17-oktober-2026).
Bagian bukti lokal berikut tetap mencatat cakupan pemeriksaan saat integrasi awal.

## Perilaku yang Tersedia

- Katalog `/mini-games`, landing `/mini-games/kotoba-clash`, serta entry header desktop/mobile,
  home, sidebar dan dashboard. Registry statis berisi satu game nyata dan mengikuti flags.
- Host akun membuat room dan menyalin kode/link dari origin browser aktif. Peserta akun/guest
  memilih nickname; membership lama dapat dilanjutkan. Kode tidak menjadi credential.
- Konfigurasi N5-N1, 5/10/15/20 soal, serta parent/child checkbox Moji-Goi, Bunpou dan Dokkai.
  Indeterminate mengikuti anak eligible; stok asli dicek ulang saat configure dan Start.
- Sampling unik dan seimbang secara round-robin tipe terpilih. Soal/context audio ditolak;
  bacaan wajib, pilihan dan kunci divalidasi. Snapshot dibekukan pada Start.
- Ready terikat configRevision. Start membekukan roster peserta berlease aktif yang siap,
  termasuk host. Pemain offline tidak otomatis masuk roster; minimal dua pemain.
- Runner teks/gambar, countdown 5 detik, deadline per tipe, reveal 8 detik, pembahasan/fallback,
  skor cepat/streak dan ranking bersama untuk exact tie. Pilihan lawan tidak dikirim.
- Pendatang saat match aktif menjadi spectator. Setelah selesai spectator dapat memilih ikut;
  ready ulang dan Start membuat matchId baru dengan room/code sama. URL hasil lama tetap sah.
- Hasil/review hanya untuk membership sah, match selesai dan belum expired. Review tidak
  menampilkan countdown atau pesan ronde berikutnya; statistik benar/salah/kosong tersedia.
- Export akun merekonstruksi skor sendiri untuk schedule selesai, termasuk status RUNNING yang
  tertinggal ketika semua offline. Tidak mengirim snapshot/kunci, data lawan, atau match aktif.
- Cron auth existing menjalankan batch cleanup room/match expired, idle close serta anonimisasi
  guest expired. Identitas dihapus tanpa menghapus ledger lawan; runtime memeriksa expiry sendiri.
- Form join dan kebijakan privasi versi 1.5 menjelaskan cookie guest 7 hari dan retensi hasil.

## Transport dan Batas Implementasi

Endpoint produk: `GET /api/mini-games/kotoba-clash/ws?room=<UUID>`.
Node.js Route Handler memakai `@vercel/functions` 3.10.1, `ws` 8.22.0, maxDuration 300 detik.
Proxy hanya mengecualikan path socket yang tepat. Handshake memeriksa flag, runtime control,
Origin sama dengan origin request, Upgrade header, UUID, rate limit, principal dan membership.

Sesudah subscribe, server mengirim snapshot sesuai viewer. Pesan client hanya `sync` dan
`submit_answer` dengan strict Zod/protocolVersion 1. ACK privat baru dikirim sesudah commit,
tanpa hasil benar/salah. Redis Pub/Sub hanya membawa invalidation roomId/revision; perubahan
dikoaleskan 200 ms dan diikuti query authoritative. Snapshot live tidak masuk shared Next cache.

| Kontrol | Nilai saat pengujian |
|---|---|
| Room OPEN global | 1, dijaga advisory lock PostgreSQL pada create |
| Pemain / spectator per room | Maksimal 20 / 5 membership yang belum expired |
| Lease | Satu per membership, TTL 60 detik; takeover atomik mengganti owner |
| Batas lease room | 25; socket fisik lama dapat bertahan sampai revalidasi berikutnya |
| Heartbeat, revalidasi dan repair | 20 detik, serta sebelum setiap command |
| Rotasi socket | 270 detik, reconnect dengan backoff dan jitter |
| Payload client | Maksimal 2.048 byte; binary ditolak |
| Command socket | Maksimal 4 pesan/detik dan 4 pending per socket |
| Slow consumer | Ditutup bila bufferedAmount >512.000 byte saat mengirim |
| Rate IP HMAC | Create 5/menit; scope action lain masing-masing 40/menit; handshake 60/menit |
| Idle lobby | 30 menit sejak aktivitas/perkiraan akhir match terbaru |
| Retensi match | 7 hari sesudah scheduled end; akses guest juga dibatasi expiry credential |
| Batch cron | 100 kandidat per jenis per eksekusi; harian 03:00 UTC |

Angka ini adalah batas sementara untuk pengujian, **bukan kapasitas free tier yang terukur**.
Snapshot PostgreSQL masih diambil per koneksi saat sync/heartbeat; biaya query, memory-hours,
Upstash dan lonjakan reconnect endpoint produk belum diukur. Satu lease per membership juga
tidak berarti batas ketat 25 socket fisik saat takeover berlangsung.

## Bukti Verifikasi Lokal

| Pemeriksaan | Hasil / batas bukti |
|---|---|
| `npm run verify` | PASS; lint 0 warning, TypeScript strict, 638 tes / 47 file, production build |
| Foundation checker | PASS; 8 kelompok transaksi/constraint/RLS/anonimisasi, PostgreSQL 17.11 |
| Room checker | PASS; 10 kelompok integrasi repository/proyeksi/cleanup/export dan Lua Redis nyata |
| Socket | PASS; 5 tes memakai socket loopback nyata; auth/persistence/Redis dimock |
| Catalogue/landing desktop | PASS visual lokal, 1280 x 900 |
| Landing mobile | PASS visual lokal, 390 x 844; scrollWidth = innerWidth =390 |
| Production build flag off | PASS; 4 route halaman + socket 404, home/sitemap tanpa link Mini Games |
| Product multi-user browser game | PASS awal user; 2 pemain + late spectator, N5/5 soal production, ledger cocok; cakupan lengkap tersisa |
| Product Hobby cutoff, Pub/Sub lintas instance, drain | NOT RUN; bukti probe A tidak menggantikan UAT adapter final |
| Remote migration | PASS read-only; 42 migration up to date, fondasi applied, RLS/grant/22 constraint dan partial index valid |
| Budget bulanan | BLOCKED; masih memerlukan memory-hours, Redis bulanan dan delta terhadap baseline |

Artefak: [room checker](evidence/2026-10-17-kotoba-clash-room.json) dan
[metadata Supabase read-only](evidence/2026-10-17-kotoba-clash-supabase.json).
Screenshot pemeriksaan lokal tidak disimpan dalam repository.
Fixture memakai cluster PostgreSQL/Redis loopback disposable; tidak menulis Supabase production.
Hasil ini adalah pemeriksaan developer, bukan acceptance user. Build mengeluarkan peringatan
dukungan Node 20 mendatang dari AWS SDK existing; seluruh gate selesai dengan exit code 0.

Room checker meliputi create concurrent/admission, guest resume/collision, sampling/audio,
stale ready/reset, roster offline, late spectator concurrency, hasil belum selesai, proyeksi
privat, export offline, finalisasi saat read, rematch/URL lama, retention dan takeover lease.
Deadline/score/first-answer/concurrent Start juga dilindungi tes fondasi. Belum ada pengujian
browser real-time seluruh 5/10/15/20 soal, audit RSC lengkap, atau simulasi outage produk cloud.

## Menjalankan Ulang

Pakai database disposable loopback berawalan `kotoba_`, PostgreSQL 17 dan Redis lokal.
Replay migration mengikuti runbook B, lalu jalankan:

```bash
npm run check:kotoba-clash:foundation -- postgresql://postgres@127.0.0.1:55439/kotoba_dev
npm run check:kotoba-clash:room -- postgresql://postgres@127.0.0.1:55439/kotoba_dev 56379
npm run verify
```

Checker membersihkan fixture miliknya pada finally. Jangan mengganti URL ini dengan production.
`npm run dev` cukup untuk visual katalog/landing, **tidak mendukung upgrade WebSocket ini**.
Pengujian transport lokal memerlukan Vercel CLI minimal 54.14.2 sesuai dokumentasi adapter.
CLI global mesin saat pemeriksaan adalah 48.11.0; belum diubah. Guest memakai secure cookie,
sehingga flow credential harus diuji pada origin HTTPS yang sesuai, termasuk preview Hobby.
Bootstrap server VPS produk belum tersedia; engine/protokol tetap terpisah dari API upgrade Vercel.

## Runtime Control dan Penonaktifan

Operator memakai env/REDIS_PREFIX environment tujuan yang sama di seluruh deployment:

```bash
npm run kotoba-clash:runtime -- status
npm run kotoba-clash:runtime -- disable
```

Disable menolak handshake/action/command baru. Socket lama membaca kontrol bersama pada command
atau heartbeat 20 detik, lalu ditutup. Kontrol disimpan persisten; key hilang berarti enabled
oleh runtime control, tetap memerlukan kedua flag. Jangan menghapus key sebagai cara drain.

Untuk menonaktifkan: disable kontrol, pastikan socket lama menutup, lalu matikan kedua flag dan
redeploy. Untuk uji terisolasi: gunakan namespace/environment terpisah, flag true dan kontrol
enable. Aktivasi production berikutnya telah disetujui dan dilakukan user sebelum gate lengkap.
Perintah enable adalah `npm run kotoba-clash:runtime -- enable`; tidak dijalankan pada production
selama pekerjaan ini. Drain lintas deployment produk masih harus dibuktikan pada UAT.

## Known Issues dan Keputusan Rilis

| Severity | Hal terbuka | Owner | Keputusan |
|---|---|---|---|
| P1 | Budget final belum terukur, termasuk snapshot/query per koneksi | Engineering + Release Owner | Aktivasi awal disetujui user; ukur delta Usage sebelum menaikkan limit sementara |
| P1 | UAT produk Hobby belum lengkap; 2 pemain/5 soal sudah lulus | Engineering Owner | Berikutnya rematch 10 soal/cutoff >5 menit, lalu 15/20 soal, 20 pemain, privasi dan drain |
| P2 | Portabilitas VPS belum mencakup bootstrap produk/TLS/proxy | Engineering Owner | Tidak mengklaim deploy VPS siap atau nol perubahan |

Tidak ada host transfer, kick/leave UI, leaderboard global, chat atau choukai pada v1.
Pemain offline tetap memiliki membership untuk reconnect; roster Start hanya memakai lease aktif.
Langkah UAT tersisa ada pada checklist B-D. Deployment/aktivasi dilakukan user sesudah integrasi;
audit lanjutan hanya membaca data dan memperbarui dokumentasi.

## Catatan AGENTS.md

`next dev` otomatis memperbarui blok `nextjs-agent-rules` melalui
`node_modules/next/dist/server/lib/generate-agent-files.js`. Rujukan aturan proyek sebelumnya
berada di dalam blok itu dan ikut tertimpa. Rujukan dipulihkan di luar marker; blok Next terpasang
tetap sesuai generator (`hasCurrentAgentRules` true). Tidak mengubah isi aturan project.
