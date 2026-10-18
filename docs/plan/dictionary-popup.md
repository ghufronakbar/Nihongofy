# Rencana Integrasi Kamus JMdict

Diperbarui: **18 Oktober 2026 (Asia/Jakarta)**.
Status: **implementasi tahap 1–3 tersedia di kode; default-off, UAT perangkat nyata dan budget hosting belum selesai**.
Kondisi aktual: [modul](../module/dictionary.md), [UAT/evidence](../verification/dictionary-popup-uat.md), dan [runbook update](../operations/dictionary.md).
Rujukan: [hasil riset dan uji sumber](../research/dictionary-popup.md),
[aturan proyek](../project-rules.md), dan [renderer Jepang](../module/japanese-content-rendering.md).

## 1. Tujuan dan Keputusan

Pengguna dapat menyeleksi kata Jepang pada materi belajar, lalu membaca kamus tanpa meninggalkan halaman. Bantuan kamus mengikuti konteks belajar: tersedia setelah reveal atau saat membaca referensi, dan tidak ditawarkan saat sedang menjawab soal.

- Sumber tunggal arti popup: **JMdict English penuh**, milik EDRDG, diolah melalui `jmdict-simplified` atau XML resmi bila diperlukan. Distribusi common-only tidak menjadi sumber utama agar cakupan kosakata tidak sengaja dipersempit.
- Pencarian berjalan pada indeks yang dikelola aplikasi. Tidak memakai API Jisho/Jotoba, scraping, atau model AI sebagai fallback arti.
- UI tetap berbahasa Indonesia; isi definisi berbahasa Inggris dan ditandai jelas. Arti/penjelasan Indonesia yang sudah ada pada halaman tetap menjadi konten halaman tersebut.
- Tersedia untuk guest dan pengguna login pada halaman yang memang dapat mereka akses. Kamus tidak menambahkan kewajiban login atau membuka akses materi yang sebelumnya terbatas.
- Data kamus gratis sesuai lisensi. Lookup tidak mempunyai kuota API penyedia kamus; kapasitas dan biaya hosting aplikasi tetap perlu diukur.
- Integrasi melalui area konten eksplisit, bukan listener yang mengaktifkan kamus pada seluruh halaman aplikasi. Tidak ada perubahan otomatis pada semua pemakaian `JapaneseText`.

## 2. Halaman dan Tahap Penerapan

### Tahap 1 — Pembahasan dan Reveal

| Halaman | Area yang mendapat kamus | Syarat aktif |
| --- | --- | --- |
| `/test-package/[id]/questions` | Instruksi, bacaan, teks soal, pilihan, pembahasan, dan transkrip audio yang sedang ditampilkan. | Mode baca tersedia dan flag kamus aktif. |
| `/result/[attemptId]/detail` | Bacaan, soal, pilihan, pembahasan, serta transkrip yang ditampilkan. | Review attempt diizinkan oleh server; attempt telah selesai. |
| `/exercises/[sessionId]` | Soal, bacaan, pilihan yang sudah terkunci, feedback, dan transkrip yang dibuka. | Soal aktif telah mendapat konfirmasi jawaban dari server (`isAnswered`), bukan sekadar sudah memilih opsi. Berlaku pada jalur guest maupun login yang memakai runner tersebut. |
| `/flashcard/deck/[slug]/study` | Kata target, bacaan, contoh, dan catatan materi pada kartu. | `revealed === true`; seluruh kartu tetap tanpa kamus sebelum reveal, termasuk kata pada sisi depan. |
| `/flashcard/try/[slug]` | Area yang sama dengan sesi belajar flashcard. | Setelah reveal, termasuk mode coba guest. |
| `/discussion/question/[questionId]` | Kartu soal beserta bacaan, pilihan, dan pembahasan yang tersedia. | Halaman diskusi dapat dibaca sesuai flag dan akses existing. |
| `/discussion/[commentId]` untuk thread soal | Kartu soal yang ditampilkan pada permalink. | Mengikuti akses halaman. Permalink kata/pola yang berupa redirect mengikuti halaman tujuannya. |
| `/flashcard/discussion/[vocabId]` | Kartu kosakata lengkap, termasuk contoh dan catatan materi. | Halaman detail kata dapat diakses; kartu di sini memang sudah terbuka. |

