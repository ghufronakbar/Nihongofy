# Modul Kana

## Status Aktual

**Pengenalan, self-review, Quiz 46 Kana, dan Tebak Kotoba Minna no Nihongo Bab 1–25 tersedia.** Hiragana dan katakana berasal dari fixture terkurasi; kosakata Tebak Kotoba ditranskripsi dari daftar kosakata Minna no Nihongo I milik pengajar. Kedua quiz berjalan seluruhnya di browser tanpa login atau penyimpanan database; progress kartu belajar untuk akun tetap memakai counter per kartu.

## Feature Flag

`FEATURES_KANA` (default `true`). Saat `false`:

- `/kana/hiragana`, `/kana/katakana`, `/kana/quiz`, dan `/kana/kotoba` mengembalikan 404 lewat guard `src/app/(public)/kana/layout.tsx`.
- Menu Kana di header, kartu Kana di home, kartu Kana Lab di dashboard, quick action "Latih kana" dan statistik "Kana pernah benar" di profile tidak dirender.
- `/kana/*` keluar dari `sitemap.xml` dan daftar `allow` di `robots.txt`.
- Data `KanaProgress` tidak dihapus dan tampil kembali saat flag diaktifkan.
- `kana/actions.ts` tidak mengecek flag; hanya halaman yang tertutup.

## Route

- `/kana/hiragana`
- `/kana/katakana`
- `/kana/quiz` (opsional `?script=hiragana` atau `?script=katakana` untuk pilihan awal)
- `/kana/kotoba` (opsional `?bab=1`–`?bab=25` untuk bab awal dan `?cakupan=inti` untuk langsung memilih kata inti)

## Fitur Aktif

- Grid gojuon dengan 46 karakter dasar per script.
- Pencarian berdasarkan karakter, romaji, dan variasi bunyi.
- Filter kelompok bunyi.
- Flip card dan romaji.
- Dakuten/handakuten ditampilkan sebagai variasi pada kartu terkait.
- Mode review dengan rating `AGAIN` dan `CORRECT`.
- TTS bahasa Jepang melalui Web Speech API browser.
- Quiz 46 kana dasar per script: nickname bebas 1–32 karakter, empat pilihan romaji unik, urutan kana dan pilihan diacak, dan pasangan bentuk mirip wajib masuk sebagai pengecoh.
- Jawaban dikunci saat dipilih; kunci dan pembahasan baru ditampilkan setelah seluruh soal selesai. Keyboard angka 1–4 tersedia.
- Waktu per jawaban dihitung sejak soal tampil, termasuk perpindahan tab/refresh, tanpa jeda transisi dan tanpa penalti nilai karena lambat.
- Hasil menampilkan peta 46 kana, nilai/akurasi, total/rata-rata durasi, kesalahan, jawaban benar paling lambat, dan rincian semua jawaban.
- Unduh PNG ringkasan atau laporan lengkap 46 jawaban. Web Share membagikan file ringkasan jika didukung, dengan fallback unduh.

### Tebak Kotoba (Minna no Nihongo)

