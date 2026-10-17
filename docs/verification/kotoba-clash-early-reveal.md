# Kotoba Clash - Reveal Otomatis Setelah Semua Menjawab

Tanggal: **17 Oktober 2026 (Asia/Jakarta)**. Owner: Engineering Owner.
Status: **implementasi dan gate lokal PASS; migration/deploy/acceptance production v2 belum dilakukan**.

User menyetujui langsung melewati sisa waktu soal ketika seluruh pemain sudah menjawab, tanpa
pilihan host. Jawaban pertama tetap final. Rujukan: [plan bagian 11](../plan/mini-games-kotoba-clash.md),
[modul](../module/kotoba-clash.md), [UAT](mini-games-kotoba-clash-uat.md), dan
[ledger migration](../operations/migrations.md).

## Perilaku dan Implementasi

- Match baru menulis `rulesVersion=2`. Semua pemain dalam roster beku harus memiliki jawaban
  yang diterima server; spectator tidak dihitung. Pemain offline tetap dihitung. Bila masih ada
  yang belum menjawab, waktu maksimal per tipe tetap berlaku.
- Jawaban terakhir memendekkan ronde, menggeser semua ronde berikutnya serta akhir/retensi match
  dalam transaksi yang sama. Lock akun -> room -> match existing menjaga serialisasi dengan
  submit/finalisasi lain. Retry identik mengembalikan ACK lama sebelum menghitung quorum ulang.
- Waktu database tetap otoritatif. Cutoff eksklusif baru adalah
  `min(deadlineLama, acceptedAtTerakhir + 1ms)` agar semua jawaban sah termasuk jawaban terakhir.
  Reveal berjalan 8 detik penuh, lalu otomatis ke soal berikutnya, termasuk reveal soal terakhir.
- Bonus kecepatan dihitung terhadap durasi maksimal kategori versi aturan, bukan interval yang
  dipendekkan. Rekonstruksi live, agregat final dan export akun memakai `ledgerRoundOf` yang sama.
  Rumus streak/ranking tidak berubah. Kunci/penjelasan/poin aktif tetap tertutup sebelum reveal.
- Jadwal baru disimpan di PostgreSQL. Invalidation/boundary timer/reconnect existing membaca
  jadwal tersebut; tidak ada protokol, host toggle, env, dependensi, tabel atau kolom baru.
  UI memperbarui keterangan jawaban terkunci dan kapan poin dibuka.
- Server baru menerima match v1 dan v2. Match v1 tidak dipercepat dan tidak dikonversi; nilai
  historis tetap memakai durasi interval v1. Expiry match v2 mengikuti akhir aktual +7 hari;
  expiry room tetap batas atas sebelumnya untuk menjaga akses hasil lain dalam room.

## Bukti Lokal

Seluruh checker memakai PostgreSQL 17.11 dan Redis loopback disposable. Tidak menjalankan
migration, seed, atau mutasi ke production. Hasil tersanitasi ada pada
[evidence](evidence/2026-10-17-kotoba-clash-early-reveal.json).

| Pemeriksaan | Hasil / batas bukti |
|---|---|
| `npm run verify` | PASS; lint 0 warning, TypeScript strict, 645 tes /48 file, production build |
| `npx prisma validate` | PASS |
| Migration replay/status | PASS; seluruh 43 migration applied pada database disposable; status up to date |
| CHECK/default/security | PASS; CHECK versi 1/2 tervalidasi, versi 3 ditolak; default DB 1; enam tabel RLS, 0 policy/grant Data API |
| `check:kotoba-clash:early-reveal` | PASS; 5 kelompok integrasi dan 5 ronde dengan reveal 8 detik nyata |
| Quorum dan privasi | PASS repository/state; jawaban parsial tidak membuka kunci/poin; spectator ditolak; pemain tanpa jawaban tetap ditunggu |
| Concurrency/retry | PASS; submit terakhir duplikat dan retry host bersamaan hanya menggeser jadwal sekali; pilihan berbeda ditolak |
| Schedule/reconnect | PASS; cutoff +1ms, reveal penuh, kontinuitas ronde/akhir/retensi; instance state baru dan spectator membaca reveal tersimpan |
| Skor dan finalisasi | PASS; speed memakai 30 detik asli; leaderboard/finalisasi/export cocok; reconcile idempotent dan review 5 soal |
| Fallback/legacy | PASS; v2 tanpa jawaban lengkap menunggu deadline; v1 semua menjawab tetap menunggu deadline; submit terlambat ditolak |
| Foundation checker | PASS; 8 kelompok, termasuk clock setelah lock wait, constraint, RLS dan anonimisasi akun |
| Room checker | PASS; 11 kelompok, termasuk privasi sebelum jawaban terakhir, early reveal, rematch/export/cleanup dan Lua Redis nyata |
| Pembersihan | PASS; 0 fixture user/room/match/package tersisa; server PostgreSQL/Redis disposable dihentikan setelah pemeriksaan |
| Browser/WebSocket production v2 | NOT RUN; checker membuktikan repository/state, bukan latency/render lintas deployment |