Transkrip tidak dibuka otomatis oleh kamus. Jika pengguna menutup transkrip yang menjadi sumber seleksi, popup ikut ditutup. Memilih kata pada bacaan yang dipakai bersama beberapa soal tidak mempertahankan popup ketika pengguna berpindah ke soal yang belum dijawab.

### Tahap 2 — Referensi dan Tulisan yang Sedang Dibaca

| Halaman/permukaan | Area yang mendapat kamus | Batas perilaku |
| --- | --- | --- |
| `/bunpou/[key]` | Judul/pola, tabel pembentukan, penjelasan, contoh Jepang, dan pitfalls. | Pencarian leksikal JMdict; pola grammar yang tidak mempunyai entri menampilkan hasil tidak ditemukan. |
| `/bunpou/compare/[key]` | Isi tabel perbandingan, contoh kontras, pilihan beserta catatan yang sudah ditampilkan. | Saat ini semua contoh bersifat referensi terbuka. Bila kemudian ada kuis tertutup, area kuis mengikuti aturan reveal. |
| `/flashcard/deck/[slug]` | Tulisan kata dan bacaan dalam daftar kosakata. | Tidak aktif pada input pencarian, filter, atau tombol pengelolaan kartu. |
| `/article/[slug]` | Kata Jepang dalam isi artikel: paragraf, list, quote, callout, dan contoh. | Header navigasi, action artikel, dan kartu related berada di luar area kamus. Renderer artikel memakai teks biasa, sehingga integrasi tidak boleh bergantung pada `JapaneseText` saja. |
| Catatan privat, komentar, dan balasan pada halaman belajar di atas | Hanya teks yang sudah dirender dan memang dapat dibaca pengguna. Termasuk sheet diskusi yang dibuka dari halaman tersebut. | Composer/edit textarea dikecualikan. Konten tersembunyi, dihapus, atau tidak berhak diakses tetap mengikuti sanitasi/akses existing. |

Komponen komentar juga dipakai komunitas. Penambahan pada komponen bersama harus mengikuti konteks halaman agar fitur tidak otomatis aktif di `/community`, `/post/[id]`, atau profil.

### Tahap 3 — Review Mini Game

| Halaman/permukaan | Area yang mendapat kamus | Syarat aktif |
| --- | --- | --- |
| `/mini-games/kotoba-clash/room/[code]` | Bacaan, soal, pilihan yang sudah terbuka, dan bedah ronde. | Hanya fase `REVEAL`; menjawab lebih awal belum mengaktifkan kamus selama ronde masih berjalan. Berlaku sama untuk pemain dan spectator. |
| `/mini-games/kotoba-clash/room/[code]/results/[matchId]` | Konten review setiap ronde yang sudah tersedia. | Mengikuti izin akses hasil pertandingan. |

Popup tidak menghentikan timer atau menunda ronde. Perubahan ronde/fase menutup popup dan mengabaikan hasil pencarian lama. Integrasi mini game dikerjakan setelah perilaku seleksi dan pergantian konteks lulus pada tahap sebelumnya.

### Area yang Tidak Menjadi Target Rilis Ini

