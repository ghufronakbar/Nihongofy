# Riset popup kamus dari seleksi teks

Tanggal riset: 18 Oktober 2026. Status terbaru: sumber JMdict English penuh telah diimplementasikan dengan indeks internal, default-off. Cakupan mengikuti [rencana](../plan/dictionary-popup.md); kondisi kode ada pada [modul](../module/dictionary.md), [UAT/evidence](../verification/dictionary-popup-uat.md), dan [runbook](../operations/dictionary.md). Temuan endpoint di bawah adalah catatan riset, bukan dependensi runtime fitur.

Tujuan: pengguna memilih kata Jepang pada pembahasan, mode baca, atau materi yang jawabannya sudah dibuka, lalu melihat kamus tanpa meninggalkan halaman.

## Rekomendasi

Dengan prioritas terbaru pengguna berupa **arti Inggris, sumber yang jelas, dan biaya/kuota yang longgar**, rekomendasinya adalah **JMdict English penuh yang diindeks dan dikelola sendiri sejak MVP**. Data berasal dari EDRDG; `jmdict-simplified` dapat digunakan sebagai konversi JSON. Dataset gratis digunakan sesuai lisensinya, termasuk untuk aplikasi komersial, dan lookup internal tidak mempunyai kuota API dari penyedia kamus. Kapasitas serta biaya hosting aplikasi tetap berlaku. Tampilkan sumber setiap arti dengan jelas.

Jotoba tetap menjadi alternatif untuk prototipe cepat karena menyediakan API terdokumentasi dan secara eksplisit mengizinkan penggunaan endpoint dalam jumlah wajar. Dokumentasi yang diperiksa tidak menetapkan kuota numerik, SLA, atau harga paket produksi; jangan menyebutnya API unlimited. Rekomendasi awal berupa Jotoba untuk MVP digantikan oleh indeks JMdict sendiri setelah prioritas biaya dan kuota diperjelas. Tidak ada pilihan hosting atau implementasi yang dijalankan pada tahap riset ini.

Jangan menjadikan Jisho fondasi utama. Endpoint pencarian katanya berfungsi dalam uji kecil, tetapi pengelolanya secara eksplisit menyarankan agar aplikasi terbit tidak bergantung padanya untuk fungsi penting. Banyak paket bernama “Jisho API” juga menambahkan scraping; itu berbeda dari endpoint JSON pencarian kata, dan pengelola melarang scraping sebagai bagian dari aplikasi atau unduhan massal.

## Perbandingan sumber

