# UAT Mini Games dan Kotoba Clash

Status: **Implementasi C-E tersedia dan developer checks lokal PASS; UAT game browser/Hobby NOT RUN**.
Probe awal dijalankan 16 Oktober 2026; integrasi dan pemeriksaan lokal pada **17 Oktober 2026**.
Migration B terkonfirmasi applied lewat status/metadata Supabase read-only. Integrasi
C-E tidak menambah migration. Lihat [laporan C-E](kotoba-clash-phase-c-e.md) untuk scope dan bukti.
Budget masih BLOCKED: snapshot Usage agregat user belum menjadi delta biaya workload produk.
Seluruh baris B-D adalah penerimaan browser/produk final kecuali diberi batas lokal secara eksplisit;
PASS repository/unit bukan acceptance flow browser atau user.

Rujukan: [modul hub](../module/mini-games.md), [modul game](../module/kotoba-clash.md),
[plan](../plan/mini-games-kotoba-clash.md), dan [checklist umum](manual-test-checklist.md).
Laporan dan artefak bukti fase A: [kotoba-clash-phase-a.md](kotoba-clash-phase-a.md).

## Identitas Eksekusi Probe A

| Field | Nilai yang harus dicatat saat pengujian |
|---|---|
| Commit dan fase | Fase A; working tree berbasis `36bf225`, hash source pada laporan |
| Environment / URL / plan provider | Dua preview Vercel Hobby sin1, Fluid aktif; preview dihapus setelah uji |
| Tanggal dan tester | 16 Oktober 2026, engineering melalui runner otomatis; bukan acceptance user |
| Browser dan viewport | Runner Node/ws; pengujian browser/mobile game NOT RUN |
| Versi Node / Next / adapter WebSocket | Client 20.19.6, server 24.x, Next 16.3.5, @vercel/functions 3.10.1, ws 8.22.0 |
| Flag dan batas room/pemain/spectator | Probe off secara default, preview override berexpiry; 20 identitas, 24 lease/run |
| Data, akun, dan guest uji | Hanya `p00`-`p19`; tidak ada akun, guest produk, soal, atau nickname nyata |
| Migration/seed dan pembersihan | Not required; 0 key kedua run, preview dihapus, bypass/secret sementara dibersihkan |

Gunakan `PASS`, `FAIL`, `BLOCKED`, atau `NOT RUN` pada kolom hasil; lampirkan bukti yang sudah
disanitasi. Satu skenario lulus pada localhost tidak membuktikan lulus pada Vercel Hobby.

## A. Bukti Infrastruktur Sebelum Implementasi Lengkap

| ID | Skenario | Expected result | Hasil / bukti |
|---|---|---|---|
| A01 | Handshake pada Vercel Hobby, Fluid Compute aktif | Koneksi nyata terbentuk dengan adapter/versi yang tercatat | PASS; dua preview, versi/config pada laporan A |
| A02 | 20 koneksi selama 15-20 menit | Cutoff 300 detik dipulihkan, identitas/state tidak menjadi baru | PASS; 960 detik, 40 cutoff alami + 20 disconnect simulasi, snapshot 20 identitas konsisten |
| A03 | Pengirim dan penerima berada pada instance berbeda | Redis Pub/Sub meneruskan event lintas instance; metode pembuktiannya dicatat | PASS; 25.177 delivery dengan UUID source/receiver berbeda, dua deployment |
| A04 | Hentikan instance/drop koneksi dan reconnect bersamaan | Backoff+jitter, auth ulang, subscribe, snapshot, dan revision konsisten | PASS fixture; SIGKILL/restart Node lokal dan cutoff Vercel. Crash lokal dapat menunggu lease lama; bukan SLA produk |
| A05 | Publish hilang/duplikat atau subscriber terlambat | Sync mengembalikan state authoritative tanpa mengandalkan replay Pub/Sub | PASS injeksi; 1.800 mutasi akhir konsisten. Gangguan jaringan Upstash nyata tidak diinjeksi |
| A06 | Probe tidak sah dan Origin asing | Ditolak; tidak bisa membaca event atau membuat koneksi tanpa batas | PASS; 8 guard HTTP preview, default-off 404 lokal, expiry/production unit test, limit lease lokal mengembalikan 429 |
| A07 | Ukur kuota dan latency | CPU/memory-hours/transfer/invocation/Redis terukur; baseline app dipisahkan | BLOCKED, bukti parsial; latency/payload serta snapshot Usage Vercel 30 hari tersedia. Memory-hours, Redis bulanan, dan delta probe/baseline belum terukur; query API tetap 402 |
| A08 | Hapus/nonaktifkan probe dan data uji | Tidak ada endpoint beban terbuka atau key/room uji tertinggal | PASS; 0 key kedua run, dua preview dihapus, bypass dicabut, env project/production tetap |

