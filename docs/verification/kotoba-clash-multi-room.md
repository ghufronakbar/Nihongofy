# Kotoba Clash - Room Multiuser dan Penggantian Room

Tanggal: **17 Oktober 2026 (Asia/Jakarta)**. Owner: Engineering Owner.
Status: **kode dan gate lokal PASS; belum dideploy atau diterima di browser production pada sesi ini**.

User mengalami pesan kapasitas walau sudah menghapus key Upstash. Audit read-only menemukan
satu room OPEN dengan match FINISHED sekitar 21 menit sebelumnya, belum melewati idle 30 menit.
Kode masih membatasi seluruh website ke satu room OPEN. Ini berbeda dari bucket create Redis
5 percobaan/menit per IP. User menyetujui penghapusan batas global dan penutupan otomatis room
lama ketika host membuat room baru.

Rujukan: [modul](../module/kotoba-clash.md), [plan bagian 12](../plan/mini-games-kotoba-clash.md),
[UAT B13](mini-games-kotoba-clash-uat.md), dan [migration ledger](../operations/migrations.md).

## Perilaku Sekarang

- Host berbeda dapat membuka room masing-masing tanpa batas satu room global. Satu host
  mempunyai satu room terbuka: request baru menutup seluruh room OPEN milik host tersebut dan
  membuat room/kode baru dalam satu transaksi. Room host lain tidak disentuh.
- Ini juga menutup room dengan pertandingan aktif: UI lama menerima status closed, socket
  berakhir, dan join/jawaban baru ditolak. Keterangan tersebut tampil di form sebelum klik.
  Ledger/jadwal lama tidak dihapus atau ditandai selesai secara palsu. Hasil completed tetap
  dapat diakses oleh membership sah; match terputus direkonstruksi menurut jadwal existing.
- Client menyimpan UUID request selama retry klik yang sama. UUID memakai PK room existing;
  retry room yang masih terbuka mengembalikan room tersebut. Request lama yang room-nya sudah
  ditutup ditolak tanpa menggantikan room terbaru. ID milik host lain tidak dapat diambil alih.
  Client lama tanpa UUID tetap diterima dan setiap pemanggilan menjadi request baru.
- Create kini mempunyai bucket `create-account`, HMAC ID akun terverifikasi: **20 percobaan
  per 60 detik**. Akun berbeda di Wi-Fi yang sama tidak berbagi bucket create. Counter create
  IP lama tidak dibaca; tidak perlu menghapus key Upstash. Guest/revoked session tetap ditolak.
- Batas 20 pemain/5 spectator per room, auth, rate join/action lain, lease dan idle tetap berlaku.
  Pesan CAPACITY sekarang menjelaskan bahwa room tujuan penuh, bukan kapasitas uji global.

## Konsistensi dan Recovery

Urutan lock create: akun, advisory lock namespace/ID host, lalu seluruh room OPEN miliknya
terurut ID. Namespace dua integer memakai cast ID eksplisit karena Prisma mengirim parameter
angka SQL sebagai bigint. Host lain tidak berbagi admission lock. Index FK `hostUserId` existing
mendukung pencarian room host; tidak memerlukan index baru.

Penutupan menaikkan revision setiap room. Insert room gagal membatalkan seluruh penutupan.
Unique collision pada kode/ID memakai retry terbatas; benturan request ID milik akun lain tetap
ditolak. Setelah commit, action mengirim invalidation room lama melalui publisher existing;
response client hanya berisi identitas/kode/revision room baru. Kegagalan publish dicatat dan
tidak membatalkan commit; sync/heartbeat existing memulihkan status closed.

Tidak ada migration, tabel/kolom/index/CHECK baru, perubahan RLS, seed, atau backfill. Room
existing tidak ditutup secara massal saat deploy; penggantian terjadi ketika pemilik membuat
room baru. History dan expiry existing tetap dipakai. Tidak ada write production pada sesi ini.

## Bukti Lokal

Pengujian memakai PostgreSQL 17.11 dan Redis disposable pada loopback. Seluruh 43 migration
existing direplay untuk menyiapkan database uji; perubahan ini tidak menambah migration.
Bukti tersanitasi: [evidence](evidence/2026-10-17-kotoba-clash-multi-room.json).