| Sumber | Yang tersedia | Batas penting | Peran yang disarankan |
| --- | --- | --- | --- |
| [JMdict / EDRDG](https://www.edrdg.org/jmdict/j_jmdict.html) | Dataset kosakata: ejaan, bacaan, arti, kelas kata, label penggunaan, dan relasi antarentri. Sumber diperbarui hampir setiap hari. | Dataset memerlukan indeks pencarian dan pengenalan bentuk kata. Arti Indonesia tidak ditemukan dalam pemeriksaan berkas lengkap. Audio dan pitch accent memerlukan sumber tambahan. | Sumber utama yang direkomendasikan sejak MVP. |
| [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) | Konversi JMdict ke JSON, dokumentasi, tipe TypeScript, distribusi per bahasa, dan versi common-only. Rilis dijadwalkan setiap Senin. | Bukan API pencarian. Lisensi kode/paket berbeda dari lisensi data; lisensi data asal tetap berlaku. | Jalur impor JMdict yang lebih mudah untuk aplikasi TypeScript. |
| [Jotoba](https://jotoba.de/docs.html) | API kata, kanji, nama, dan kalimat. Pencarian kata mengembalikan bacaan, arti, kelas kata, common marker, serta audio/pitch bila tersedia. | Penggunaan diizinkan dalam jumlah wajar; batas numerik dan SLA belum ditemukan. Pilihan bahasa API tidak mencantumkan Indonesia. Audio dan data tambahan memiliki sumber/lisensi tersendiri. | Alternatif prototipe melalui server, dengan cache dan pembatasan permintaan. |
| [Jisho](https://jisho.org/forum/54fefc1f6e73340b1f160000-is-there-any-kind-of-search-api) | Endpoint JSON pencarian kata, arti Inggris, bacaan, dan tag termasuk JLPT bila tersedia. | Pengelola menyebutnya terutama untuk penggunaan hobi, tanpa jaminan fungsi/kelangsungan. Parsing kalimat situs tidak tersedia dalam API tersebut. | Tautan untuk pencarian lanjutan oleh pengguna. |
| [kanjiapi.dev](https://kanjiapi.dev/) | API detail kanji, on/kun reading, jumlah goresan, arti, serta endpoint kata terkait kanji. | Berorientasi kanji; tidak menggantikan lookup kosakata dan pengenalan konjugasi. | Pelengkap detail kanji pada tahap selanjutnya. |

JMdict dan layanan yang memakai JMdict bukan sumber kosakata yang sepenuhnya berbeda. Membandingkannya terutama berarti memilih siapa yang mengelola indeks, pencarian, pembaruan, dan ketersediaan layanan.

## Uji endpoint langsung

Uji dilakukan dari lingkungan pengembangan pada tanggal riset menggunakan tiga kueri publik per layanan. Semua permintaan memperoleh HTTP 200. Ini pemeriksaan fungsi kecil, bukan benchmark atau bukti reliabilitas produksi.

| Teks yang dipilih | Hasil pertama Jotoba | Hasil pertama Jisho |
| --- | --- | --- |
| 勉強 | 勉強 / べんきょう / study | 勉強 / べんきょう / study |
| 食べました | 食べる / たべる / to eat | 食べる / たべる / to eat |
| 行かなかった | 行く / いく / to go | 行く / いく・ゆく / to go |

Endpoint yang diuji:

- Jotoba: `POST https://jotoba.de/api/search/words`, body berisi `query`, `language: "English"`, dan `no_english: false`.
- Jisho: `GET https://jisho.org/api/v1/search/words?keyword=<encoded-query>`.

Hasil tidak selalu hanya padanan tepat. Untuk `食べました`, Jotoba juga mengembalikan `食べ方` dan `真下`, sementara Jisho juga mengembalikan `食べるラー油`. Popup perlu membedakan hasil utama dari alternatif dan tidak menganggap semua hasil pencarian sebagai kata yang dipilih. Keberhasilan tiga contoh juga belum membuktikan dukungan seluruh konjugasi, slang, atau frasa.

Arsip rilis `jmdict-simplified` terbaru yang diperiksa bertanggal 12 Oktober 2026 (`3.6.2+20261012204142`):

| Distribusi | Ukuran ZIP |
| --- | ---: |
| JMdict English penuh | 11.531.465 byte, sekitar 11,5 MB |
| JMdict English common-only | 1.444.290 byte, sekitar 1,44 MB |
| JMdict semua bahasa | 25.105.738 byte, sekitar 25,1 MB |

Angka tersebut adalah ukuran arsip terkompresi, bukan ukuran indeks, penggunaan RAM, atau unduhan yang harus diterima pengguna. Common-only menghemat ukuran dengan mengurangi cakupan; jangan menganggapnya setara kamus lengkap untuk seluruh materi N1–N5.

## Bahasa Indonesia

Distribusi bahasa `jmdict-simplified` yang diperiksa mencakup Inggris, Jerman, Rusia, Hungaria, Belanda, Spanyol, Prancis, Swedia, dan Slovenia. Pemeriksaan langsung seluruh gloss pada arsip `jmdict-all-3.6.2+20261012204142.json.zip` mengonfirmasi sembilan bahasa tersebut dan **0 gloss berkode `ind` atau `id`**. Enum bahasa Jotoba juga tidak mencantumkan Indonesia. Jisho mengembalikan `english_definitions`. Fokus MVP terbaru adalah Inggris saja; catatan pengayaan Indonesia berikut bersifat opsional untuk pengembangan selanjutnya.

Proyek sudah mempunyai `VocabCardContent.meaningsId`, `meaningsEn`, `reading`, dan contoh berbahasa Indonesia di [types.ts](../../src/features/flashcard/types.ts), yang digunakan oleh [VocabCardView](../../src/features/flashcard/components/vocab-card-view.tsx). Ini dapat membantu tanpa menerjemahkan setiap lookup melalui AI.

Usulan penyajian:

- Arti Indonesia dari kosakata aplikasi jika ejaan dan bacaan cocok; label sumber sebagai kosakata aplikasi.
- Arti Inggris dari penyedia kamus tetap tersedia, dengan label bahasa dan atribusi.
- Jika tidak ada padanan Indonesia, tampilkan Inggris secara eksplisit. Jangan membuat kesan bahwa cakupan terjemahan Indonesia sudah lengkap.
- Pencocokan harus mempertimbangkan bacaan dan makna; ejaan yang sama dapat memiliki beberapa bacaan atau arti. Terjemahan satu entri flashcard tidak otomatis berlaku untuk semua sense pada JMdict.

Penerjemahan mesin dapat diteliti sebagai pengayaan terpisah jika cakupan Indonesia penuh diperlukan. Itu membawa biaya, validasi mutu, dan penandaan sumber tambahan, sehingga tidak diperlukan untuk MVP popup.

## Alur interaksi yang diusulkan

1. Pengguna menyeleksi satu kata atau frasa pendek Jepang pada area yang diaktifkan.
2. Setelah seleksi selesai/stabil, popup tampil dekat teks dengan status memuat.
3. Popup menampilkan kata yang dipilih, bentuk kamus bila berbeda, bacaan kana, kelas kata, beberapa arti utama, alternatif, dan sumber.
4. Klik di luar atau Escape menutup popup. Pergantian soal/kartu juga menutup popup dan membatalkan penggunaan respons lama.
5. Pada mobile, pastikan menu seleksi bawaan dan gagang seleksi tetap dapat digunakan. Panel bawah dapat dibuka melalui aksi kecil “Kamus” jika popup otomatis mengganggu seleksi. Pilihan perilaku akhirnya perlu diuji di Safari iOS dan Chrome Android.

Simpan teks/rentang yang diperlukan sebelum fokus berpindah ke popup. Jangan memaksa fokus setiap kali `selectionchange` berjalan. Sediakan jalur keyboard yang jelas, tombol tutup, dan judul popup untuk pembaca layar. Penyeleksian dengan keyboard juga harus memicu lookup.

Seleksi satu kalimat penuh tidak sama dengan mencari entri kamus. Untuk MVP, batasi ke kata/frasa pendek dan berikan petunjuk jika pilihan terlalu panjang. Segmentasi kalimat otomatis bisa menjadi tahap lanjutan; jangan menyajikan hasil leksikal sebagai terjemahan kalimat.

## Event dan pemrosesan teks

Gunakan [`document.selectionchange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/selectionchange_event) untuk mengetahui perubahan seleksi, lalu [`window.getSelection()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getSelection) untuk membaca rentangnya. Event tersebut berjalan di `document` dan tidak bubble; pembungkus fitur harus memeriksa bahwa awal dan akhir seleksi berada dalam area yang diizinkan.

Pertimbangan implementasi:

- Jangan mengirim permintaan setiap gerakan gagang seleksi. Tunggu seleksi stabil, deduplikasi kueri, dan gunakan pelepasan pointer sebagai salah satu sinyal selesai. Tetap dukung seleksi keyboard dan touch.
- Abaikan seleksi kosong, input/textarea, contenteditable, UI popup sendiri, dan seleksi lintas area yang tidak diizinkan.
- Validasi keberadaan karakter Jepang dan batas panjang wajar; nilai awal yang dapat diuji adalah maksimal 40 code point. Simpan tampilan asli dan kueri normalisasi secara terpisah.
- Teks Jepang proyek dirender dengan `<ruby><rt>`. Ambil teks dasar pada rentang seleksi dengan mengecualikan `rt`/`rp`; jangan hanya mengandalkan `textContent` karena bacaan dapat ikut masuk. Uji kondisi furigana terlihat, tersembunyi, dan seleksi parsial.
- Gunakan [`Range.getClientRects()`](https://developer.mozilla.org/en-US/docs/Web/API/Range/getClientRects) untuk posisi dekat baris seleksi, terutama jika seleksi melintasi baris. Tangani batas viewport, scroll, dan resize.
- Bedakan hasil tidak ditemukan dari kegagalan jaringan/timeout. Respons kueri sebelumnya tidak boleh menggantikan hasil seleksi terbaru.

Lookup JMdict yang dikelola sendiri memerlukan **deinflection**, yaitu mengembalikan bentuk seperti `食べました` ke kandidat `食べる`. Sekadar menghapus akhiran dengan regex tidak cukup untuk godan, ichidan, bentuk tidak beraturan, pasif/potensial, dan kata sifat. Kandidat harus divalidasi terhadap entri dan kelas kata kamus.

[`kamiya-codec`](https://github.com/fasiha/kamiya-codec) merupakan referensi pustaka TypeScript untuk konjugasi/dekonjugasi; metadata npm yang diperiksa menyebut lisensi Unlicense. Namun, fungsi dekonjugasinya meminta bentuk kamus yang sudah diketahui. Jadi pustaka ini tidak langsung menyelesaikan penemuan lemma dari seleksi sembarang. Pemilihan mesin deinflection untuk backend mandiri masih memerlukan spike dan pengujian; tidak ada pustaka baru yang dipasang dalam riset ini.

## Titik integrasi proyek

| Area | Titik yang sudah ada | Kapan kamus aktif |
| --- | --- | --- |
| Mode baca paket soal | [questions/page.tsx](<../../src/app/(public)/test-package/[id]/questions/page.tsx>), di dalam area `FuriganaScope` | Saat membaca materi. |
| Review hasil ujian | [detail/page.tsx](<../../src/app/(public)/result/[attemptId]/detail/page.tsx>), di dalam area `FuriganaScope` | Setelah attempt selesai dan review diizinkan. |
| Latihan cepat | [practice-runner.tsx](../../src/features/practice/components/practice-runner.tsx), state `isAnswered` dan feedback | Setelah jawaban diperiksa. |
| Flashcard | [vocab-card-view.tsx](../../src/features/flashcard/components/vocab-card-view.tsx), prop `revealed` | Setelah kartu dibuka. |
| Kotoba Clash | [round.tsx](../../src/features/kotoba-clash/components/round.tsx), fase `REVEAL`/review | Opsional setelah MVP; jangan mengganggu pergantian ronde otomatis. |

[JapaneseText](../../src/components/japanese-text.tsx), [JapanesePassage](../../src/components/japanese-passage.tsx), dan [QuestionExplanationBody](../../src/components/question-explanation.tsx) sudah menjadi jalur render bersama. Tambahkan pembungkus interaktif seperti `DictionaryScope` pada area yang memerlukan fitur, dengan `enabled` mengikuti state halaman. Hindari menyalakan fitur secara global pada setiap `JapaneseText`, karena komponen yang sama digunakan saat pengguna masih menjawab.

Pembungkus client dapat menerima `children` yang dirender server, mengikuti pola [FuriganaScope](../../src/components/furigana-scope.tsx). Komponen [Popover](../../src/components/ui/popover.tsx) dan [Drawer](../../src/components/ui/drawer.tsx) sudah tersedia; periksa dukungan anchor rentang/virtual anchor Base UI saat implementasi. Tidak perlu memilih pustaka popup baru sekarang.

## Bentuk implementasi MVP

- Modul `src/features/dictionary/` memisahkan UI seleksi, tipe hasil, validasi, dan penyedia server.
- Pencarian melalui Server Action mengikuti aturan proyek, dengan zod untuk input dan validasi data impor/layanan eksternal yang dimulai dari `unknown`.
- UI berkomunikasi dengan hasil kamus yang dinormalisasi. Simpan metadata sumber agar atribusi dan pergantian backend tetap benar.
- Terapkan batas waktu query, batas hasil, pembatasan permintaan memakai mekanisme proyek, serta cache kueri dan hasil kosong yang masuk akal. Definisikan key/tag cache di `src/constants/cache-key.ts` sesuai aturan proyek. Masukkan bahasa dan versi data saat relevan. Alternatif API eksternal juga memerlukan timeout upstream.
- Hanya kirim kata/frasa yang dipilih ke pencarian internal; seluruh halaman atau catatan pengguna tidak diperlukan. Backend utama yang dikelola sendiri tidak mengirim lookup ke penyedia kamus eksternal. Endpoint dan konfigurasi server tetap mengikuti konstanta proyek.
- Tambahkan feature flag sesuai pola modul proyek bila fitur akan dirilis bertahap.
- Atribusi ditempatkan pada popup dan dokumentasi sumber. Audio, pitch accent, simpan ke flashcard, serta terjemahan otomatis ditunda sampai sumber dan alur dasarnya terverifikasi.

Backend utama yang direkomendasikan memakai JMdict English penuh dari `jmdict-simplified`, yang diproses menjadi indeks di luar request pengguna. Jangan mengirim seluruh kamus dalam bundle browser atau mengunduh/mem-parse seluruh arsip pada setiap lookup. Pilihan format indeks dan lokasi penyimpanannya belum ditetapkan; ukur ukuran indeks, penggunaan RAM, cold start, dan biaya traffic sesuai batas hosting proyek terlebih dahulu. Tidak ada biaya lisensi data atau biaya API per lookup, tetapi total biaya operasional nol belum dapat dijanjikan sebelum pengukuran hosting tersebut.

## Lisensi dan pembaruan

[Lisensi EDRDG yang diperiksa](https://www.edrdg.org/edrdg/licence.html) menyatakan Creative Commons Attribution-ShareAlike **4.0**, mengizinkan penggunaan komersial, dan menyebut perangkat lunak yang menggunakan data tidak harus berlisensi open source. Atribusi dan kewajiban berbagi serupa berlaku atas data turunannya sesuai lisensi; jangan menyamakan lisensi dataset dengan kewajiban membuka seluruh aplikasi.

Panduan EDRDG juga meminta pengakuan sumber pada tampilan fungsi kamus web dan prosedur pembaruan rutin; contoh yang diberikan untuk server kamus web adalah **setidaknya sekali sebulan**. Jika mengelola salinan sendiri, sertakan versi sumber dan prosedur impor/publikasi yang aman. Ini kebutuhan pengelolaan data ketika implementasi dimulai, bukan automation yang dibuat oleh riset ini.

Jotoba juga mewajibkan kepatuhan terhadap lisensi sumber datanya. Menggunakan API pihak ketiga tidak menghilangkan kebutuhan atribusi. Lisensi server Jotoba sendiri adalah AGPL-3.0-or-later; itu perlu diperiksa bila memilih menjalankan atau memodifikasi kode server Jotoba, terpisah dari pilihan memakai API publik atau membangun indeks JMdict sendiri.

## Pemeriksaan sebelum implementasi dianggap siap

- Hasil kata biasa, kana-only, kata dengan banyak bacaan, frasa, dan kata yang tidak ditemukan.
- Deinflection pada contoh di atas serta bentuk kata sifat, pasif/potensial, dan bentuk tidak beraturan; tiga kueri riset belum mencakupnya.
- Seleksi melewati ruby, underline, beberapa node, dan pergantian baris; furigana tidak mencemari kueri.
- Fitur mati sebelum reveal dan saat ujian berjalan; aturan payload kunci jawaban yang ada tetap dijaga.
- Seleksi tidak memicu tombol jawaban atau shortcut penilaian flashcard; Escape, klik luar, dan pergantian kartu bekerja.
- Seleksi keyboard, Safari iOS, Chrome Android, pembaca layar, dan viewport sempit.
- Timeout, hasil kosong, respons tidak valid, rate limit, cache, dan respons yang datang tidak berurutan.
- Untuk perubahan struktur/Server Action, jalankan pemeriksaan dan build sesuai aturan proyek. Tidak ada test aplikasi/build yang dijalankan pada tahap riset karena perubahan hanya berupa dokumen ini.

## Sumber utama

1. [JMdict, deskripsi dan distribusi resmi](https://www.edrdg.org/jmdict/j_jmdict.html).
2. [Lisensi EDRDG, atribusi dan pembaruan](https://www.edrdg.org/edrdg/licence.html).
3. [jmdict-simplified: format, bahasa, jadwal rilis, dan lisensi](https://github.com/scriptin/jmdict-simplified).
4. [Rilis JMdict JSON yang diperiksa](https://github.com/scriptin/jmdict-simplified/releases/tag/3.6.2%2B20261012204142).
5. [Dokumentasi API Jotoba](https://jotoba.de/docs.html).
6. [Jotoba: izin pemakaian API dalam jumlah wajar dan lisensi kode](https://github.com/WeDontPanic/Jotoba).
7. [Sumber dan lisensi data Jotoba](https://jotoba.de/about).
8. [Forum Jisho: penjelasan API dan batasannya dari pengelola](https://jisho.org/forum/54fefc1f6e73340b1f160000-is-there-any-kind-of-search-api). Rujukan khusus: komentar 4 September 2023 tentang ketergantungan aplikasi dan 11 Februari 2024 tentang scraping.
9. [kanjiapi.dev](https://kanjiapi.dev/).
10. [MDN: selectionchange](https://developer.mozilla.org/en-US/docs/Web/API/Document/selectionchange_event), [getSelection](https://developer.mozilla.org/en-US/docs/Web/API/Window/getSelection), dan [getClientRects](https://developer.mozilla.org/en-US/docs/Web/API/Range/getClientRects).
11. [kamiya-codec dan keterbatasan dekonjugasinya](https://github.com/fasiha/kamiya-codec).