Snapshot Usage 30 hari pada tabel ini adalah transkripsi screenshot user, bukan pengukuran
sesudah probe yang berpasangan dengan baseline sebelum probe. Bukti dan batas interpretasi ada
di [laporan fase A](kotoba-clash-phase-a.md#snapshot-usage-dari-user).

| Metrik fase A | Sebelum probe | Hasil probe / snapshot tersedia | Delta / asumsi / bukti |
|---|---|---|---|
| Durasi dan peak koneksi | 0 koneksi probe | 960 detik, peak 20 | 60 reconnect berhasil, 20 identitas tetap |
| Active CPU | Belum diukur | Usage 30 hari: 1 jam 8 menit / 4 jam | Sisa 2 jam 52 menit; delta probe belum terukur, API 402 |
| Provisioned memory-hours | Belum diukur | Tidak ditampilkan pada screenshot | BLOCKED: perlu angka Usage GB-hours; Functions Storage bukan memory-hours |
| Function Invocations | Belum diukur | Usage 30 hari: 170K / 1M | Sisa sekitar 830K; delta probe belum terukur |
| Fast Origin / Data Transfer | Belum diukur | Usage 30 hari: 1,42 / 10 GB dan 3,58 / 100 GB | Sisa 8,58 / 96,42 GB; payload runner 5.649.416 byte bukan transfer billing |
| Command Redis | Counter aktif 12.667 | Counter akhir 9.029 | Counter INFO tidak monoton; tidak dibuat delta/billing estimate |
| ACK latency dan reconnect | Tidak ada | ACK p50/p95/max 38/57/11.131 ms | Reconnect cloud p50/p95/max 736/1.437/1.537 ms; batas metric retry lokal pada laporan |
| Batas room/spectator yang direkomendasikan | Belum ditetapkan | Belum ditetapkan | Menunggu fase A |

## B. Katalog, Identitas, dan Lobby

Implementasi C-E kini tersedia. Developer checks repository/PostgreSQL dan Lua Redis nyata lulus,
termasuk concurrency admission, guest resume, config/ready, proyeksi privat, hasil/rematch,
export offline dan cleanup. Lima tes socket loopback memakai auth/persistence/Redis yang dimock.
Catalogue/landing saja diuji visual di browser localhost (desktop 1280x900, mobile 390x844).
Flow room/runner di browser HTTPS dan endpoint produk Hobby belum dijalankan.

| Eksekusi C-E | Bukti |
|---|---|
| Source/environment | Working tree integrasi setelah fondasi B; loopback PostgreSQL 17.11/Redis disposable |
| Gate engineering | PASS, 638 tes /47 file, lint/typecheck/build |
| Data | Fixture checker sendiri, bukan akun/soal production; dibersihkan setelah uji |
| Runtime control | Tidak diubah di production; drain lintas deployment masih NOT RUN |
| Rincian/evidence | [Laporan C-E](kotoba-clash-phase-c-e.md) dan JSON/screenshot tertaut |

| ID | Skenario | Expected result | Hasil / bukti |
|---|---|---|---|
| B01 | Buka Mini Games dan kartu Kotoba Clash sebagai guest | Katalog/landing publik; deskripsi, 2-20 pemain, dan CTA benar | PASS lokal; visual desktop/mobile, screenshot pada laporan C-E; cloud NOT RUN |
| B02 | Flag hub/game off, termasuk saat socket sudah terbuka | Nav/route/action/socket mengikuti flag; command lama tidak lolos | NOT RUN penuh; smoke production lokal flag off PASS (4 halaman/socket 404, home/sitemap tanpa link); drain cloud belum |
| B03 | Katalog tanpa game aktif; mobile dan keyboard | Empty state jujur, navigasi/fokus/form dapat dipakai | NOT RUN |
| B04 | Host akun membuat room dan membagikan link | Kode unik; URL sesuai environment; guest tidak dapat membuat room | NOT RUN |
| B05 | Guest join, refresh, tab kedua, dan nickname duplikat | Identitas/slot tidak ganda; nama tervalidasi; credential tidak terungkap | NOT RUN |
| B06 | Kode invalid/closed/expired, kapasitas penuh, join bersamaan | Pesan jelas; batas atomik tidak terlewati; tidak ada room enumeration bebas | NOT RUN |
| B07 | Parent/child checkbox pada level dengan stok berbeda | Select-all/indeterminate benar; anak kosong tidak ikut terpilih | NOT RUN |
| B08 | Pilih 5/10/15/20 dan ubah stok sebelum Start | Soal unik cukup; server menolak konfigurasi stale tanpa partial match | NOT RUN |
| B09 | Ready lalu host mengubah konfigurasi | Seluruh ready reset pada revision baru; stale Ready/Start ditolak | NOT RUN |
| B10 | Start ganda, join bersamaan Start, kurang dari 2 pemain | Tepat satu match; roster konsisten; minimum pemain dijaga | NOT RUN |
| B11 | Ganti member/room ID, cookie, atau host command | Tidak ada impersonation, cross-room subscribe, atau perubahan oleh non-host | NOT RUN |
| B12 | Logout/revoke akun dengan socket aktif | Revalidasi sesuai kontrak; host command setelah revocation ditolak | NOT RUN |

## C. Soal, Deadline, dan Skor

| ID | Skenario | Expected result | Hasil / bukti |
|---|---|---|---|
| C01 | Sampling lintas subkategori dan soal berbagi bacaan | Soal unik, konteks lengkap, urutan sama, tidak bergantung audio | NOT RUN |
| C02 | Ubah konten sumber saat match berjalan | Snapshot dan grading pertandingan tidak berubah | NOT RUN |
| C03 | Jawaban sebelum mulai, sebelum deadline, tepat deadline, sesudahnya | Hanya interval awal inklusif/akhir eksklusif diterima menurut clock DB | NOT RUN |
| C04 | Ubah jam browser dan kirim timestamp palsu | Countdown dapat dikoreksi; penerimaan/poin tidak mengikuti jam client | NOT RUN |
| C05 | Pemain pertama menjawab, pemain lain masih mengerjakan | Pemain lain tetap dapat submit sampai deadline; pilihan lawan privat | NOT RUN |
| C06 | Semua menjawab lebih awal | Reveal tetap menunggu deadline; tidak membuka kunci lebih cepat | NOT RUN |
| C07 | ACK hilang, retry identik, retry berbeda, dan submit multi-tab | Satu answer/poin; ACK konsisten; jawaban pertama tidak tertimpa | NOT RUN |
| C08 | Kirim ronde/pilihan asing atau submit sebagai spectator | Ditolak tanpa kunci atau mutasi hasil | NOT RUN |
| C09 | Benar cepat/lambat, streak 1/2/3/6+, salah dan kosong | Rumus v1, cap streak, pembulatan, dan reset sesuai modul | NOT RUN |
| C10 | Finalisasi bersamaan/berulang dan score tie | Tidak ada nilai ganda; tie-break dan posisi bersama konsisten | NOT RUN |
| C11 | Reveal dan explanation kosong | Kunci hanya setelah cutoff; fallback jujur; otomatis lanjut | NOT RUN |
| C12 | Pertandingan 5, 10, 15, dan 20 soal | Seluruh ronde selesai, podium/statistik sesuai ledger dan URL match | NOT RUN |

## D. Recovery, Privasi, dan Operasional

| ID | Skenario | Expected result | Hasil / bukti |
|---|---|---|---|
| D01 | Inspeksi RSC, event, snapshot, ACK, error, cache, dan export sebelum reveal | Tidak ada kunci, explanation, isCorrect, furigana pengerjaan, atau skor aktif | NOT RUN |
| D02 | Identitas baru masuk saat bermain; pemain lama reconnect | Baru menjadi spectator; roster lama dipulihkan, tidak menambah slot | NOT RUN |
| D03 | Host keluar; semua offline lalu kembali setelah beberapa fase/akhir | Schedule dipulihkan; jawaban/skor tidak direset; tanpa host transfer otomatis | NOT RUN |
| D04 | Socket cutoff 5 menit, event hilang/berurutan salah, dan deploy ulang | Revision/snapshot memulihkan fase tanpa soal atau poin ganda | NOT RUN |
| D05 | Rematch dengan pemain/spectator dari match sebelumnya | Kode tetap; match ID/ready/roster baru; hasil lama tetap benar | NOT RUN |
| D06 | Redis/DB unavailable atau publish gagal setelah commit | Error dapat ditindaklanjuti; fail-closed auth; ledger tidak rusak dan dapat disync | NOT RUN |
| D07 | Limit global, spam join/answer, idle, TTL, dan pertandingan dokkai panjang | Admission dibatasi; TTL tidak memotong match; tidak ada write heartbeat per detik | NOT RUN |
| D08 | Cleanup/expiry lalu akses room/hasil | Retensi dan masa credential ditegakkan walau cron belum berjalan | NOT RUN |
| D09 | Export dan anonimisasi akun yang pernah bermain | Linkage/nickname/avatar personal tertangani; hasil lawan tidak rusak atau bocor | NOT RUN |
| D10 | Room/hasil dan preview undangan di crawler | `noindex`, tidak masuk sitemap, preview tidak membawa identitas/soal privat | NOT RUN |
| D11 | Periksa log/error pada seluruh flow | Tidak ada credential, kode room, nickname, pilihan, kunci, atau PII | NOT RUN |
| D12 | Main di desktop dan mobile, reduced motion, reconnect UI | Soal terbaca, status bukan warna saja, pilihan/timer dapat diakses | NOT RUN |

## Gate Akhir

- [x] `npm run verify` lulus; integrasi C-E 638 tes / 47 file, lint/typecheck/build lulus.
- [x] Migration/Prisma tervalidasi; fondasi B direplay/diuji lokal; applied pada Supabase dikonfirmasi lewat status/metadata read-only, tanpa write data.
- [ ] Skenario wajib lulus di environment yang relevan, termasuk bukti Hobby dan 20 koneksi.
- [ ] Kuota, limit rilis, retensi, dan known issue mempunyai angka/status/owner yang nyata.
- [ ] UAT user tercatat terpisah dari pemeriksaan developer.
- [x] Data dan credential uji dibersihkan; status modul diperbarui sesuai hasil.

Keputusan rilis: **belum diaktifkan; gate budget fase A BLOCKED**. Kode produk belum dideploy oleh pekerjaan integrasi ini. Pemilik verifikasi: Engineering Owner untuk bukti teknis,
user/Release Owner untuk acceptance dan aktivasi sesuai kebijakan project.