- 1.172 kosakata Minna no Nihongo I Bab 1–25, seluruh isi daftar kosakata revisi pengajar (Bab 1–5: 45, 47, 44, 59, 59; Bab 6–10: 54, 48, 57, 50, 47; Bab 11–15: 62, 50, 61, 73, 50; Bab 16–20: 51, 83, 46, 34, 16; Bab 21–25: 40, 20, 29, 17, 30 kata). Bab 13–25 memuat kosakata referensi yang sebagian sudah muncul di bab lain (mis. だいがく, デパート, きょうし); kata itu tetap dicantumkan per bab dan ditandai konflik dengan pasangannya. Pengaturan: nickname 1–32 karakter, satu atau beberapa bab, tampilan depan kartu (hiragana/katakana atau kanji), cara menebak (4 pilihan atau balik kartu), jumlah soal 10, 20, atau semua kata pada bab terpilih, dan timer per kata (tanpa batas atau 3–300 detik).
- Pilihan "Kata yang diuji": **Semua kata** (default) atau **Inti saja**. Mode inti hanya menguji kata inti, dan pengecohnya juga diambil dari kata inti. Jumlah kata per bab di form dan pilihan "Semua (N)" ikut berubah. Di mode semua kata, bagian belakang kartu kata tambahan diberi label "Kata tambahan · referensi: <tema>" atau "Kata tambahan · nama diri". Hasil sesi inti diberi badge "Kata inti". Rincian pembagiannya ada di "Kata inti dan kata tambahan" di bawah.
- Mode kanji memakai kolom kanji daftar sumber; kata tanpa kanji (kata ganti, katakana, ungkapan) tetap tampil dalam kana dan label kartu ikut menjadi "Kana".
- Depan kartu menampilkan kata, siswa memilih satu dari empat arti. Setelah memilih, kartu dibalik: bagian belakang memuat kana, kanji, arti, catatan pemakaian, tombol dengar (TTS), serta penanda benar/salah. Kartu berikutnya dibuka dengan tombol "Lanjut" atau Enter; keyboard 1–4 untuk memilih.
- Pengecoh diambil berurutan dari kelompok kata sejenis (`KOTOBA_FAMILIES`, mis. nama hari, tanggal, kosoado, alat transportasi), lalu dari bab yang sama, lalu dari bab lain yang dipilih. Kata yang artinya bertumpuk atau tulisannya sama (`KOTOBA_CONFLICTS`, mis. せんせい/きょうし, いいえ/ちがいます, そちら Bab 3/Bab 4) tidak pernah muncul bersama dalam satu soal.
- Tombol "Lewati, saya belum tahu" (keyboard `L`) membalik kartu tanpa memilih arti. Kata dicatat sebagai dilewati (`selectedKey: null`): tidak dihitung benar, ditampilkan terpisah dari jawaban salah, dan ikut "Ulangi N kata ini".
- Waktu dihitung sejak depan kartu tampil sampai arti dipilih atau kata dilewati; waktu membaca bagian belakang tidak dihitung.
- Dengan timer, kartu menampilkan hitung mundur dan bar sisa waktu (merah di 3 detik terakhir, atau 30% terakhir untuk timer pendek). Saat waktu habis kartu otomatis dibalik dan kata dicatat "waktu habis" (`selectedKey: null` dengan `elapsedMs` sama dengan batas). Batas dijaga di engine dan hook, sehingga jawaban yang terlambat atau refresh setelah batas tetap tercatat waktu habis.
- Mode **Balik kartu** (`mode: "flip"`): soal tanpa pilihan (`options: []`). Pemain menebak arti dalam hati lalu membalik kartu (tombol "Balik kartu", Spasi/Enter/`F`, atau klik kartu); waktu tebak berhenti di sini dan disimpan sebagai `revealedMs`. Bagian belakang menampilkan tulisan lengkap, lalu pemain menilai sendiri **Benar** (`1`/`B`) atau **Salah** (`2`/`S`); penilaian disimpan di `verdict` dan kartu berikutnya langsung terbuka. Setiap kata muncul sekali, tanpa antrean ulang seperti flashcard, dan tidak ada tombol lewati. Timer membalik kartu otomatis saat waktu habis dan mencatat "waktu habis" tanpa penilaian; membalik kartu setelah batas (tab di latar belakang, refresh) juga dicatat waktu habis.
- Hasil menampilkan skor/akurasi, total dan rata-rata waktu, jumlah salah, dilewati, dan waktu habis, rincian per bab bila memilih lebih dari satu bab, daftar kata yang perlu diulang, dan tabel semua jawaban. "Ulangi N kata ini" memulai sesi baru hanya dari kata yang salah; "Main lagi" mengacak ulang dengan pengaturan yang sama.
- Rapor bisa diekspor sebagai PNG (`src/features/kana/kotoba/image-export.ts`, canvas di browser, tanpa upload): **Unduh ringkasan** (nama, bab, label pengaturan, skor/akurasi, waktu, salah/dilewati/waktu habis, skor per bab bila lebih dari satu bab, dan hingga 10 kata yang perlu diulang), **Unduh laporan lengkap** (ringkasan + tabel setiap kata: kana/kanji, arti, jawaban atau penilaian, waktu), dan **Bagikan** lewat Web Share API dengan fallback unduh. Karena Safari menolak canvas di atas ±16,7 juta piksel, laporan lengkap dibatasi `KOTOBA_REPORT_MAX_ROWS` (180) baris: bila kata lebih banyak, gambar hanya memuat kata yang perlu diulang dan menuliskan jumlah yang tidak muat.

