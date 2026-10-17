# Rencana Implementasi Mini Games dan Kotoba Clash

Tanggal: **16 Oktober 2026 (Asia/Jakarta)**.
Pembaruan budget: **17 Oktober 2026**.
Status: **Production aktif atas persetujuan user; UAT awal 2 pemain/5 soal dan late spectator lulus. UAT lengkap/budget masih terbuka.**

Keputusan awal 17 Oktober 2026: user meminta "lanjut saja dulu" setelah menerima laporan budget
parsial. Pengembangan fondasi dan fitur boleh berjalan; pengukuran budget yang tersisa tetap
wajib sebelum aktivasi publik. Keputusan ini mengganti dependensi gate A untuk memulai B,
tanpa menyatakan bahwa free tier atau kapasitas rilis sudah terjamin.

Keputusan berikutnya pada tanggal yang sama: user menyetujui aktivasi production sebelum seluruh
UAT/budget selesai ("saya aktifkan dulu fiturnya tidak apa apa"), lalu melakukan deployment dan
pengujian. Keputusan ini mengganti penahanan aktivasi sebelumnya. Pemeriksaan read-only room
membuktikan satu match N5/5 soal selesai, skor sesuai ledger dan tiga tampilan user, serta late
spectator tanpa roster pemain. Rincian dan pengujian tersisa ada di [UAT](../verification/mini-games-kotoba-clash-uat.md).

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
lobby, runner, hasil/rematch, transport dan cleanup tersedia dalam kode. Default flag tetap false;
user telah mengaktifkan fitur pada deployment production. Probe infrastruktur tetap terpisah.
Bukti [C-E](../verification/kotoba-clash-phase-c-e.md) mencatat 638 tes, 10 kelompok integrasi lokal,
visual desktop/mobile dan smoke flag off. Checkbox implementasi lokal tidak meluluskan UAT produk
Hobby, acceptance user, atau budget. Exit criteria fase penuh tetap terbuka sampai bukti itu ada.

## 2. Urutan dan Gate

| Fase | Keluaran utama | Dependensi | Status awal |
|---|---|---|---|
| A | Bukti WebSocket pada Vercel Hobby dan profil penggunaan | Deployment pengujian yang terisolasi | Transport PASS; budget parsial, gate BLOCKED |
| B | Kontrak beku, domain, persistence, auth, dan migration | Transport A lulus; kelanjutan disetujui user | Kode/lokal dan metadata migration remote lulus; drain cloud tersisa |
| C | Katalog Mini Games, landing, room, invite, lobby | Fondasi B | Kode/lokal lulus; room host + guest production terbukti, cakupan lobby lengkap tersisa |
| D | Pertandingan teks end-to-end | Lobby C dan aturan B | N5/5 soal, 2 pemain production lulus; 10/15/20 soal tersisa |
| E | Recovery, spectator, hasil, rematch, cleanup | Runner D | Late spectator/hasil production lulus; rematch/recovery/outage/drain cloud tersisa |
| F | Verifikasi lengkap dan aktivasi bertahap | A-E dan UAT | Aktif atas persetujuan user; gate engineering lulus, UAT lengkap/budget belum selesai |

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
menutup gate budget. Pengembangan fase B, lalu aktivasi production sebelum pengukuran selesai,
dilanjutkan sesuai keputusan user 17 Oktober yang dicatat di awal dokumen. Rincian pengukuran
ada pada laporan A.

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
  dan `.env.example` tanpa secret. Default flag tetap off; aktivasi deployment kemudian disetujui user.
- [ ] Tetapkan invalidasi/drain socket deployment lama saat flag dimatikan atau protokol berubah;
  proses lama tidak otomatis membaca env baru. Uji prosedurnya pada deployment yang berdampingan.
- [x] Integrasikan relasi personal dengan anonimisasi, export, dan retensi sebelum data nyata masuk.
  Export/anonimisasi/retensi cron terintegrasi, termasuk hasil offline dan guest expired; lokal lulus.

