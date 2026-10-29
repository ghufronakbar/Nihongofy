# Audit data dan rancangan Shiritori

Tanggal: **19 Oktober 2026 (Asia/Jakarta)**.

Status: **riset dan usulan implementasi**, belum menjadi aturan produk yang disepakati.
Pemeriksaan memakai data dan kode lokal. Tidak mengubah database, deployment, maupun game
existing. Nama/slug usulan: **Shiritori** / `shiritori`.

## Kesimpulan

Data dictionary existing **bisa digunakan sebagai sumber Shiritori**. JMdict menyediakan
bacaan, kelas kata, arti, batas pasangan ejaan–bacaan–sense, dan sebagian tag bidang.
Kelayakan untuk memilih tema belum bisa ditentukan hanya dari tag tersebut: **83% entri
yang mempunyai sense kata benda tidak memiliki tag bidang pada seluruh sense kata bendanya**.
Perlu indeks khusus game dan daftar kategori terkurasi sebelum tema ditawarkan ke room master.

Sistem room, guest, ready, WebSocket, reconnect, hasil dan rematch dapat mengikuti pola mini
game existing. Aturan Shiritori memakai giliran bergantian dan rantai kata bersama.

## 1. Data yang diperiksa

Sumber: `assets/dictionary/manifest.json` dan seluruh shard `entries/` serta `terms/`.
Versi: `eng-3.6.2+20261012-f1-9a04fc1d0fac`, tanggal sumber **12 Oktober 2026**.

| Ukuran | Hasil lokal |
| --- | ---: |
| Entri JMdict | 218.898 |
| Term indeks ejaan/bacaan | 465.832 |
| Shard | 512 |
| Ukuran gzip total | 17.209.096 byte |
| Entri dengan minimal satu sense `n` | 190.331 |
| Entri tersebut dengan minimal satu form bertanda common | 18.896 |
| Entri kata benda tanpa tag bidang pada sense kata bendanya | 157.982 |

Satu entri dapat memiliki beberapa ejaan, bacaan dan arti. Angka entri, term, dan bacaan
unik bukan jumlah kata siap bermain. Penanda common pada satu form juga belum membuktikan
semua bacaan/arti dalam entri itu cocok untuk pemula.

`npm run dictionary:check` **lulus**: checksum/ukuran seluruh shard, schema, ID dan referensi,
restriction pasangan, jumlah data, serta contoh lookup existing diperiksa. Ini memverifikasi
integritas kamus lokal, belum menguji engine Shiritori atau performa hosting.

### Cakupan tag bidang

Angka berikut menghitung entri dengan sense kata benda yang mempunyai tag bersangkutan.
Ini **kandidat pemetaan**, bukan ukuran kategori game final; kategori dapat bertumpang tindih.

| Tag | Makna sumber | Entri |
| --- | --- | ---: |
| `food` | Food, cooking | 1.830 |
| `sports` | Sports | 768 |
| `music` | Music | 802 |
| `comp` | Computing | 10.593 |
| `zool` | Zoology | 91 |

Contoh yang diperiksa langsung:

- `寿司 / すし` mempunyai tag `food`.
- `林檎 / りんご` dan `バナナ` tidak mempunyai tag `food`.
- `猫 / ねこ`, `犬 / いぬ`, `ゴリラ`, `パンダ`, serta `ライオン` tidak mempunyai tag `zool`.
- `珈琲 / コーヒー` tidak mempunyai tag `food`.
- `zool` juga berisi istilah zoologi, sehingga tidak setara dengan daftar nama hewan.

Karena itu, menerima tema Makanan hanya jika `field` berisi `food` akan menolak sejumlah
jawaban umum yang seharusnya cocok. Tema harus merujuk **arti tertentu**; misalnya `りんご`
memiliki arti buah dan pohon, dan `ねこ` memiliki lebih dari satu arti.

### Uji filter dan sambungan awal

Eksplorasi read-only memakai sense `n`, restriction bacaan/ejaan yang sesuai, panjang 2–20
kana, normalisasi katakana ke hiragana, dan pengecualian sejumlah label penggunaan/form.
Label yang dikecualikan mencakup archaic, obsolete, vulgar, sensitive, derogatory, X-rated,
slang, serta bacaan irregular/obsolete/rare tertentu. Ini **filter eksplorasi**, belum whitelist
konten final atau jaminan semua kata aman dan wajar untuk game.

Filter itu menghasilkan 173.432 bacaan unik; subset common menurut pasangan form yang
diperiksa memuat 16.731 bacaan. Dari subset common, 14.127 tidak berakhir `ん`.
Jumlah tersebut menunjukkan sumber mencukupi, tetapi tidak menentukan ukuran rilis game.

Uji sambungan menghitung apakah kana akhir suatu bacaan mempunyai minimal satu kata
lanjutan non-`ん` dalam pool yang sama, sebelum ada kata terpakai. Untuk uji ini saja,
`ー` akhir memakai kana sebelumnya, kana kecil akhir dibesarkan, dan dakuten tetap berbeda.

