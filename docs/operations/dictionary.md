# Operasi indeks JMdict

Owner data/kode: **Engineering Owner**. Owner aktivasi, budget, dan rollback deployment:
**Release Owner**. Jadwal pemeriksaan sumber: **minimal bulanan**, menggunakan rilis English
penuh terbaru yang sudah ditinjau. Dokumen ini tidak membuat automation.

## Import awal dan rebuild

Jalankan di checkout/build workspace terpisah dari deployment aktif:

```bash
# Unduh rilis tetap yang URL dan SHA-256-nya tercantum di importer.
npm run dictionary:import

# Rebuild dari arsip lokal yang sudah cocok checksum (tanpa network).
npm run dictionary:build

# Validasi seluruh shard, restriction, referensi, coverage dan contoh lookup.
npm run dictionary:check -- --evidence=docs/verification/evidence/2026-10-18-dictionary.json
npm run verify
```

Input default adalah arsip `jmdict-eng-3.6.2+20261012204142.json.zip` di
`data/sources/dictionary/`. Arsip ini tidak perlu ikut deployment. `dictionary:import` memakai
HTTPS dan memeriksa checksum sebelum menulis sumber; runtime tidak memanggil importer.

Importer memeriksa full-English (`commonOnly=false`, >200.000 entri), schema, ID unik dan batas
posting. Semua shard, hash, NOTICE dan manifest dibangun di staging. Setelah berhasil, direktori
output sebelumnya dipindahkan ke backup, staging dipublikasikan, lalu backup dihapus. Kegagalan
rename publikasi memulihkan backup; kegagalan checksum/schema tidak menyentuh indeks lama.
Ini **bukan** mekanisme hot-swap untuk request yang sedang berjalan: dua rename punya sela,
dan proses yang terhenti mendadak dapat meninggalkan `.previous-*`/`.staging-*` untuk pemulihan.
Karena itu lakukan hanya offline dan distribusikan satu image/deployment lengkap.

## Update bulanan

1. Tinjau [rilis jmdict-simplified](https://github.com/scriptin/jmdict-simplified/releases) dan
   [lisensi EDRDG](https://www.edrdg.org/edrdg/licence.html). Pilih **jmdict-eng penuh**, bukan
   `common-only`. Catat URL immutable, tanggal, converter, dan SHA-256 dari arsip yang ditinjau.
2. Di checkout terpisah, impor dengan parameter eksplisit. Contoh bentuk perintah (isi nilai
   sebenarnya dari rilis yang ditinjau):

   ```bash
   npm run dictionary:import -- --url="$JMDICT_RELEASE_URL" --sha256="$JMDICT_RELEASE_SHA256" --source="$JMDICT_ARCHIVE_PATH"
   ```

   Jangan menggunakan URL berbeda dengan checksum default atau endpoint `latest` saat build.
   `--output` tersedia untuk direktori kamus terpisah; checker/runtime membaca
   `assets/dictionary`, sehingga validasi rilis tetap dilakukan di checkout isolasi dengan lokasi itu.
3. Periksa diff manifest/NOTICE, jumlah entri/term, seluruh 512 shard, restrictions, dan contoh.
   Update pin URL/hash/path importer serta ekspektasi snapshot jumlah entri pada test bila rilis
   berubah. Jika format transformasi berubah, naikkan format/version token (`f1` saat ini), schema,
   reader, dan test bersama-sama. Jangan mengubah isi shard sambil mempertahankan versi cache.
4. Jalankan checker, test dan build; simpan evidence baru, trace packaging, ukuran bundle, dan
   sample lookup. Ukur RSS/cold start/p50/p95 request **pada hosting target** dengan query contoh
   publik. Pisahkan cache client, Next Data Cache, cache shard, dan cold process.
5. Commit/distribusikan manifest, NOTICE, dan semua shard sebagai satu versi kode. Jangan
   mengunggah manifest lebih dulu atau memakai shard dari rilis lain. Next output tracing harus
   menyertakan `assets/dictionary/**/*`; tidak ada arsip sumber atau dataset di static client.
6. Deploy kandidat dengan flag false, lakukan smoke pada preview berflag true dan checklist UAT.
   Release Owner mengaktifkan flag hanya setelah gate disetujui. Perubahan ini tidak menjalankan
   deployment atau mengubah env aktif.

Cache Next dan client memakai versi indeks + bahasa + kueri. Versi baru tidak memakai hasil
versi lama; tidak perlu flush seluruh Redis. Restart/redeploy membuang cache shard proses lama.

## Kegagalan dan rollback

- Bila download, checksum, parse, atau validasi gagal: hentikan publikasi; pakai artefak/deployment
  valid sebelumnya. Jangan menandai kegagalan sebagai kamus kosong.
- Bila proses import mati di antara rename: pulihkan direktori `.previous-*` lengkap pada
  workspace offline atau checkout ulang commit rilis valid. Validasi sebelum membuat deployment.
- Bila lookup produksi gagal atau budget terlampaui: set `FEATURES_DICTIONARY=false`, redeploy,
  dan refresh tab. Action dari tab lama ditolak. Halaman belajar tetap berfungsi.
- Untuk rollback data/kode: redeploy image/commit sebelumnya secara utuh. Jangan menyalin satu
  manifest atau shard ke instance yang masih hidup. Kembalikan flag sesuai keputusan Release Owner.
- Pantau `dictionary.lookup.failed` dan `dictionary.lookup.metrics`. Hindari payload/query/IP mentah
  dalam alert; lakukan diagnosis dengan contoh publik. Limiter butuh Redis existing; tidak fail-open.

## Gate kapasitas

Angka lokal di [evidence](../verification/evidence/2026-10-18-dictionary.json) hanya filesystem,
dekompresi dan proyeksi. Pengukuran tersebut tidak memasukkan network, Redis, Next Data Cache,
upload/deploy function, atau startup hosting. RSS sample meliputi validasi dataset sebelumnya,
alokasi sementara dan GC; batas LRU 16 MiB bukan jaminan RSS sebesar 16 MiB.

Sebelum aktivasi, catat batas dan hasil paket function, cold start, RSS peak di concurrency 1/8,
p50/p95 hit/miss, timeout/error/busy rate dan biaya/cache/command Redis. Sasaran UX awal lookup
normal <1 detik harus dibuktikan di target. Jika packaging/RAM gagal, pertahankan flag false dan
evaluasi object storage existing dengan versi/checksum yang sama. Tidak ada biaya API penyedia
arti JMdict, tetapi kapasitas hosting/Redis tetap berbiaya.