| Pemeriksaan | Hasil / batas bukti |
|---|---|
| `npm run verify` | PASS; lint 0 warning, TypeScript strict, 651 tes /49 file, production build |
| `npx prisma validate` | PASS |
| Room checker | PASS; 14 kelompok integrasi PostgreSQL/proyeksi/history/cleanup dan Lua Redis nyata |
| Host berbeda | PASS; kedua room OPEN tanpa penolakan kapasitas global |
| Concurrency dan retry | PASS; request identik mengembalikan satu room; request berbeda serentak menyisakan satu room OPEN per host |
| Stale retry / ownership | PASS; request room closed dan ID akun lain tidak menutup/mengambil alih room terbaru |
| Rollback | PASS; uncommitted ID conflict membuat insert menunggu setelah penutupan, commit konflik menyebabkan rollback, room lama tetap OPEN |
| Penggantian saat match aktif | PASS; state closed, join/answer baru ditolak, hasil match sebelumnya dan room host lain tetap tersedia |
| Auth / rate / publish | PASS; 5 tes action, termasuk akun berbeda di IP sama, bucket 20/60, guest/revoked/excessive rejection, publish setelah commit dan payload minimum |
| Socket closed | PASS; socket loopback menerima snapshot closed lalu close code 4004; persistence/Redis dimock pada tes socket |
| Foundation checker | PASS; 8 kelompok constraint/clock/roster/finalisasi/RLS/anonimisasi existing |
| Pembersihan | PASS; 0 fixture user/room/match/package; server PostgreSQL/Redis uji dihentikan |
| Browser production / beban serentak | NOT RUN; ini bukti lokal, bukan acceptance cloud atau pengukuran kuota provider |

Uji rollback menunggu bukti lock insert dari `pg_stat_activity` sebelum melepaskan konflik;
tidak hanya mengandalkan sleep untuk mengklaim penutupan sudah terjadi. Checker export memakai
match ID karena satu akun kini dapat mempunyai beberapa membership room historis.

## Deploy dan Acceptance

Redeploy kode lalu refresh tab host. Tidak ada env baru, reset Redis, reseed atau migration baru
untuk perubahan ini. Migration early-reveal sebelumnya tetap harus applied sebelum kode v2
dipakai. Server/tab dari deployment lama masih dapat memakai perilaku create lama selama rollout.

Subset relevan dari [checklist umum](manual-test-checklist.md) dan UAT B04/B06/B13/D05/D07:

1. Login akun A dan B pada browser terpisah, buat room masing-masing. Keduanya harus dapat
   membuat/membagikan undangan tanpa menunggu host lain, termasuk jika memakai Wi-Fi sama.
2. Sebagai A, kembali ke landing dan buat room baru. Kode harus berubah, room A lama langsung
   menampilkan terminal closed kepada peserta; room B tetap terbuka. Coba pula saat A bermain.
3. Uji koneksi gagal/retry dan dua tab host. Retry klik yang sama mempertahankan kode; request
   baru hanya menyisakan room terbaru. Hasil match yang sudah selesai tetap dapat dibuka lewat
   URL lama sampai retensi berakhir.

## Known Issue dan Release Decision

| Severity | Issue / batas bukti | Owner / keputusan |
|---|---|---|
| P2 | Acceptance browser production, event lintas deployment dan beban multiroom belum dijalankan | Release Owner: jalankan tiga skenario sesudah redeploy |
| P2 existing | Budget/kapasitas free tier belum terukur; penghapusan cap bukan hasil benchmark kuota | Engineering/Release Owner: lanjutkan pengukuran Usage existing |
| P3 existing | Build memberi pemberitahuan AWS SDK tentang dukungan Node 20 untuk rilis setelah Januari 2027 | Engineering Owner: rencanakan Node >=22 terpisah; build lulus |

Tidak ada kegagalan lokal yang belum terselesaikan. Kode siap untuk redeploy/acceptance; tidak
ada perubahan flag, paket provider, atau data production selama implementasi.
