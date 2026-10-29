# Onigiri Kitchen

Pembaruan **19 Oktober 2026 (Asia/Jakarta)**. Game solo kafe 2.5D di
`/mini-games/onigiri-kitchen`, dengan sudut pandang isometrik dan artwork SVG orisinal.
Tujuan utamanya hiburan; kosakata Jepang dikenalkan lewat tiga menu dan pesanan pelanggan.

## Status dan aktivasi

Playable lokal: chef bergerak, memasak, pelanggan, combo, tong sampah, quest, upgrade,
perluasan teras, pelayan, jeda, layar penuh dan penyimpanan progres. Tidak ada batas waktu
sesi atau layar hasil yang mengakhiri permainan.

- `FEATURES_ONIGIRI_KITCHEN` dan `FEATURES_MINI_GAMES` harus sama-sama aktif.
- Guard layout, katalog, sitemap dan robots mengikuti `FEATURES.onigiriKitchen`.
- Kode/contoh env tetap default-off; preview lokal aktif. Belum deployment production.
- Solo tanpa login; tidak ada room, leaderboard publik, skor akun atau sinkronisasi perangkat.
- Tidak menambah dependency, API, database, seed, server game atau WebSocket.

## Memasak dan melayani

Mulai dengan tiga meja. Pelanggan pertama langsung duduk dan memesan onigiri, kemudian
pelanggan baru berjalan masuk melalui pintu. Permainan berjalan terus selama tidak dijeda.
Kesabaran pelanggan tetap terbatas: bar kesabaran adalah batas pesanan, bukan waktu bermain.

| Menu | Pengenalan ringan | Harga dasar | Waktu persiapan awal |
|---|---|---:|---:|
| Onigiri | おにぎり — nasi kepal | ¥100 | 1,2 detik |
| Tamago | たまご — telur | ¥120 | 1,6 detik |
| Ocha | おちゃ — teh | ¥80 | 0,8 detik |

Ketuk dapur untuk berjalan dan memasak, lalu ketuk gelembung pesanan atau meja yang sesuai.
Chef membawa satu menu. Berjalan saat memasak membatalkan persiapan; menu yang sudah dibawa
tidak ditimpa dapur lain. Salah menu tetap di nampan dan tidak memberi uang.

**Tong sampah di kanan dapur** mengosongkan nampan setelah chef mendekat. Penalti per menu
**¥20**, minimum uang **¥0**. Nampan kosong tidak dikenai penalti dan combo tidak terputus.
Tong merupakan obstacle fisik; label, ilustrasi tong, atau E di dekatnya dapat digunakan.

Setiap pelanggan keempat memesan dua menu; setiap pelanggan kelima adalah VIP dan juga
memesan dua menu. VIP membayar 1,5 kali harga dasar. Semua menu harus diantar sebelum
pelanggan dihitung terlayani, combo bertambah, atau quest layanan mendapat progres.
Menu yang sudah diantar tetap menghasilkan penjualan walaupun pesanan belum lengkap.

Tip mempertimbangkan kesabaran, combo dan dekorasi, lalu dibagi sesuai jumlah menu pesanan.
Pelanggan yang kehabisan kesabaran pergi dan memutus combo; uang yang telah diperoleh tetap ada.
**Uang kedai** adalah saldo belanja. **Total penjualan** dicatat terpisah agar membeli upgrade,
membuang makanan, dan menerima hadiah tidak mengubah pencapaian quest pendapatan.

## Quest dalam scene

Catatan kedai berada di HUD arena. Ketuk untuk membuka tiga quest aktif beserta tujuan,
progres dan hadiah. Di HP, versi tertutup menampilkan tujuan/progres singkat atau jumlah
hadiah yang siap diklaim. Hadiah hanya diberikan lewat tombol Klaim dan tidak bisa diambil dua kali.

Ada 15 quest pengantar: layanan pertama, tiga jenis menu, combo, upgrade dapur, onigiri,
rekrut Aya, layanan cepat, pesanan pelayan, buka teras, VIP, dekorasi, tamago, pelanggan
langganan, meja kelima dan penjualan ¥3.000. Setelah seluruhnya diklaim, kontrak berulang
mengganti menu spesial dan target VIP/tim, dengan baseline progres baru setiap bab.

## Upgrade dan tim

Ketuk **Kelola kedai** di meja pengelola. Chef berjalan ke counter, lalu panel dibuka dan
seluruh simulasi dijeda. Pada HP, shortcut tas belanja tetap berada di HUD arena; shortcut
ini juga mengarahkan chef ke counter. Pembelian memeriksa saldo dan level maksimal.

| Peningkatan | Harga tiap level | Efek |
|---|---|---|
| Dapur gesit | ¥220 / ¥480 / ¥850 | Durasi memasak menjadi 75% / 60% / 45% dari awal |
| Langkah ringan | ¥180 / ¥400 | Kecepatan chef +20% / +40% |
| Suasana hangat | ¥200 / ¥450 | Kesabaran +15 / +30 detik, bonus tip +¥5 / +¥10 dan lampu terlihat |
| Tim pelayan | ¥350 / ¥650 | Rekrut Aya, lalu Ren |
| Perluas teras | ¥500 / ¥800 | Buka teras + meja keempat, lalu meja kelima |