Endpoint snapshot, takeover lease nyata, handshake/rate guard dan runtime drain sekarang tersedia.
Tes socket memakai loopback dengan adapter auth/persistence/Redis dimock; Lua takeover dan repository
memakai Redis/PostgreSQL lokal nyata. Flow cookie HTTPS/handshake telah diuji awal melalui
host/guest production, tetapi refresh/revocation serta drain lintas deployment belum diuji,
sehingga item identitas/drain dan exit fase B belum diluluskan penuh.

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
  Fondasi v1 menunggu deadline meski semua menjawab; aturan baru v2 ada pada bagian 11.
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
  Penyempurnaan UI menambahkan visual juara/crown; persentase akurasi belum ditampilkan.
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
- [ ] Validasi limit hasil pengukuran dan menu/sitemap/robots pada deployment aktif. Aktivasi awal
  telah dilakukan user sebelum pengukuran selesai; item ini tetap terbuka sampai bukti lengkap.
- [ ] Serahkan ringkasan perubahan, migration/seed/cache yang diperlukan, hasil gate, dan UAT user.

**Exit criteria:** semua gate wajib lulus dengan bukti; tidak ada blocker correctness/leakage atau
kompatibilitas Hobby yang terbuka; kapasitas rilis sesuai profil penggunaan yang diukur.

## 9. Handoff 17 Oktober 2026

- Migration fondasi terkonfirmasi applied pada Supabase melalui status/metadata read-only. Tidak
  menjalankan write remote; tidak ada migration, seed, backfill, atau cache reset baru.
- Gate engineering lulus 638 tes /47 file. Foundation checker 8 kelompok dan room checker 10
  kelompok lulus pada cluster disposable. Catalogue/landing desktop dan mobile lulus visual lokal.
- Room/result/socket flag-off 404 dan home/sitemap tanpa link sudah diuji dengan production build.
- UAT awal user: 2 pemain, 1 late spectator, N5/5 soal, FINISHED, 10 jawaban dan 19 pemeriksaan
  integritas lulus read-only; hasil cocok dengan screenshot. Tidak ada perubahan data/schema.
- Berikutnya: rematch 10 soal Moji-Goi (6 menit 25 detik), refresh/disconnect dan rotasi socket,
  lalu mobile/Bunpou/Dokkai, 15/20 soal, drain, leak audit dan beban 20 pemain. Ukur memory-hours
  serta Redis terhadap baseline; kapasitas free tier belum terjamin walau production sudah aktif.
- Runbook runtime drain, limit sementara, known issues/owner, dan cara pengujian ada di laporan C-E.

## 10. Penyempurnaan UI/UX Kompetisi - 17 Oktober 2026

Permintaan user setelah UAT awal: pertahankan neobrutalism Nihongofy dan buat landing, join,
lobby serta arena terasa seperti kompetisi. Rencana perubahan:

- [x] Perbaiki terminal room: sembunyikan undangan dan hentikan reconnect pada room tutup/expired.
- [x] Selaraskan button, input, select dan checkbox dengan border tebal, shadow tegas dan font brand.
- [x] Tambahkan visual arena pada landing/join, avatar akun dan initial nickname untuk guest.
- [x] Tampilkan leaderboard dekat soal, crown untuk pemimpin dan api berwarna untuk rekor streak
  yang sudah terbuka: 3 orange, 5 biru, 8 merah muda, 10 emas. Tie tetap mengikuti aturan v1.
- [x] Tambahkan timer progress, transisi countdown/soal/reveal dan feedback jawaban tersimpan;
  dukung mobile, keyboard dan reduced motion tanpa mengubah scoring/deadline.
- [x] Verifikasi regresi terminal/privacy, visual desktop/mobile dan `npm run verify`; catat bukti
  serta batas UAT cloud. Tidak ada perubahan schema/migration atau write production.

Rincian implementasi dan evidence: [laporan UI/UX](../verification/kotoba-clash-ui-ux.md).
Gate akhir PASS: 643 tes /48 file, lint/typecheck/build. UI cloud dan perjalanan keyboard/reduced
motion penuh tetap terbuka pada laporan; tidak ada migration atau environment baru.

## 11. Ronde Selesai Saat Semua Menjawab - 17 Oktober 2026

Keputusan user: tanpa pilihan tempo di host. Pertandingan baru langsung masuk reveal ketika
seluruh roster sudah mengirim jawaban yang diterima server; jika ada yang belum menjawab,
deadline maksimal tetap berlaku. Spectator tidak dihitung, pemain offline tetap bagian roster.

- [x] Versikan perilaku sebagai rules v2; pertahankan dukungan v1 untuk pertandingan/history lama.
  Migration hanya melonggarkan CHECK versi menjadi 1/2; aplikasi baru menulis versi 2 eksplisit.
  Default DB tetap 1 agar deployment lama tetap dapat membuat match selama pergantian versi.