#### Kata inti dan kata tambahan

Daftar kosakata pengajar tidak memberi tanda inti, jadi pembagian di bawah mengikuti susunan daftar kosakata buku Minna no Nihongo dan disimpan sebagai `kind` di `data.ts` (`REFERENSI` dan `NAMA`).

- **Inti (942 kata)**: kosakata utama bab, yaitu kata baru beserta ungkapan latihan dan percakapan bab itu (mis. はじめまして, ごちゅうもんは？, おだいじに).
- **Referensi (209 kata, `kind: "referensi"`)**: kosakata referensi bertema (参考語彙) yang di daftar pengajar ditempel di akhir Bab 13–25. Selalu menjadi ekor daftar bab; batasnya adalah kata terakhir percakapan bab itu.
- **Nama diri (21 kata, `kind: "nama"`)**: nama kota, stasiun, tempat, festival, dan negara yang hanya muncul di latihan atau percakapan. Pengecualian: nama negara Bab 1 tetap inti karena menjadi bahan 〜じん dan 〜からきました, dan tes kotoba Bab 1 pengajar juga menguji nama negara.
- Bab 1, 2, 8, 9, 10, 16, dan 24 seluruhnya inti. Bab 23 No. 29 としょかん tetap inti karena kata umum (berasal dari tempat percakapan Bab 23).

