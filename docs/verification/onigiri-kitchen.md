# Verifikasi Onigiri Kitchen

Pembaruan **19 Oktober 2026 (Asia/Jakarta)**. Target lokal:
`http://localhost:3100/mini-games/onigiri-kitchen`, solo tanpa login.
Laporan ini menggantikan hasil versi shift tiga menit; versi sekarang tidak memiliki batas sesi.

## Hasil otomatis

- `npm run verify`: lint tanpa warning, TypeScript strict, **63 file / 786 pengujian**,
  dan build produksi lulus. Route Onigiri Kitchen tercantum dalam build.
- Fokus feature: **3 file / 36 pengujian** lulus.
- Regenerasi **44 SVG** menghasilkan checksum byte-for-byte yang sama.
- `git diff --check`: lulus.

Skenario otomatis meliputi:

1. Proyeksi isometrik dan semua pasangan rute dapur, counter, pengambilan, tong, pintu,
   kursi dan meja pada ekspansi 0/1/2. Segmen rute disampling untuk collision;
   furniture lingkaran juga diperiksa secara analitis agar rute tidak memotong sisi meja.
2. Gerak keyboard, tujuan tidak valid, persiapan/pembatalan, menu yang tidak tertimpa,
   serta pelayanan yang memberi uang, combo dan pengenalan kosakata.
3. Salah menu → berjalan ke tong → memasak ulang → melayani. Penalti satu kali per menu,
   saldo ¥0/¥10/¥20 tidak negatif, nampan kosong dan fase ready/paused tidak mengenakan penalti.
4. Simulasi masih aktif setelah **360 detik**, terus menerima pelanggan dan memberi penghasilan.
5. Jeda membekukan seluruh state dan rute. Mencapai counter menghentikan simulasi pada
   substep yang sama, tanpa pelanggan/pelayan terus berjalan selama panel terbuka.
6. Upgrade mempercepat masak/gerak dan menambah kesabaran; saldo dibebankan sesuai level.
   Dana kurang dan level maksimal ditolak tanpa pembayaran atau perubahan total penjualan.
7. Teras membuka meja keempat/kelima; karakter yang berdiri di lokasi meja baru dipindah
   ke lantai dan rute diperbarui. Aktor tetap di luar furniture sesudah pembelian.
8. Pesanan dua menu/VIP memberi penjualan per menu, tetapi pelanggan/combo hanya dihitung
   sekali saat seluruh menu lengkap. Harga dasar VIP dikalikan 1,5.
9. Pelayan berjalan mengambil dan mengantar menu yang cocok, menghasilkan progres layanan.
   Jika chef lebih dulu melayani, makanan pelayan kembali ke antrean tanpa pembayaran ganda.
   Menu tanpa pelanggan cocok menunggu; kapasitas meja dan syarat rekrut dipatuhi.
   Dua pelayan mempunyai titik istirahat terpisah dari posisi serah terima chef.
10. Quest hanya bisa diklaim saat aktif dan selesai, satu kali. Variasi menu dihitung per
    jenis; hadiah tidak masuk total penjualan. Setelah 15 quest awal, kontrak berulang
    mengganti menu/target tim-VIP dan memakai baseline baru.
11. Snapshot/restore mempertahankan saldo, upgrade, quest, nampan serta makanan pelayan
    yang sedang diantar. Simulasi tetap berhenti di pembuka. Data rusak, versi salah,
    saldo negatif, menu tak dikenal, level berlebih dan quest duplikat ditolak.

## Uji browser lokal

Browser in-app, layar penuh desktop **1470×920**, HP **390×844** dan **320×740**.