- Pool bertag `food`: 2.168 bacaan unik, 1.891 non-`ん`, tanpa jalan buntu satu langkah
  pada kondisi awal.
- Pool bertag `sports`: 715 bacaan non-`ん`, dengan 3 jalan buntu awal.
- Pool bertag `music`: 779 bacaan non-`ん`, dengan 20 jalan buntu awal.
- Pool bertag `zool`: 82 bacaan non-`ん`, dengan 40 jalan buntu awal.
- Subset common umum juga mempunyai jalan buntu `はなぢ` dengan aturan dakuten ketat.

Uji ini tidak membuktikan panjang rantai: setelah sejumlah kata dipakai, pilihan dapat habis.
Setiap kategori final perlu diuji ulang untuk keterhubungan, panjang rantai, variasi kata
pembuka dan skenario beberapa pemain. Pool kecil tidak boleh diloloskan hanya karena jumlah
katanya melewati batas minimum.

### Perbandingan dengan Kana Word Race

`src/kana-race-data/dictionary.v1.json` memuat 5.623 tebakan dan 94 target terkurasi dari
flashcard. Kategori hanya tersedia pada target tersebut: antara lain Makanan 6, Minuman 3,
Olahraga 4, dan Tempat 13. Kamus ini juga membatasi panjang 3–7 kana dan bukan daftar khusus
kata benda. Kata dua kana seperti `すし` diperlukan dalam Shiritori.

Rekomendasi: gunakan **JMdict sebagai sumber utama**, ambil pola compiler/versioning kamus
Kana Word Race sebagai referensi. Whitelist 94 target tidak cukup sebagai kamus Shiritori.

## 2. Pengolahan data yang diusulkan

1. Kompilasi indeks game secara offline dari snapshot JMdict yang dipin. Simpan versi sumber,
   ID entri, bacaan normal, form tampilan dan sense yang diterima.
2. Pilih kata benda mandiri dengan form/sense yang layak. Jangan menerima otomatis seluruh
   noun, singkatan, istilah teknis, frasa panjang atau bentuk kuno dari kamus penuh.
3. Tambahkan kurasi kategori berdasarkan ID entri + bacaan + sense. Tag JMdict membantu
   kandidat awal; keputusan kategori tidak memakai pencarian substring gloss semata.
4. Simpan indeks exact reading dan indeks kana awal per kategori. Pertahankan kata berakhir
   `ん` sebagai kata yang dikenali untuk aturan kalah; pisahkan dari kandidat sambungan.
5. Validasi kategori dan kata pembuka, lalu tinjau konten sebelum menerbitkan release immutable.
   Match mengikat versi kamus dan aturan agar pembaruan tidak mengubah pertandingan aktif.

Usulan tema awal: **Umum**, **Makanan & Minuman**, dan **Hewan**. Semuanya memerlukan kurasi;
khusus Hewan harus membangun daftar nama hewan, bukan sekadar memetakan `zool`.
Kategori berikutnya dapat menyusul setelah cakupan dan sambungannya memadai.

Tidak perlu mengunduh kamus, memakai AI, atau memanggil API dictionary eksternal pada setiap
giliran. Data game tetap server-side dan di-cache berdasarkan versi. Reader/index dasar dapat
dimanfaatkan, tetapi action popup bukan validator game: action itu mempunyai deinflection,
pemotongan hasil dan aturan fitur yang ditujukan untuk pencarian materi belajar.

Arti existing dari JMdict berbahasa **Inggris**, bukan Indonesia, dan tidak memberikan level
JLPT. Pertahankan atribusi EDRDG dan lisensi **CC BY-SA 4.0** pada data turunan, terpisah dari
kode aplikasi. Referensi lisensi ada di `assets/dictionary/NOTICE.md`.

## 3. Alur web yang direkomendasikan

| Halaman/fase | Pengalaman pemain |
| --- | --- |
| Katalog | Kartu Shiritori di Mini Games, menuju `/mini-games/shiritori`. |
| Landing | Aturan singkat, Buat Room untuk akun, serta join melalui kode/link untuk akun atau guest. |
| Lobby | Room master memilih satu tema dari daftar tersedia; timer dan aturan terlihat bagi semua. Ready mengikuti revision pengaturan. |
| Mulai | Bekukan roster/config/kamus, acak urutan giliran, countdown, lalu tampilkan kata pembuka yang mempunyai sambungan. |
| Bermain | Tampilkan tema, kata terakhir, kana yang harus dipakai, pemain aktif, timer, nyawa dan riwayat rantai bersama. |
| Input | Hanya pemain aktif dapat mengirim. Dukung hiragana, katakana, serta romaji yang dikomposisikan menjadi kana memakai pola WanaKana existing. |
| Kata diterima | Tambahkan kata, bacaan, arti dan pengirim ke rantai; lanjutkan ke pemain berikutnya. |
| Hasil | Pemenang/peringkat, statistik kata valid, penyebab kehilangan nyawa, review kosakata dan rematch pada room yang sama. |

Pola host login, guest, kode undangan, ready, reconnect, hasil dan rematch mengikuti mini game
existing. Batas 2–20 pemain dapat mengikuti admission existing, dengan rekomendasi UX 2–8
untuk mengurangi waktu menunggu giliran. Kapasitas operasional tetap perlu diukur.