- Exam yang sedang berlangsung: `/exam/[attemptId]/[session]`, termasuk mock test dan latihan seksi dalam runner exam.
- Latihan cepat sebelum jawaban dikonfirmasi, flashcard sebelum reveal, dan Kotoba Clash di luar `REVEAL`/review.
- `/result/guest` dan `/result/[attemptId]` yang berupa ringkasan skor. Kamus tersedia pada mode baca atau review detail yang dituju dari sana; rencana ini tidak menambah review guest yang belum ada.
- Landing, katalog paket/artikel/bunpou/deck, halaman statistik, form pengaturan, auth, admin, dan kolom input mana pun.
- Kana Word Race, latihan kana, conversation/speaking, postingan komunitas, dan profil. Evaluasi perluasan dilakukan terpisah setelah rilis ini.
- Teks di dalam gambar, scan soal, video, atau audio tanpa transkrip DOM. OCR dan transkripsi baru tidak menjadi bagian integrasi kamus.

## 3. Isi Popup

Contoh alur: pengguna memilih `食べました`; hasil yang tervalidasi menampilkan `食べる`, bacaan `たべる`, kelas kata, dan definisi Inggris seperti “to eat”. Teks pilihan asli tetap terlihat agar hubungan dengan materi jelas.

| Isi | Perilaku |
| --- | --- |
| Kata yang dipilih | Ditampilkan sebagai konteks pencarian, sesuai teks yang dipilih pengguna. |
| Entri kamus dan bacaan | Menampilkan ejaan dan bacaan yang saling sesuai. Kata kana-only tetap didukung. |
| Bentuk dasar | Muncul bila hasil didapat melalui deinflection. Penjelasan jenis konjugasi hanya muncul jika benar-benar didukung hasil analisis. |
| Kelas kata | Noun, verb, adjective, dan seterusnya, dari label data. |
| Arti Inggris | Dikelompokkan per sense; tiga sense awal per entri dengan aksi “Lihat arti lainnya”. Label langka, usang, bidang, atau ragam dipertahankan bila berlaku. |
| Beberapa kandidat | Tiga entri awal; aksi “Lihat hasil lainnya” dapat memperluas hingga batas sepuluh entri per pencarian. Pengguna melihat alternatif untuk ejaan/bacaan yang ambigu. |
| Penanda umum | Ditampilkan bila entri/ejaannya memiliki penanda common yang valid. Tidak dianggap sebagai level JLPT. |
| Salin kata | Menyalin tulisan entri tanpa markup atau furigana tambahan; ada feedback berhasil/gagal. |
| Sumber | Footer “JMdict · EDRDG” dengan tautan sumber dan lisensi. Informasi versi data tersedia pada rincian sumber. |

JMdict sendiri tidak menjadi dasar untuk menambahkan badge level JLPT, rekaman audio, pitch accent, jumlah goresan, atau terjemahan kalimat. Fitur tersebut memerlukan data/pekerjaan tambahan dan belum masuk rilis ini. Popup juga belum menambahkan kartu SRS, bookmark, atau riwayat pencarian.

## 4. Perilaku Seleksi dan Penempatan

### Desktop dan Keyboard

1. Pengguna memblok kata/frasa pendek Jepang dengan drag, double-click yang menghasilkan seleksi, atau keyboard. Hover biasa dan single-click tanpa seleksi tidak memicu pencarian.
2. Setelah seleksi valid stabil sekitar **200 ms** dan pengguna tidak sedang menyeretnya, popup nonmodal otomatis muncul dekat teks. Nilai jeda ini merupakan setelan awal yang disesuaikan setelah UAT.
3. Popup tidak mengambil fokus otomatis. Pengguna tetap bisa mengubah seleksi, menyalin teks dengan shortcut browser, atau masuk ke kontrol kamus dengan keyboard.
4. Popup tetap berada di viewport dan dapat membuka ke atas/bawah mengikuti ruang. Seleksi melintasi baris memakai posisi baris dekat ujung seleksi.
5. Perubahan seleksi memperbarui satu popup yang sama. Tidak ada tumpukan popup atau jendela baru.
6. Escape, tombol tutup, klik di luar, scroll halaman/area sumber, atau perubahan konteks menutup popup. Scroll di dalam daftar arti tetap berfungsi tanpa menutupnya.