| Skenario | Hasil |
|---|---|
| Mulai dan layani tiga jenis menu | PASS — chef berjalan/memasak; pelanggan dan combo bertambah; Trio rasa selesai |
| Klaim quest pertama, trio rasa dan combo | PASS — hadiah masuk uang kedai; daftar bergeser ke quest berikutnya |
| Kelola kedai dari scene | PASS — chef mendekati counter, lalu seluruh game dijeda |
| Beli Dapur gesit dan rekrut Aya | PASS — level menjadi 1, uang berkurang sesuai harga, Aya muncul |
| Klaim quest upgrade/rekrut lalu buka teras | PASS — saldo ¥529 → ¥29 setelah ekspansi ¥500; meja keempat dan dek terlihat |
| Taruh onigiri untuk Aya | PASS — nampan kosong, Aya mengantar, layanan 3 → 4 dan uang ¥29 → ¥134 |
| Menu campuran/VIP | PASS — gelembung menampilkan dua menu, indikator 0/2 dan tanda VIP |
| Ocha dari kontrol HP → meja pelayan | PASS — Aya mengantar satu bagian pesanan; saldo ¥134 → ¥216 dan sisa menu diperbarui |
| Beli Suasana hangat pada HP | PASS — saldo ¥216 → ¥16 dan level dekorasi menjadi 1 |
| Refresh setelah membawa Ocha | PASS — Lanjutkan kedai memuat ¥16, empat meja, upgrade, quest dan Ocha di nampan |
| Tong setelah refresh | PASS — Ocha dibuang; ¥16 → ¥0, tidak negatif, nampan siap memasak lagi |
| Memasak/menitipkan setelah membuang | PASS — Onigiri diantar ke pesanan lain; uang menjadi ¥110 dan quest Onigiri 2/4 → 3/4 |
| Layar penuh / Perkecil | PASS — game memenuhi layar, kontrol keluar terlihat dan kembali ke halaman |
| Pengelola dan panduan dalam fullscreen | PASS — dialog tetap terlihat, dapat ditutup dan permainan dilanjutkan |
| Jurnal HP | PASS — ringkas saat tertutup, tiga tujuan dan progres tampil saat dibuka |
| Panel HP | PASS — judul/tombol tutup di atas navigasi, daftar dapat digulir ke tombol kembali |
| Lebar minimum | PASS — pada 320 px, lebar dokumen 320 px; ketiga tombol menu berada di dalam arena |
| Pengantaran sesudah pembaruan posisi pelayan | PASS — Aya menyelesaikan pelanggan kelima, uang ¥110 → ¥243, quest Onigiri 4/4 siap diklaim |
| Console sesi setelah refresh akhir | PASS — tidak ada warning/error baru pada sesi akhir |

Pengujian memakai interaksi UI dengan uang yang diperoleh dari pesanan dan hadiah quest.
Tidak mengubah hidden state game untuk mengklaim hadiah atau membeli upgrade.
Saat development, Fast Refresh sempat mempertahankan state pelayan sebelum field titik
istirahat ditambahkan dan mencatat error. Refresh penuh memuat ulang bentuk state terbaru;
alur akhir pengantaran, quest, jeda dan keluar fullscreen kembali berjalan. Setelah update
ini, refresh tab sebelum melanjutkan permainan.
Sisa kesabaran pelanggan tetap berjalan saat membaca jurnal; panel pengelola/panduan menjeda.

Bukti terbaru:

- [Scene desktop, teras, pelayan dan quest](evidence/2026-10-19-onigiri-growth-desktop.jpg).
- [Scene HP](evidence/2026-10-19-onigiri-growth-mobile.jpg).
- [Panel upgrade HP](evidence/2026-10-19-onigiri-upgrades-mobile.jpg).

Bukti versi sebelumnya tetap tersedia untuk riwayat mekanik tong:
[desktop](evidence/2026-10-19-onigiri-trash-desktop.jpg) dan
[HP](evidence/2026-10-19-onigiri-trash-mobile.jpg).

## Handoff dan batas verifikasi

Migration: **not required**; tidak ada perubahan schema, data server, seed atau layanan game.
Progres baru memakai localStorage v2 terpisah dari preferensi v1. Detail kontrak dan harga
ada di [modul](../module/onigiri-kitchen.md).

Skenario acceptance berikut berasal dari [checklist umum](manual-test-checklist.md),
dengan tambahan mekanik feature:

- Buka katalog → game tanpa login; flag game/hub mati menyembunyikan route/link.
- Periksa mobile sekitar 390 px dan desktop minimal 1280 px; jalankan WASD/panah/E,
  tap ketiga menu, quest, tong, pengelola, jeda dan layar penuh.
- Beli upgrade, rekrut dua pelayan dan buka kedua tingkat teras; antar pesanan campuran/VIP.
- Refresh saat membawa makanan atau saat pelayan mengantar; progres/antrean tidak hilang
  diam-diam. Periksa tab lain dan storage diblokir, serta pahami bahwa save lokal tidak
  memiliki sinkronisasi atau penyelesaian konflik lintas tab.
- Periksa Console dan kegagalan pemuatan artwork memberi tombol coba lagi.

| Keterbatasan / known issue | Severity | Owner | Keputusan |
|---|---|---|---|
| UAT perangkat fisik iOS/Android, fullscreen native lintas browser dan performa perangkat rendah belum dijalankan | P2 — gap validasi | Pengelola produk | Perlu UAT sebelum aktivasi publik |
| Progres hanya di browser; dua tab tidak disinkronkan | Batas desain | Pengelola produk | Diterima untuk solo lokal |
| Build memberi pemberitahuan existing AWS SDK: rilis Januari 2027 memerlukan Node ≥22; runtime lokal Node 20 | P3 — existing | Engineering Owner | Tidak memblokir gate saat ini |

Release decision: siap ditinjau dan dimainkan pada preview lokal. Production tetap default-off;
belum deployment atau persetujuan UAT perangkat fisik.