Input v1 sebaiknya **kana/romaji**. Dukungan kanji langsung memerlukan pemilihan bacaan untuk
entri ambigu; jangan diam-diam memilih bacaan yang menguntungkan pemain.

## 4. Usulan aturan v1

Nilai awal yang direkomendasikan: **30 detik per giliran, 3 nyawa, batas pertandingan 10 menit**.
Room master memilih tema; pilihan timer 15/30/45 detik dapat ditambahkan. Nyawa dan batas
pertandingan dapat dibuat tetap dahulu agar konfigurasi sederhana.

- Kata harus tersedia pada release game, termasuk kata benda dan sense dalam tema pilihan.
- Bacaan harus dimulai dengan kana yang diminta dan belum pernah digunakan dalam match.
  Variasi ejaan serta homofon dengan bacaan normal yang sama dihitung sebagai pengulangan.
- Kata tidak dikenal, salah tema, salah awalan atau pengulangan memberi pesan yang spesifik.
  Pemain dapat memperbaiki selama timer tetap berjalan.
- Kata valid yang berakhir `ん`, atau waktu habis, mengurangi satu nyawa dan melewatkan giliran.
  Pemeriksaan kata/tema/awalan/pengulangan mendahului penalti `ん`.
- Kata berakhir `ん` tidak menjadi acuan sambungan. Gunakan kata terakhir yang sah sebagai
  acuan giliran berikutnya; kata gagal tidak memperpanjang rantai.
- Nyawa habis: pemain tidak mendapat giliran lagi, tetapi tetap dapat melihat permainan.
- Jika server memastikan tidak ada sambungan legal tersisa dalam kategori, mulai rantai baru
  tanpa penalti. Riwayat kata terpakai tetap berlaku; jika pool tidak memungkinkan restart,
  akhiri match dengan alasan stok kata habis dan tampilkan hasil.
- Satu pemain tersisa menang. Jika batas waktu/stok tercapai, urutkan sisa nyawa lalu jumlah
  kata valid; hasil sama mendapat peringkat sama. Jangan memotong giliran aktif saat batas
  durasi tercapai: selesaikan giliran itu, lalu tutup match.

Aturan kana harus ditampilkan sebelum mulai dan dipakai konsisten oleh compiler serta server.
Usulan v1: katakana disetarakan dengan hiragana; `ー` akhir memakai kana sebelumnya
(`コーヒー` → `ひ`); kana kecil akhir dibesarkan (`きんぎょ` → `よ`); dakuten tetap berbeda
(`か` ≠ `が`). Ini pilihan aturan game, bukan klaim bahwa semua variasi Shiritori memakai
konvensi yang sama. Pelonggaran dakuten dapat dipertimbangkan setelah uji kategori.

Contoh tema Umum: `りんご` → `ごりら` → `らっぱ` → `ぱんだ`.
Contoh tema Hewan: `ねこ` → `こあら` → `らくだ`. Contoh ini harus masuk whitelist final
sebelum dipakai sebagai demonstrasi produk.

## 5. Integrasi teknis dan verifikasi

- Feature terpisah `src/features/shiritori/`, route/registry Mini Games dan flag usulan
  `FEATURES_SHIRITORI` yang mewajibkan Mini Games. Ketersediaan data game tidak bergantung
  pada toggle popup `FEATURES_DICTIONARY`.
- Ikuti pola Server Action untuk lobby dan command service/domain yang sama untuk WebSocket.
  Pakai infrastruktur existing dengan identitas/namespace game sendiri.
- Server menentukan giliran, deadline, validasi, nyawa dan hasil. Simpan perubahan secara
  atomik; request ID, turn ID dan revision mencegah retry ganda serta jawaban giliran lama.
- Database menjadi sumber kebenaran state dan hasil. Redis mendukung admission, rate limit,
  presence dan notifikasi perubahan; countdown dihitung client dari waktu server.
- Reconnect memulihkan state dan sisa waktu; disconnect tidak memperpanjang giliran atau
  menjeda match. State mengejar deadline saat recovery, termasuk bila semua socket terputus.
- Rilis room baru perlu integrasi cleanup, retensi, account export/anonimisasi serta
  pengujian akses guest sebagaimana kedua game existing.

Urutan implementasi: **kurasi dan compiler kategori → engine giliran/aturan → room dan
realtime → UI mobile/desktop → hasil/rematch → verifikasi dan aktivasi terpisah**.

Verifikasi utama mencakup variasi kana, restriction sense, tema ambigu, homofon, `ん`, stok
sambungan habis, race submit/deadline, duplicate request, giliran stale, reconnect,
pergantian pengaturan/ready dan kondisi semua pemain offline. Uji UI mencakup IME Enter,
romaji pending, keyboard mobile, fokus serta feedback di dekat input.

Referensi existing: [Mini Games](../module/mini-games.md),
[Kana Word Race](../module/kana-word-race.md),
[Dictionary](../module/dictionary.md), dan [operasi dictionary](../operations/dictionary.md).