| Bab | Inti | Tambahan | Kata tambahan |
|---|---|---|---|
| 3 | 41 | 3 | Nama diri (No. 42, 43, 44): しんおおさか、イタリア、スイス |
| 4 | 54 | 5 | Nama diri (No. 55, 56, 57, 58, 59): ニューヨーク、ペキン、ロンドン、バンコク、ロサンゼルス |
| 5 | 55 | 4 | Nama diri (No. 56, 57, 58, 59): はかた、ふしみ、こうしえん、おおさかじょう |
| 6 | 52 | 2 | Nama diri (No. 53, 54): メキシコ、おおさかじょうこうえん |
| 7 | 46 | 2 | Nama diri (No. 47, 48): ヨーロッパ、スペイン |
| 11 | 61 | 1 | Nama diri (No. 63): オーストラリア |
| 12 | 47 | 3 | Nama diri (No. 48, 49, 50): ぎおんまつり、ホンコン、シンガポール |
| 13 | 29 | 32 | Referensi "tempat di kota" (No. 30–61): はくぶつかん、びじゅつかん、としょかん、えいがかん、たいいくかん、どうぶつえん、しょくぶつえん、たいしかん、にゅうこくかんりきょく、ゆうえんち、しやくしょ、けいさつしょ、こうばん、しょうぼうしょ、ちゅうしゃじょう、おてら、じんじゃ、きょうかい、モスク、だいがく、こうこう、ちゅうがっこう、しょうがっこう、ようちえん、にくや、パンや、さかなや、さかや、やおや、コンビニ、スーパー、デパート |
| 14 | 44 | 29 | Referensi "di stasiun" (No. 45–73): きっぷうりば、じどうけんばいき、せいさんき、かいさつぐち、でぐち、いりぐち、ひがしぐち、にしぐち、みなみぐち、きたぐち、ちゅうおうぐち、（プラット）ホーム、ばいてん、コインロッカー、タクシーのりば、バスターミナル、バスてい、とっきゅう、きゅうこう、かいそく、じゅんきゅう、ふつう、じこくひょう、〜はつ、〜ちゃく、ていきけん、かいすうけん、かたみち、おうふく |
| 15 | 22 | 28 | Referensi "pekerjaan" (No. 23–50): しょくぎょう、かいしゃいん、こうむいん、えきいん、ぎんこういん、ゆうびんきょくいん、てんいん、ちょうりし、りようし、びようし、きょうし、べんごし、けんきゅうしゃ、かんごし、うんてんしゅ、けいさつかん、がいこうかん、せいじか、がか、さっか、おんがくか、けんちくか、エンジニア、デザイナー、ジャーナリスト、かしゅ、はいゆう、スポーツせんしゅ |
| 17 | 32 | 51 | Referensi "tubuh dan penyakit" (No. 33–83): からだ、びょうき、あたまがいたい、おなかがいたい、はがいたい、ねつがあります、せきがでます、はなみずがでます、ちがでます、はきけがします、さむけがします、めまいがします、げりをします、べんぴをします、けがをします、やけどをします、しょくよくがありません、かたがこります、からだがだるい、かゆい、かぜをひきます、インフルエンザ、もうちょう、ぎっくりごし、ねんざ、こっせつ、ふつかよい、かお、め、はな、くち、あご、のど、むね、みみ、あたま、かみ、くび、かた、うで、ひじ、て、ゆび、つめ、おなか、せなか、こし、しり、あし、ひざ、ほね |
| 18 | 25 | 21 | Referensi "gerakan" (No. 26–46): うごき、とぶ、とぶ、のぼる、はしる、およぐ、もぐる、とびこむ、さかだちします、はう、ける、ふる、もちあげる、なげる、たたく、ひく、おす、まげる、のばす、ころぶ、ふりむく |
| 19 | 21 | 13 | Referensi "budaya tradisional dan hiburan" (No. 22–34): さどう、いけばな、しょどう、かぶき、のう、ぶんらく、じゅうどう、けんどう、からて、らくご、しょうぎ、パチンコ、ぼんおどり |
| 20 | 14 | 2 | Referensi "panggilan dalam keluarga" (No. 15–16): おねえちゃん、おにいちゃん |
| 21 | 26 | 14 | Referensi "sekolah, wilayah, dan jabatan" (No. 27–40): ほいくえん、ようちえん、しょうがっこう、ちゅうがっこう、こうとうがっこう、だいがく、けいさつ、し、まち、むら、かちょう、ぶちょう、しゃちょう、かいちょう |
| 22 | 17 | 3 | Referensi "pakaian" (No. 18–20): みずぎ、したぎ、きもの |
| 23 | 28 | 1 | Nama diri (No. 28): ほうりゅうじ |
| 25 | 14 | 16 | Referensi "tahapan hidup" (No. 15–30): せいねん、ちゅうねん、ろうじん、ほいくえん、ようちえん、しょうがっこう、ちゅうがっこう、こうとうがっこう、だいがく、せんもんがっこう、だいがくいん、がくし、しゅうしょく、けっこん、りこん、さいこん |

## Data dan Persistence