Perluasan menambah area yang dapat dilalui dan meja sungguhan, serta langsung mengundang
pelanggan ke meja baru. Penambahan meja memperbarui rute dan memindahkan aktor ke lantai
terdekat bila posisi sebelumnya menjadi terhalang furnitur.

Setelah merekrut pelayan, masak lalu ketuk **Meja pelayan** untuk meletakkan menu.
Kapasitas tiga menu, termasuk makanan yang sedang diantar. Pelayan berjalan mengambil
menu yang cocok, memprioritaskan pelanggan dengan kesabaran paling rendah, mengantar,
lalu kembali. Pelayan tidak memasak. Dua pelayan tidak memesan target pelanggan yang sama.
Jika pelanggan pergi atau chef lebih dulu mengantar, makanan dikembalikan ke antrean,
sehingga tidak hilang atau menghasilkan pembayaran ganda. Menu tanpa pelanggan cocok
menunggu di meja pengambilan.

## Kontrol dan lifecycle

- Klik/tap lantai: berjalan; klik objek/label: berjalan lalu berinteraksi.
- WASD/panah: gerak relatif layar; E/Space saat fokus canvas: interaksi terdekat.
- Escape/tombol jeda: jeda atau lanjut; perpindahan aplikasi/tab otomatis menjeda.
- Panduan dan pengelola memakai Dialog existing; input karakter tidak mengambil tombol dialog.
- Tombol **Layar penuh** selalu terlihat, termasuk di HP. Fullscreen API digunakan bila tersedia,
  dengan fallback memenuhi viewport. Tombol Perkecil atau Escape keluar dari fallback.
  Portal dialog berada di root game agar panel tetap tersedia dalam fullscreen native.
- HP: kamera mengikuti chef; tiga tombol menu tetap tersedia di arena, dan label tong,
  pengambilan serta pesanan dijaga di batas horizontal layar.
- Reduced motion meniadakan gerak dekoratif; gerak esensial tetap aktif. DPR canvas dibatasi 2.

## Progres lokal

`nihongofy:onigiri-kitchen:progress:v2` menyimpan uang, penjualan, statistik quest, upgrade,
quest yang diklaim, kosakata, menu di nampan dan seluruh antrean makanan, termasuk yang
sedang dibawa pelayan. Autosave setiap dua detik saat bermain, saat jeda/pagehide,
pembelian, dan klaim. Refresh menampilkan **Lanjutkan kedai**; pelanggan dan rute diinisialisasi
ulang, combo kembali nol, dan simulasi tidak berjalan saat pembuka atau secara offline.

Preferensi suara dan rekor legacy tetap memakai `nihongofy:onigiri-kitchen:v1`.
Kedua store divalidasi terpisah dengan Zod. JSON rusak diabaikan; storage yang diblokir
menampilkan pemberitahuan dan permainan tetap berfungsi di halaman. Progres ini bukan
skor kompetisi terverifikasi atau bagian dari akun. Audio memakai nada Web Audio setelah
interaksi pemain.

## Struktur dan aset

```text
src/features/onigiri-kitchen/
  domain.ts / domain.test.ts        simulasi, navigasi, pesanan dan pelayan
  progression.ts / .test.ts         quest dan transaksi upgrade
  save.ts / save.test.ts            validasi dan snapshot progres
  scene.ts                         renderer, kamera, depth sort dan SVG
  use-kitchen.ts                   loop, lifecycle, input, storage dan audio
  panels.tsx                       jurnal quest dan pengelola
  game.tsx / kitchen.css            game, panduan dan layout responsif
src/app/(public)/mini-games/onigiri-kitchen/
  layout.tsx / page.tsx             guard feature dan metadata
public/mini-games/onigiri-kitchen/
  *.svg / README.md                44 SVG orisinal, termasuk teras dan dua pelayan
scripts/generate-onigiri-assets.mjs
```

Navigasi memakai grid 0,25 unit dengan smoothing garis pandang dan pemeriksaan lingkaran
furnitur. Substep maksimal 50 ms menjaga collision dan simulasi konsisten. Snapshot React
dipublikasikan sekitar 10 kali/detik. Regenerasi: `node scripts/generate-onigiri-assets.mjs`.
Tidak memakai gambar game referensi atau artwork pihak ketiga.

## Migration dan rilis

- Status: **not required**; migration: **tidak ada**.
- Alasan/object: perubahan simulasi browser, UI dan SVG; tidak ada perubahan schema atau data server.
- Data existing: preferensi v1 dipertahankan; progres v2 memakai key baru. Tidak ada backfill/seed.
- Risiko operasi: penyimpanan tetap lokal per browser; penghapusan data browser menghapus progres.
- Validasi: quality gate dan skenario browser di [laporan verifikasi](../verification/onigiri-kitchen.md).
- Refresh setelah update: refresh tab; tidak memerlukan flush cache atau restart layanan game.
- Owner: Engineering Owner untuk kode; pengelola produk untuk UAT perangkat fisik dan aktivasi.