Setelah ditutup manual, seleksi yang sama tidak langsung membuka popup lagi sampai pengguna membuat/mengubah seleksi. Seleksi teks di dalam isi popup boleh dipakai untuk menyalin, tetapi tidak memicu pencarian berantai.

### Mobile dan Perangkat Touch

1. Tekan-tahan dan atur seleksi memakai mekanisme browser.
2. Setelah seleksi stabil, tampilkan aksi kecil **“Kamus”** di dekat seleksi tanpa mengambil fokus atau memindahkan gagangnya.
3. Mengetuk “Kamus” membuka drawer bawah yang menampilkan isi kamus yang sama. Ini mempertahankan ruang bagi menu Copy dan gagang seleksi bawaan sebelum pengguna membuka kamus.
4. Simpan teks pilihan sebelum drawer memindahkan fokus. Drawer dapat ditutup lewat tombol tutup, backdrop, atau gesture yang memang didukung komponen.
5. Uji Safari iOS dan Chrome Android pada perangkat nyata. Bila aksi menghalangi selection toolbar, sesuaikan penempatan; jangan mematikan menu bawaan browser untuk seluruh halaman.

### Preferensi Pengguna dan Aksesibilitas

- Pada area yang mendukung, sediakan kontrol ringkas **“Kamus seleksi: aktif/nonaktif”**. Bawaan aktif setelah flag fitur dan indeks siap. Preference disimpan per browser/perangkat; tidak memerlukan perubahan akun atau tabel personal.
- Menonaktifkan kamus menutup popup dan menghentikan lookup dari seleksi berikutnya. Memilih teks untuk Copy tetap bekerja.
- Keterangan singkat “Blok kata Jepang untuk membuka kamus” tersedia pada kontrol bantuan. Kontrol tidak ditambahkan pada halaman yang dikecualikan.
- Popup/drawer memiliki judul, tombol tutup, urutan fokus yang jelas, serta status loading/error yang dapat diumumkan tanpa membaca ulang seluruh hasil.
- Desktop tidak mengunci fokus. Drawer touch mengikuti pola fokus modal komponen existing dan mengembalikan fokus ke pemicu yang masih ada.
- Tetap terbaca pada lebar 320 px, zoom 200%, tema terang/gelap, dan reduced motion. Bahasa definisi ditandai `lang="en"`; tulisan/bacaan Jepang `lang="ja"`.

## 5. Aturan Pencarian dan Teks Jepang

- Terima 1–40 Unicode code point setelah trim; setidaknya ada karakter Jepang. Batas ini divalidasi di client dan server.
- Seleksi kosong, caret, teks tanpa Jepang, input/textarea, contenteditable, dan area UI interaktif tidak memicu request. Seleksi terlalu panjang memberi petunjuk ringkas “Pilih satu kata atau frasa pendek”.
- Seleksi harus berada dalam satu area konten yang diizinkan. Abaikan seleksi yang melintasi pertanyaan, kartu, paragraf terpisah, atau sel tabel berbeda. Kata di dalam satu paragraf atau satu sel tetap boleh melintasi beberapa node/line wrap.
- Ekstrak teks dasar rentang dengan mengecualikan `rt`/`rp`; furigana terlihat, disembunyikan, atau invisible menghasilkan kueri yang sama. Markup underline dan sorotan kata tidak mencemari kueri.
- Simpan teks tampilan asli; normalisasi kueri secara terpisah, termasuk Unicode dan lebar kana yang relevan. Jangan menghapus huruf, partikel, atau akhiran sembarangan untuk memaksakan hasil.
- Cari padanan tepat lebih dahulu. Jika perlu, hasilkan kandidat bentuk dasar dan validasi terhadap kamus serta kelas katanya. Alternatif bacaan/kana diberi prioritas lebih rendah daripada padanan tepat yang valid.
- Pertahankan hubungan ejaan–bacaan–sense dan pembatasan `appliesToKanji`/`appliesToKana`. Arti yang hanya berlaku untuk bacaan tertentu tidak boleh ditempelkan pada semua bacaan.
- Deinflection mencakup dasar ichidan/godan, `する`/`来る`, bentuk sopan/lampau/negatif/te, i-adjective, serta bentuk pasif/potensial/kausatif yang lulus validasi. Kumpulan aturan dan batas kerja harus dibuktikan lewat contoh; dukungan tidak boleh diklaim hanya dari regex penghapus akhiran.
- Frasa didukung bila mempunyai entri yang cocok. Pemecahan kalimat otomatis, tebakan arti berdasarkan konteks AI, dan penerjemahan bebas ditunda.
- Kamus tidak otomatis mengganti kata/kalimat di materi dan tidak memilih arti tertentu sebagai jawaban benar suatu soal.