- [x] Jawaban terakhir memendekkan ronde dan menggeser seluruh jadwal berikutnya secara atomik
  di bawah lock room/match existing. Reveal tetap 8 detik; retry tidak menggeser ulang.
- [x] Pertahankan bonus kecepatan berdasarkan durasi maksimal subkategori, bukan waktu reveal
  yang dipercepat; samakan rekonstruksi leaderboard, agregat tersimpan dan export akun.
- [x] Uji quorum roster, spectator/offline, submit terakhir bersamaan, retry, deadline normal,
  reveal privat, reconnect/read, finalisasi, export, v1 dan replay migration pada DB disposable.
- [x] Jalankan gate engineering, perbarui modul/UAT/ledger dan serahkan urutan migration/deploy.

Bukti lokal: [laporan early-reveal](../verification/kotoba-clash-early-reveal.md). Gate lulus
645 tes /48 file; tiga checker database/Redis dan replay 43 migration PASS. Migration/redeploy
production v2 dan acceptance browser belum dilakukan; tidak ada environment baru.

## 12. Pembuatan Room Multiuser - 17 Oktober 2026

Keputusan user: hapus batas satu room global. Setiap akun dapat membuat room; membuat room baru
menutup seluruh room lama milik host tersebut, termasuk bila pertandingan lama masih berjalan.
Room pengguna lain tidak disentuh. Pembuatan room baru dan penutupan lama harus atomik.

- [x] Hapus admission global; serialisasi pembuatan hanya per host dan kunci room secara terurut.
- [x] Tutup room lama, naikkan revision dan kirim invalidation setelah commit agar peserta melihat
  terminal closed. Pertahankan ledger/history lama dan tolak jawaban/join baru ke room closed.
- [x] Gunakan request UUID agar retry klik yang sama tidak mengganti room dua kali atau membuka
  kembali room yang sudah digantikan; jangan menambah tabel/kolom untuk idempotency.
- [x] Longgarkan create menjadi 20 percobaan/60 detik per akun terverifikasi; pisahkan dari bucket
  IP lama agar pengguna satu jaringan tidak saling memblokir. Limit join/pemain tetap berlaku.
- [x] Uji host berbeda, replacement/concurrency/retry, rollback, room aktif, publisher dan
  rate limit; perbarui modul/UAT/ledger serta jalankan gate engineering.

Bukti lokal: [laporan room multiuser](../verification/kotoba-clash-multi-room.md). Gate lulus
651 tes /49 file; room checker 14 kelompok dan foundation checker 8 kelompok PASS. Tidak ada
migration/env baru; redeploy dan acceptance browser production masih perlu dijalankan user.

## 13. Refinement Lobby - 17 Oktober 2026

- [x] Tampilkan peringatan draft konfigurasi di form dan panel kanan; tahan ready/start host
  sampai draft disimpan. Pindahkan tombol simpan ke panel kanan yang tetap mudah dijangkau.
- [x] Tambahkan kick oleh host hanya saat lobby/selesai, notifikasi terminal untuk peserta,
  penolakan join ulang dengan identitas yang sama, dan pertahankan ledger pertandingan.
- [x] Izinkan perubahan nickname sendiri di lobby/selesai dengan validasi duplikat server.
  Isi awal form create/join dari display name profil, tanpa mengubah profil saat rename.
- [x] Uji otorisasi/race start, socket/terminal reload kick, rename dan UI lokal; catat migration
  serta gate. UAT browser production (termasuk kick offline/reconnect) tetap terbuka pada laporan.

Bukti: [laporan refinement lobby](../verification/kotoba-clash-lobby-refinements.md). Gate lulus
659 tes /50 file, room checker 19 kelompok dan foundation checker 8 kelompok. Migration baru
`20261017164300_kotoba_clash_lobby_refinements` wajib sebelum redeploy; belum diterapkan production.

## 14. Aturan Pemeliharaan Rencana

Centang hanya setelah implementasi dan verifikasi relevan selesai. UAT user tetap dibedakan dari
check otomatis developer. Perubahan default ditulis pada modul sebelum kode diubah; status layanan
beta, kuota, dan versi adapter diperiksa kembali saat fase A dijalankan.

Jangan memulai integrasi Supabase Realtime, QStash, choukai, atau layanan berbayar sebagai cara
melewati gate yang gagal tanpa memperbarui keputusan arsitektur bersama user.