Tes domain baru juga memeriksa dua jawaban dalam milidetik yang sama, cutoff tepat batas akhir,
reveal penuh dan kesamaan poin dengan ronde tanpa percepatan. Guard answer-key existing tetap
lulus tanpa dilonggarkan. Tidak mengulang seluruh UAT browser UI karena perubahan visual hanya copy.

## Migration dan Urutan Rilis

Migration: `prisma/migrations/20261017141402_kotoba_clash_early_reveal/migration.sql`.
Hanya mengganti CHECK match agar menerima versi 1/2, mempertahankan pemeriksaan waktu/config.
Tidak mengubah row existing atau default database 1. Aplikasi baru menulis versi 2 eksplisit.

1. Selesaikan match aktif dan hindari Start baru selama pergantian deployment.
2. Dari checkout terbaru dengan `DIRECT_URL` database tujuan, jalankan `npx prisma migrate deploy`
   **sebelum redeploy**. Periksa `npx prisma migrate status`. Jalankan saat trafik rendah karena
   DROP/ADD CHECK memerlukan lock tabel singkat; validasi row existing dilakukan terpisah.
3. Redeploy kode baru dan refresh semua tab host/pemain/spectator. Server lama hanya mengenali
   v1; jangan memulai match v2 lewat koneksi deployment lama.
4. Buat match baru dan jalankan acceptance berikut. Tidak perlu reseed, cache reset atau env baru.

Default DB 1 sengaja dipertahankan agar aplikasi lama masih dapat membuat match v1 sesudah
migration diterapkan. Bila rollback kode diperlukan, hentikan Start v2 dan selesaikan/drain
match v2 dahulu; aplikasi lama tidak dapat menangani match v2. Tidak perlu rollback CHECK yang
sudah menerima versi 1/2 atau mengonversi ledger v2 menjadi v1.

Migration dibuat memakai Prisma create-only pada baseline generator disposable, kemudian SQL
disesuaikan untuk CHECK yang tidak direpresentasikan Prisma. Replay seluruh history memakai
`migrate deploy` lulus. Generator terpisah dipakai karena replay shadow lewat `migrate dev`
terbentur migration historis yang menyebut `_prisma_migrations`; isu tersebut tidak diubah.

## Acceptance Sesudah Deploy

1. Host dan satu guest menjawab cepat. Pembahasan harus langsung muncul di kedua layar,
   berjalan sekitar 8 detik, lalu soal baru. Tambahkan spectator: ia tidak menahan perpindahan.
2. Pada soal lain, satu pemain menunggu/tidak menjawab. Timer harus terus berjalan sampai batas
   normal; pemain tersebut masih dapat menjawab sebelum cutoff. Jawaban lawan tetap privat.
3. Refresh sesudah jawaban terkunci dan coba dua tab/retry. Jawaban pertama dan poin harus tetap
   sama; ronde tidak melompat dua kali. Akhiri match dan periksa hasil/rematch.

Ini subset relevan dari [checklist umum](manual-test-checklist.md) dan C05-C12/D01-D05 pada UAT.
User melaporkan uji durasi panjang bersama teman aman sebelum perubahan ini; laporan tersebut
tidak dianggap bukti production untuk early-reveal v2.

## Known Issue dan Release Decision

| Severity | Issue / batas bukti | Owner / keputusan |
|---|---|---|
| P1 jika urutan dilanggar | CHECK lama menolak match v2; server lama tidak mendukung v2 | Release Owner: migration dahulu, redeploy/refresh lalu Start; wajib sebelum rilis v2 |
| P2 | Browser/WebSocket lintas instance production v2 belum diuji | Release Owner: acceptance tiga skenario sesudah deploy |
| P2 existing | Budget free tier dan UAT beban produk lengkap masih terbuka | Engineering/Release Owner: lanjutkan pengukuran sesuai UAT existing; tidak menaikkan limit |
| P3 existing | AWS SDK memberi pemberitahuan dukungan Node 20 berakhir untuk versi baru Januari 2027 | Engineering Owner: rencanakan Node >=22 terpisah; build saat ini lulus |

Tidak ada kegagalan lokal yang belum terselesaikan. Perubahan siap untuk migration/deploy dan
acceptance user; belum dinyatakan PASS pada production v2. Flag/runtime control tidak diubah.