## 6. State, Kegagalan, dan Pergantian Konteks

| State | Perilaku UI |
| --- | --- |
| Nonaktif/belum reveal | Tidak ada aksi kamus atau request dari seleksi. |
| Seleksi valid | Desktop memulai popup; touch menampilkan aksi “Kamus”. |
| Memuat | Tampilkan kata pilihan dan indikator ringkas, dengan tombol tutup tetap tersedia. |
| Ditemukan | Tampilkan hasil, bacaan, definisi Inggris, alternatif, dan sumber. |
| Tidak ditemukan | “Kata ini belum ditemukan di kamus. Coba pilih bentuk kata yang lebih lengkap atau lebih pendek.” Tidak memanggil layanan kamus lain. |
| Gagal/timeout | “Kamus belum dapat dimuat” dan tombol “Coba lagi”. Halaman belajar tetap dapat digunakan. |
| Pembatasan internal | Pesan untuk mencoba lagi setelah jeda; tidak disajikan sebagai kuota berbayar dari JMdict. |
| Konteks berubah | Tutup popup dan hapus seleksi/request aktif dari konteks lama. |

Konteks mencakup identitas halaman, soal/kartu, status reveal, ronde/fase, serta area sumber yang masih terpasang. Respons hanya boleh diterapkan bila request dan konteksnya masih sama. Respons yang datang terlambat tidak boleh membuka popup kembali setelah ditutup atau membocorkan konten pada soal/kartu berikutnya. Server Action yang sudah berjalan tidak dianggap otomatis batal hanya karena UI ditutup; hasil lamanya diabaikan.

Satu koordinator client pada subtree belajar mengatur popup aktif, termasuk saat berada di sheet diskusi. Portal dan focus boundary harus mengikuti dialog teratas. Pada tahap 2, Escape menutup kamus terlebih dahulu; sheet diskusi di bawahnya tetap terbuka.

### Integrasi Khusus Runner

- **Latihan cepat:** keberhasilan submit server mengaktifkan kamus untuk soal tersebut; submit pending/gagal tetap tidak aktif. Teks pilihan yang telah dikunci harus bisa diseleksi tanpa mengubah jawaban.
- **Flashcard:** saat popup/aksi kamus aktif, shortcut Space, Enter, 1–4, dan F tidak menilai kartu atau memicu aksi reviewer di belakangnya. Koordinasikan status terbuka dengan guard keyboard yang sudah dipakai laporan/diskusi. Rating lewat tombol halaman menutup popup sebelum berpindah kartu; undo juga membuang konteks popup lama.
- **Furigana:** toggle halaman tetap mengatur materi, sementara bacaan pada kamus tampil karena pengguna meminta lookup. Perubahan toggle yang mengubah posisi teks menutup popup agar anchor tidak tertinggal.
- **Audio/transkrip:** membuka kamus tidak otomatis memainkan, menghentikan, atau membuka transkrip. Menutup/menghapus area transkrip menutup popup yang berlabuh di sana.
- **Kotoba Clash:** timer tetap berjalan; reconnect, pergantian ronde, dan keluar dari `REVEAL` membuang popup. `ownAnswer !== null` sendiri tidak cukup untuk mengaktifkan fitur.

