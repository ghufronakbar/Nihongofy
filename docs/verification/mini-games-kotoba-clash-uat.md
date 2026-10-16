# UAT Mini Games dan Kotoba Clash

Status awal: **NOT RUN**. Checklist disiapkan pada **16 Oktober 2026 (Asia/Jakarta)**.
Dokumen ini tidak menyatakan bahwa WebSocket atau permainan sudah bekerja pada deployment.

Rujukan: [modul hub](../module/mini-games.md), [modul game](../module/kotoba-clash.md),
[plan](../plan/mini-games-kotoba-clash.md), dan [checklist umum](manual-test-checklist.md).

## Identitas Eksekusi

| Field | Nilai yang harus dicatat saat pengujian |
|---|---|
| Commit dan fase | Belum dijalankan |
| Environment / URL / plan provider | Belum dijalankan |
| Tanggal dan tester | Belum dijalankan |
| Browser dan viewport | Belum dijalankan |
| Versi Node / Next / adapter WebSocket | Belum dijalankan |
| Flag dan batas room/pemain/spectator | Belum dijalankan |
| Data, akun, dan guest uji | Belum dijalankan; jangan mencatat credential |
| Migration/seed dan pembersihan | Tidak ada pada perubahan dokumentasi |

Gunakan `PASS`, `FAIL`, `BLOCKED`, atau `NOT RUN` pada kolom hasil; lampirkan bukti yang sudah
disanitasi. Satu skenario lulus pada localhost tidak membuktikan lulus pada Vercel Hobby.

## A. Bukti Infrastruktur Sebelum Implementasi Lengkap

| ID | Skenario | Expected result | Hasil / bukti |
|---|---|---|---|
| A01 | Handshake pada Vercel Hobby, Fluid Compute aktif | Koneksi nyata terbentuk dengan adapter/versi yang tercatat | NOT RUN |
| A02 | 20 koneksi selama 15-20 menit | Cutoff 300 detik dipulihkan, identitas/state tidak menjadi baru | NOT RUN |
| A03 | Pengirim dan penerima berada pada instance berbeda | Redis Pub/Sub meneruskan event lintas instance; metode pembuktiannya dicatat | NOT RUN |
| A04 | Hentikan instance/drop koneksi dan reconnect bersamaan | Backoff+jitter, auth ulang, subscribe, snapshot, dan revision konsisten | NOT RUN |
| A05 | Publish hilang/duplikat atau subscriber terlambat | Sync mengembalikan state authoritative tanpa mengandalkan replay Pub/Sub | NOT RUN |
| A06 | Probe tidak sah dan Origin asing | Ditolak; tidak bisa membaca event atau membuat koneksi tanpa batas | NOT RUN |
| A07 | Ukur kuota dan latency | CPU/memory-hours/transfer/invocation/Redis terukur; baseline app dipisahkan | NOT RUN |
| A08 | Hapus/nonaktifkan probe dan data uji | Tidak ada endpoint beban terbuka atau key/room uji tertinggal | NOT RUN |

| Metrik fase A | Sebelum | Sesudah | Delta / asumsi / bukti |
|---|---|---|---|
| Durasi dan peak koneksi | Belum diukur | Belum diukur | NOT RUN |
| Active CPU | Belum diukur | Belum diukur | NOT RUN |
| Provisioned memory-hours | Belum diukur | Belum diukur | NOT RUN |
| Invocation dan transfer | Belum diukur | Belum diukur | NOT RUN |
| Command Redis | Belum diukur | Belum diukur | NOT RUN |
| ACK latency dan reconnect | Belum diukur | Belum diukur | NOT RUN |
| Batas room/spectator yang direkomendasikan | Belum ditetapkan | Belum ditetapkan | Menunggu fase A |

## B. Katalog, Identitas, dan Lobby

| ID | Skenario | Expected result | Hasil / bukti |
|---|---|---|---|
| B01 | Buka Mini Games dan kartu Kotoba Clash sebagai guest | Katalog/landing publik; deskripsi, 2-20 pemain, dan CTA benar | NOT RUN |
| B02 | Flag hub/game off, termasuk saat socket sudah terbuka | Nav/route/action/socket mengikuti flag; command lama tidak lolos | NOT RUN |
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

- [ ] `npm run verify` lulus; output dicatat tanpa secret.
- [ ] Migration/Prisma tervalidasi bila ada perubahan schema; urutan deploy dicatat.
- [ ] Skenario wajib lulus di environment yang relevan, termasuk bukti Hobby dan 20 koneksi.
- [ ] Kuota, limit rilis, retensi, dan known issue mempunyai angka/status/owner yang nyata.
- [ ] UAT user tercatat terpisah dari pemeriksaan developer.
- [ ] Data dan credential uji dibersihkan; status modul diperbarui sesuai hasil.

Keputusan rilis awal: **belum dinilai**. Pemilik verifikasi: Engineering Owner untuk bukti teknis,
user/Release Owner untuk acceptance dan aktivasi sesuai kebijakan project.