- Konten kana adalah fixture kode di `src/features/kana/data/kana.ts`, bukan tabel content database.
- Untuk user login, `KanaProgress` menyimpan `viewCount`, `correctCount`, `againCount`, dan timestamp.
- Untuk guest, UI tetap bisa dipakai tetapi data hanya hidup di state halaman dan hilang saat refresh.
- Data progress divalidasi terhadap daftar stable `kanaKey` yang dikenal aplikasi.
- Quiz memakai `sessionStorage` dengan key `nihongofy:kana-quiz:v1`, terpisah dari progress kartu belajar, termasuk untuk siswa yang sedang login. Tidak ada action atau query database untuk hasil quiz.
- Kosakata Tebak Kotoba adalah fixture kode di `src/features/kana/kotoba/data.ts`, mengikuti daftar revisi `kosakata/kosakata-bab-01-25.md` di repo materi pengajar (koreksinya di `kosakata/catatan-koreksi.md`; PDF scan lama sudah dihapus dari repo itu). Nomor baris, kana, dan kanji sama dengan daftar revisi. Perbedaan yang disengaja: arti diringkas agar muat sebagai pilihan jawaban (keterangan pindah ke `note`), ejaan KBBI (Prancis, bolpoin, menelepon), tanda 〜 dan kurung （）, konteks pada kata kerja berkana sama (mis. やすみます（かいしゃを〜）, かけます（めがねを〜）), tanpa kurung di depan kartu untuk あのかた/おいくつ, どの〜 seperti この〜, dan Bab 11 No. 6 かいしゃを〜 (tanpa arti) digabung ke No. 5. Key kata (`bab-<bab>-<no>`) mengikuti nomor baris daftar; jangan diubah karena dipakai snapshot sesi.
- Sesi Tebak Kotoba memakai `sessionStorage` key `nihongofy:kotoba-quiz:v1` dan divalidasi Zod: bab terpilih, cakupan kata (sesi lama tanpa `scope` dipulihkan sebagai semua kata; sesi inti ditolak bila memuat kata tambahan), keunikan soal, empat pilihan tanpa konflik arti, urutan jawaban, dan timestamp. Refresh saat bagian belakang kartu terbuka tetap memulihkan kartu tersebut. Sesi lama tanpa `mode` dipulihkan sebagai 4 pilihan; sesi balik kartu wajib tanpa pilihan, jawabannya tanpa `selectedKey` dan dengan `verdict` (kecuali waktu habis), dan `revealedMs` hanya sah di mode balik kartu saat kartu aktif dan di bawah batas waktu.
- Snapshot quiz divalidasi dengan Zod: jumlah/keunikan kana, script, pilihan, urutan jawaban, dan konsistensi timestamp. Refresh mempertahankan timer soal, jawaban, serta hasil; tutup tab mengakhiri penyimpanan sementara.
- Jika penyimpanan browser ditolak, quiz tetap berjalan di memori dan UI mengingatkan agar tidak refresh serta mengunduh hasil.
- Ekspor memakai Canvas browser tanpa dependency tambahan atau upload. Nickname dan jawaban tidak dimasukkan ke URL.

## Keterbatasan Aktual

- Bukan SRS: tidak ada due date, interval, random queue, atau jadwal review.
- Tidak ada latihan menulis/drawing, digraph yoon seperti `きゃ`, atau kata contoh. Quiz hanya menguji 46 kana dasar, belum dakuten/handakuten.
- Tebak Kotoba mencakup Bab 1–25 (Minna no Nihongo I) dan baru satu arah (kata → arti). Belum ada arah arti → kata atau progress akun. Arti dan catatan mengikuti daftar sumber yang sudah dirapikan, belum ditinjau ulang oleh pengajar.
- Quiz merupakan evaluasi mandiri: hasil browser/gambar tidak memiliki verifikasi server atau tautan laporan permanen.
- Audio bukan file rekaman; kualitas dan ketersediaan bergantung pada voice browser/device.
- Variasi dakuten/handakuten bukan kartu mandiri, sehingga progress dan audio tidak dapat dinilai per variasi.
- Update progress di UI bersifat optimistik dan hasil error action tidak ditampilkan kembali kepada user.
- Progress hanya counter agregat dan belum masuk ke modul Analytics/Progress utama.

## File Utama

- `src/features/kana/data/kana.ts`
- `src/features/kana/actions.ts`
- `src/features/kana/components/kana-page.tsx`
- `src/features/kana/components/kana-study-grid.tsx`
- `src/features/kana/quiz/engine.ts`
- `src/features/kana/quiz/use-kana-quiz.ts`
- `src/features/kana/quiz/kana-quiz.tsx`
- `src/features/kana/quiz/quiz-results.tsx`
- `src/features/kana/quiz/image-export.ts`
- `src/features/kana/kotoba/data.ts`
- `src/features/kana/kotoba/engine.ts`
- `src/features/kana/kotoba/use-kotoba-quiz.ts`
- `src/features/kana/kotoba/kotoba-quiz.tsx`
- `src/features/kana/kotoba/kotoba-results.tsx`
- `src/features/kana/kotoba/image-export.ts`
- `src/features/study/lib/tts.ts`