## 7. Arsitektur dan Pengelolaan Data

Modul `src/features/dictionary/` kini memuat kontrak hasil, schema zod, normalisasi/deinflection, reader indeks server-only, Server Action lookup, region seleksi, provider popup/drawer, serta preference browser. Implementasi dan batas final tercatat pada dokumen modul.

- **`DictionaryScope`:** pembungkus client yang menerima konten sebagai children, identitas konteks, dan `enabled`. Pola ini mempertahankan komposisi Server Component seperti `FuriganaScope`; tidak perlu memindahkan seluruh halaman ke client.
- **Pemanggilan server:** lookup berupa Server Action sesuai aturan proyek. Input hanya teks pencarian tervalidasi, bukan ID soal untuk membaca kunci, isi halaman penuh, atau catatan pribadi lengkap. Hasil berupa data kamus umum yang terbatas ukurannya.
- **Data awal:** unduh rilis tertentu, validasi schema/lisensi, catat tanggal sumber, versi konversi, jumlah entri, dan SHA-256. Impor diproses di luar request pengguna dan menghasilkan artefak indeks read-only.
- **Penyimpanan awal:** 512 shard gzip dipaketkan pada server (17.209.096 byte) dengan manifest versi tetap; pembacaan lazy dan hash tervalidasi. Pengukuran lokal tersedia; paket function/cold start/RAM target tetap gate aktivasi. Bila budget target gagal, evaluasi shard versi sama pada object storage existing. Tidak ada tabel personal atau migration database aplikasi.
- **Pembacaan runtime:** muat hanya bagian indeks yang dibutuhkan; deduplikasi pembacaan bersamaan dan batasi cache memori. Jangan mem-parse seluruh arsip pada setiap request atau memasukkan seluruh kamus ke bundle/RSC halaman.
- **Cache:** client menyimpan hasil terbaru dengan batas jumlah/ukuran. Server memakai cache proyek dengan key/tag terpusat di `src/constants/cache-key.ts`; identitas cache menyertakan versi indeks, bahasa, dan kueri normalisasi. Hasil kosong boleh dicache; kegagalan infrastruktur tidak diperlakukan sebagai hasil kosong permanen.
- **Proteksi kapasitas:** batas panjang, jumlah kandidat deinflection, jumlah entri, response size, dan request bersamaan. Batas kerja harus berlaku di server meskipun client mengirim input langsung. Hindari satu operasi Redis per huruf/gerakan seleksi; ukur dampak limiter yang dipilih pada kuota hosting existing.
- **Konfigurasi:** flag baru `FEATURES_DICTIONARY`, default **false selama pengembangan/UAT**, diakses melalui konstanta server dan prop client. Set false juga menolak action lookup, tanpa mematikan modul pembelajaran induknya. Konfigurasi indeks mengikuti validasi konstanta proyek.
- **Privasi:** tidak menyimpan histori lookup per akun secara default. Catat metrik agregat latency, cache hit, kegagalan, dan versi data tanpa teks seleksi atau isi catatan pengguna. Lookup runtime memakai indeks sendiri.
- **UI existing:** gunakan Popover/Drawer Base UI yang sudah ada. Audit virtual anchor/range positioning, portal di dalam sheet, dan focus handling sebelum memilih adapter tambahan. Ikuti token tema, border, tipografi, dan gaya komponen aplikasi.

Deinflection memakai aturan reverse-conjugation asli aplikasi dengan batas kandidat/kedalaman dan validasi POS JMdict. Tidak ada dependency baru. `kamiya-codec` tidak dipilih karena memerlukan lemma yang sudah diketahui. Contoh konjugasi, ambiguitas, dan sense restriction diuji terhadap indeks English penuh; mesin ini bukan parser kalimat.

