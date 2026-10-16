# Kotoba Clash - Verifikasi Fase A

Tanggal: **16 Oktober 2026 (Asia/Jakarta)**. Owner: Engineering Owner.
Status: **bukti transport PASS; gate A BLOCKED pada pengukuran budget**.
Keputusan rilis: **belum diaktifkan; fase B belum dimulai**.

Rujukan: [rencana](../plan/mini-games-kotoba-clash.md),
[modul](../module/kotoba-clash.md), dan [UAT](mini-games-kotoba-clash-uat.md).

## Lingkup Implementasi

Probe operator tersedia pada `GET /api/internal/kotoba-clash-probe`; `DELETE` membersihkan
data uji. Tidak ada halaman Mini Games, room permainan, bank soal, atau data pemain nyata.
Probe tidak menggunakan session akun dan bukan endpoint guest untuk produk.

- Default mati. Selalu ditolak pada `VERCEL_ENV=production`.
- Secret khusus minimal 32 karakter pada header Authorization; tidak lewat query string.
- Origin harus sama persis dengan konfigurasi. Header kosong dan Origin asing ditolak.
- Expiry wajib, maksimal dua jam ke depan; handshake dan command lama ditolak setelah expiry.
- Hanya 20 identitas sintetis `p00` sampai `p19`. Batas lease 24 koneksi per run,
  80 handshake/menit, 4 command/detik/koneksi, payload 2 KiB, buffer kirim 16 KiB.
- Redis memakai namespace `<REDIS_PREFIX>:kotoba-probe-v1:<run-id>`, terpisah dari auth.
  Snapshot uji TTL satu jam, lease 60 detik dengan refresh 20 detik, bucket handshake 60 detik.
- Subscribe Upstash REST melalui SSE hanya antara server dan Redis. Client ke server tetap
  WebSocket. Satu subscriber dipakai bersama oleh socket pada proses yang sama.
- Lua menyimpan revision dan sequence tiap identitas secara atomik. Publish dilakukan setelah
  commit. Retry sequence yang sama mengembalikan duplicate ACK tanpa mutasi/poin tambahan.
- Snapshot dipulihkan saat reconnect dan sync periodik; Pub/Sub tidak dianggap event log.
- `omit`, `duplicate`, `publish-failure`, dan `disconnect` adalah **injeksi simulasi** khusus probe.
  Simulasi publish failure tidak membuktikan gangguan jaringan Upstash yang sesungguhnya.

Snapshot Redis hanya fixture operasional fase A. Source of truth game tetap PostgreSQL sesuai
rancangan fase B; probe tidak meluluskan kontrak persistence game, auth guest, atau scoring.

## Versi dan Bukti Konfigurasi

| Komponen | Hasil pemeriksaan |
|---|---|
| Next.js / React | 16.3.5 / 19.2.4 |
| Node lokal / deployment | 20.19.6 / 24.x |
| Vercel Functions SDK | 3.10.1, export `upgradeWebSocket` terverifikasi dari package terpasang |
| WebSocket library / types | ws 8.22.0 / @types/ws 8.18.2 |
| Bootstrap Node lokal | tsx 4.23.15, dev dependency; bind loopback saja |
| Upstash SDK | 1.38.3; subscribe memakai fetch streaming REST |
| Vercel plan / Fluid | Hobby / aktif, diverifikasi lewat API project dan team |
| Region function | sin1, sesuai resource config project |
| CLI pengiriman / build cloud | 48.11.0 / 64.0.2 |
| Panduan Next terpasang | Route Handlers dibaca sebelum implementasi |
| API Vercel | Dokumentasi `upgradeWebSocket`, SDK >=3.10.0, ws wajib |
| Development Next lokal | `next dev` tidak mendukung upgrade ini; gunakan Vercel CLI >=54.14.2 |

Referensi vendor yang diperiksa:

- [WebSocket Vercel](https://vercel.com/docs/functions/websockets)
- [API upgrade dan development](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#upgradewebsocket)
- [Limit Functions](https://vercel.com/docs/functions/limitations)
- [Upstash REST subscribe/publish](https://upstash.com/docs/redis/features/restapi#subscribe--publish-commands)

## Cara Mengulang Pengujian

1. Jalankan `npm ci` dan `npm run verify`. Jangan menambahkan secret ke file tracked.
2. Buat konfigurasi preview dengan `KOTOBA_PROBE_ENABLED=true`, secret acak minimal 32 karakter,
   Origin operator persis, run ID acak 8-64 karakter alfanumerik/hyphen, dan expiry ISO 8601
   sekitar satu jam ke depan. Pakai namespace/run ID yang sama untuk kedua deployment uji.
3. Deploy dua preview dari source yang sama pada project Hobby yang sama, tanpa promote ke
   production. Pastikan kedua build `READY`. Konfigurasi probe diberikan sebagai override
   deployment, tidak mengubah env default project. Biarkan Deployment Protection aktif.
4. Siapkan `.env.kotoba-probe.local` yang diabaikan Git, berisi `KOTOBA_PROBE_URLS` (dua URL
   dipisahkan koma), `KOTOBA_PROBE_SECRET`, `KOTOBA_PROBE_ORIGIN`, dan
   `KOTOBA_PROBE_SECONDS=960`. Jika preview dilindungi, isi credential automation preview pada
   `VERCEL_AUTOMATION_BYPASS_SECRET`; cabut credential sementara setelah pengujian.
5. Jalankan `npm run probe:kotoba-clash`. Runner menguji guard, membuka 20 koneksi yang terbagi
   ke dua deployment, mengirim sequence setiap sekitar 10 detik, sync setiap tiga iterasi,
   menginjeksi fault, dan reconnect dengan backoff/jitter. JSON report default tersimpan di
   `.vercel/kotoba-probe-report.json`; report tidak berisi credential.
6. Bandingkan snapshot akhir semua koneksi dengan ledger ACK; catat UUID proses pengirim dan
   penerima berbeda sebagai bukti lintas instance. Hitung reconnect/cutoff dan periksa log.
7. Runner menutup koneksi dan memanggil DELETE saat selesai/gagal. Periksa key state/lease/bucket
   milik run ini sudah hilang. Nonaktifkan/hapus preview uji, cabut bypass sementara, dan hapus
   file secret lokal. Jangan melakukan wildcard delete pada Redis bersama.

Untuk uji dua proses Node, isi juga kelima env server probe dari `.env.example` pada file env
lokal, dengan **run ID baru** yang tidak digunakan oleh probe cloud yang masih aktif. Jalankan
`npm run probe:kotoba-clash:server -- 4101` dan ulangi di terminal lain dengan port 4102.
Runner memakai URL `http://127.0.0.1:4101,http://127.0.0.1:4102`. Kedua proses mengimpor runtime,
store, dan guard yang sama dengan adapter Vercel. Hentikan hanya proses uji yang dibuat sendiri,
lalu restart pada port/run ID yang sama; jangan menghapus state saat proses dimatikan.

Eksekusi developer menggunakan `SIGKILL` pada proses port 4101 sekitar detik 17 runner,
restart lima detik kemudian, dan melanjutkan workload sampai 150 detik. Bootstrap ini membuktikan
fixture portable serta recovery proses lokal, belum merupakan konfigurasi deployment VPS produk.

Pengiriman CLI lama dengan archive sempat memasukkan 2,7 GB bahan authoring; pengiriman tersebut
dihentikan sebelum deployment dibuat. Dua preview uji dikirim dari salinan source tracked + file
probe baru (57 MiB sebelum kompresi, archive 19,7 MB), tanpa audio/gambar mentah maupun env lokal.
`.vercelignore` mengecualikan direktori offline `data` dan cache lokal untuk pengiriman berikutnya.

## Hasil Otomatis dan Deployment

| Pemeriksaan | Hasil |
|---|---|
| Lint, TypeScript, existing tests, build lokal | PASS; `npm run verify`, 602 tes / 41 file |
| Guard disabled/production/expiry/Origin/secret | PASS unit test; 8/8 pemeriksaan HTTP preview mendapat 401/403 yang sesuai |
| 20 peserta / 960 detik | PASS; 20 identitas tetap sama, semua snapshot akhir sesuai ledger ACK |
| Pub/Sub lintas instance | PASS; 25.177 delivery lintas UUID instance, 10 UUID proses teramati pada dua deployment |
| Reconnect setelah cutoff provider | PASS; 40 cutoff alami (dua siklus per peserta), ditambah 20 disconnect simulasi |
| Event hilang/duplikat dan failure setelah commit | PASS injeksi; satu duplicate ACK, satu warning publish failure, tidak ada regresi state |
| Penghentian proses Node lokal | PASS; SIGKILL/restart, 20 identitas pulih, snapshot akhir sesuai 266 ACK |
| Penghentian paksa proses Vercel sesungguhnya | NOT RUN; yang teramati di Vercel adalah cutoff alami, bukan SIGKILL |
| Cleanup key, deployment, credential | PASS; 0 key tersisa pada kedua run, dua preview dihapus, bypass dicabut, env project tidak ditambah |

HTTP lokal dengan probe off menghasilkan 404. `/api/account/export` dan path di bawah probe
yang tidak persis cocok tetap menghasilkan redirect login (307); pengecualian Proxy tidak membuka
prefix API lain. `/mini-games` masih 404. Production project tetap pada deployment sebelumnya.

### Pengukuran Transport

| Metrik | Vercel Hobby | Dua proses Node lokal |
|---|---|---|
| Waktu UTC | 15:56:11-16:12:18, 16 Oktober 2026 | 16:02:57-16:05:30, tanggal sama |
| Workload / peak peserta siap | 960 detik / 20 | 150 detik / 20 |
| Perubahan state / final revision | 1.800 / 1.820 (termasuk 20 join) | 266 / 286 |
| Identitas akhir | 20; sequence 90 untuk semuanya | 20; sequence sesuai ACK tiap peserta |
| Welcome / reconnect berhasil | 80 / 60 | 44 / 24 |
| ACK p50 / p95 / maksimum | 38 / 57 / 11.131 ms | 33 / 113 / 194 ms |
| Reconnect p50 / p95 / maksimum | 736 / 1.437 / 1.537 ms | Tidak dipakai sebagai downtime penuh; lihat batas pengukuran |
| Pub/Sub delivery lintas instance | 25.177 | 2.317 |
| Inconsistency yang tercatat | 0 | 0 |
| Payload client kirim / terima | 68.259 / 5.581.157 byte | 10.206 / 775.934 byte |

Koneksi yang berakhir alami pada cloud tercatat hidup sekitar **312-314 detik** dari sisi runner,
sesuai batas 300 detik ditambah perilaku penutupan runtime/jaringan yang teramati. Jangan
mengandalkan grace tersebut sebagai kontrak durasi. Sepuluh UUID adalah jumlah proses berbeda
yang terlihat selama uji, bukan jumlah instance serentak atau ukuran memory yang ditagihkan.
ACK maksimum 11,1 detik tetap menjadi tail latency yang harus dipertimbangkan pada UI/deadline.

Pada SIGKILL lokal, lease lama masih hidup sampai TTL (maksimal 60 detik). Empat reconnect dapat
memakai sisa kapasitas; enam lainnya sempat menerima total 24 response 429 sampai lease lama
kedaluwarsa. Sampel periodik menunjukkan 14 peserta siap pada detik 53 dan 20 pada detik 116.
Field `reconnectDelayMs` runner mengukur sejak **attempt terakhir** ditutup sehingga, bila ada
retry gagal, tidak mengukur downtime penuh. Angka cloud dapat dipakai karena tidak ada attempt
gagal tambahan pada report tersebut; angka lokal tidak boleh dilabeli downtime pemulihan.

Ini batas admission probe saat process loss. Mekanisme resume/takeover berdasarkan identitas
terverifikasi perlu dirancang pada fondasi domain sebelum game publik; jangan menyalin lease
UUID-per-socket probe sebagai admission final. Probe belum meluluskan pengalaman koneksi mobile,
Wi-Fi buruk, atau deadline jawaban game.

### Artefak Bukti

Implementasi masih working tree, berbasis commit `36bf225`. Hash runtime probe dan adapter Vercel
yang diuji tercatat dalam artefak berikut; bootstrap lokal menggunakan runtime bersama tersebut.
Report hanya memakai
identitas sintetis, UUID proses, dan URL deployment uji; tidak ada credential/pemain nyata.

- [Hobby: report runner](evidence/2026-10-16-kotoba-clash-hobby.json)
- [Node: report SIGKILL/restart](evidence/2026-10-16-kotoba-clash-process-loss.json)
- [Hash source](evidence/2026-10-16-kotoba-clash-source.json)
- [Key dan counter saat aktif](evidence/2026-10-16-kotoba-clash-redis-active.json)
- [Cleanup dan konfigurasi akhir](evidence/2026-10-16-kotoba-clash-cleanup.json)

Deployment preview yang dipakai: `dpl_DqT9bSNPkSTxAjiXr3pS4BJwZiyP` dan
`dpl_4K2nnMhWtk4qyB3rr69JHjbBnTvr`. Keduanya sudah dihapus setelah uji; bukan link permainan.

## Budget dan Batas Bukti

Query `vercel.function_invocation.function_cpu_time_ms` melalui Observability API ditolak dengan
HTTP **402 `payment_required`**, alasan **Observability Plus memerlukan Pro/Enterprise**.
Tidak ada upgrade/layanan berbayar diaktifkan. Schema metrik dapat dibaca, tetapi itu tidak
memberi nilai pemakaian. CPU, memory-hours, invocation, transfer provider, dan baseline website
belum boleh diklaim terukur hanya berdasarkan jumlah frame/ACK pada runner.

Redis `INFO` dapat dibaca, tetapi counter yang diterima tidak monoton: pemeriksaan preview aktif
memberi `total_commands_processed=12667`, sedangkan pemeriksaan akhir memberi `9029`.
Tidak dibuat delta atau estimasi billing dari angka tersebut. Counter bukan ledger pemakaian
bulanan terisolasi; baseline/traffic website dan uji proses lokal juga harus dipisahkan.

Total payload client pada uji cloud adalah **5.649.416 byte**. Asumsi satu workload identik per
hari, 30 hari, menghasilkan sekitar **169,48 MB payload/bulan**. Ini hanya perkalian traffic
fixture, tidak termasuk handshake, framing, TLS, Redis, halaman website, atau baseline; bukan
angka Fast Data Transfer/Origin Transfer yang ditagihkan dan bukan jaminan kuota gratis.

Rekomendasi room serentak/global, spectator, dan kapasitas bulanan masih **belum ditetapkan**.
Target 2-20 pemain tetap target produk; hasil satu room sintetis tidak menjamin seluruh beban
website selalu masuk free tier.

## Migration dan Operasional

- Status: **not required**; migration tidak ada.
- Object PostgreSQL/Supabase dan data existing: tidak berubah; tidak ada seed/backfill.
- Data uji: Redis namespace probe saja; DELETE terarah dan TTL menjadi mekanisme cleanup.
- Refresh: deployment preview memuat dependency/env baru; default probe tetap off.
- Warning existing: AWS SDK memberi peringatan dukungan Node 20 lokal berakhir pada Januari 2027;
  deployment memakai Node 24. Warning tidak menggagalkan build.
- P1, owner Engineering Owner: metrik CPU/memory-hours/invocation/transfer provider, command Redis
  bulanan, dan baseline website belum tersedia. Query API 402 dan dashboard browser belum login.
  **Gate A belum ditutup; fase B menunggu pengukuran budget**, tanpa mengaktifkan layanan berbayar.
- P1 untuk rilis game, owner Engineering Owner: takeover identitas saat crash harus menghindari
  penantian lease penuh. Pembuktian lokal tidak menyelesaikan desain guest/roster produksi.
- P2 untuk UX, owner Engineering Owner: tail ACK 11,1 detik dan jaringan mobile belum dievaluasi
  dengan kontrak deadline game. Tidak ada claim kesiapan produk dari probe ini.