## 8. Lisensi, Pembaruan, dan Biaya

- Atribusi EDRDG dan tautan [lisensi](https://www.edrdg.org/edrdg/licence.html) tampil pada popup/rincian sumber. Data turunan didistribusikan sesuai ketentuan lisensi data, terpisah dari kode aplikasi.
- Sediakan prosedur pembaruan minimal bulanan sesuai panduan EDRDG. Rilis JSON mingguan dapat menjadi input prosedur tersebut. Dokumen ini tidak membuat automation atau mengubah deployment.
- Bangun dan validasi versi baru secara terpisah, kemudian publikasikan satu versi lengkap. Jangan mencampur manifest, posting kata, dan entri dari versi berbeda.
- Jika pembaruan gagal, pertahankan versi valid sebelumnya dan catat kegagalannya untuk pengelola. Cache versi lama tidak digunakan untuk versi baru.
- Ukur ukuran indeks/bundle, cold start, RAM, latency, request object storage, dan biaya/cache sebelum aktivasi. Gratisnya dataset tidak menjadi janji biaya hosting nol.
- Sasaran UX awal: hasil dari cache client tampil segera; lookup server normal ditargetkan di bawah satu detik pada hosting target. Ukur p50/p95 untuk cache hit dan cold lookup terpisah; ini target perencanaan, belum hasil benchmark.

## 9. Urutan Pekerjaan dan Hasil Tiap Fase

| Fase | Pekerjaan | Kriteria selesai |
| --- | --- | --- |
| A — Fondasi data | Import JMdict English penuh, validasi provenance/lisensi, indeks versi tetap, evaluasi storage dan deinflection, kontrak hasil. | Lookup contoh dan ambiguitas benar; pembatasan sense/bacaan dijaga; format/runtime memenuhi budget target. |
| B — Komponen kamus | Selection scope, normalisasi ruby, state/request guard, popup desktop, aksi touch/drawer, preference, aksesibilitas, source attribution. | Seleksi/copy/keyboard/mobile bekerja pada konten referensi tanpa request berlebihan. |
| C — Halaman tahap 1 | Mode baca, hasil detail, latihan setelah dijawab, reviewer/try flashcard setelah reveal, kartu pada diskusi soal/kata. | Semua batas reveal dan pergantian konteks lulus; shortcut reviewer tidak bentrok. |
| D — Halaman tahap 2 | Bunpou, perbandingan, daftar kata deck, body artikel, teks catatan/komentar di area belajar dan sheet. | Plain text dan ruby sama-sama didukung; akses existing terjaga; overlay tidak menutup dialog induk. |
| E — Halaman tahap 3 | Kotoba Clash saat reveal dan review hasil. | Timer/reconnect/pergantian ronde tetap benar; tidak ada popup pada fase menjawab. |
| F — Verifikasi dan rilis | Pemeriksaan proyek, UAT perangkat nyata, budget hosting, prosedur update, dokumentasi kondisi aktual, aktivasi flag. | Bukti dicatat; halaman yang belum lulus tetap tidak diaktifkan. |

Tahap 1 dapat dirilis lebih dahulu setelah fase A–C dan pemeriksaan rilisnya lulus. Tahap 2/3 menyusul dengan verifikasi masing-masing; status seluruh rencana tidak otomatis selesai ketika tahap 1 terbit.

## 10. Acceptance Checklist

Checkbox hanya menandai kriteria yang seluruh cakupannya sudah diperiksa. Item luas yang baru lulus sebagian tetap terbuka; hasil per skenario dan release gate ada pada dokumen UAT. Pemeriksaan memakai Vitest existing dan UAT, tanpa framework baru.

- [x] Lookup `勉強`, kana-only seperti `ありがとう`, kata dengan lebih dari satu bacaan seperti `生`, dan input yang tidak ada di kamus.
- [x] `食べました → 食べる`, `行かなかった → 行く`, `していました → する`, `来なかった → 来る`, serta kata sifat seperti `高くなかった → 高い`.
- [x] Bentuk pasif/potensial/kausatif yang didukung diuji dengan lebih dari satu kandidat valid; kandidat dan label tidak menyesatkan.
- [x] Sense yang dibatasi ke ejaan/bacaan tertentu tidak muncul pada pasangan yang salah; label penggunaan dipertahankan.
- [ ] Ruby terlihat/hidden/invisible, underline, sorotan, kanji-kana lintas node, dan line wrap menghasilkan kueri teks dasar yang benar.
- [ ] Seleksi lintas sel/paragraf/soal ditolak; input, composer, popup sendiri, seleksi kosong/Latin/panjang tidak memicu request yang tidak perlu.
- [ ] Desktop drag/double-click, seleksi keyboard, Escape, klik luar, Copy, retry, dan preferensi aktif/nonaktif bekerja.
- [ ] Safari iOS dan Chrome Android nyata: tekan-tahan, ubah gagang seleksi, menu Copy, aksi Kamus, drawer, dan pengembalian fokus.
- [ ] Lebar 320 px, zoom 200%, light/dark, pembaca layar, dan reduced motion tetap dapat digunakan.
- [ ] Soal belum dijawab/submit gagal, ujian berjalan, kartu sebelum reveal, dan game fase menjawab tidak mengaktifkan UI/request kamus.
- [ ] Reveal yang dikonfirmasi membuka akses; next/back/restart/undo/perubahan ronde/route dan penutupan transkrip membuang popup lama.
- [ ] Respons lambat/berurutan terbalik tidak mengganti hasil seleksi terbaru atau membuka kembali popup yang sudah ditutup.
- [ ] Space/Enter/1–4/F di kamus tidak menilai kartu; tombol jawaban/rating tetap bekerja sebagaimana mestinya setelah kamus ditutup.
- [ ] Sheet diskusi dan popup kamus memiliki layering serta urutan Escape/fokus yang benar; textarea edit tidak memicu lookup.
- [ ] Guest dan login mengikuti akses halaman existing; kamus tidak mengambil kunci/feedback atau mengubah payload exam/practice yang belum diizinkan.
- [ ] Hasil kosong, indeks hilang/rusak, timeout, pembatasan kapasitas, retry, dan clipboard ditolak mendapat UI yang sesuai.
- [ ] Flag false mematikan permukaan dan action; mematikan modul induk tetap menyembunyikan/melindungi halamannya seperti sebelumnya. Flag kamus lulus unit/smoke produksi lokal; matriks seluruh modul induk masih UAT.
- [x] Import/update menghasilkan versi konsisten, atribusi tersedia, cache berubah mengikuti versi, dan versi valid lama tetap dipakai jika pembaruan gagal.
- [ ] Ukuran artefak, RAM/cold start, p50/p95, serta biaya request/cache di hosting target dicatat tanpa data lookup personal.
- [x] `npm run lint`, `npm run typecheck`, dan `npm run build` lulus untuk perubahan implementasi; pemeriksaan existing yang relevan termasuk guard kunci jawaban tetap lulus.
- [x] Dokumen modul/riset dan checklist UAT diperbarui dengan kondisi nyata; UAT manual yang belum dilakukan tidak ditandai lulus.

Implementasi kode dan artefak JMdict penuh sudah tersedia beserta importer/checker offline. Fase A–E telah diintegrasikan, tetapi kriteria budget target dan UAT menyeluruh belum otomatis lulus. Fase F tetap terbuka untuk perangkat nyata, hosting target, dan aktivasi. Tidak ada migration, perubahan data aplikasi, dependency baru, deployment, atau aktivasi production yang dilakukan.
