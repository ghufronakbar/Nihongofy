# Tebak Kotoba Minna no Nihongo — verifikasi 29 Oktober 2026

## Implementasi

- Route publik `/kana/kotoba` (opsional `?bab=1`–`?bab=5`), CTA "Tebak Kotoba" di hero halaman hiragana/katakana, dan entri sitemap. Route mengikuti `FEATURES.kana` dari layout induk; tidak ada flag baru.
- 253 kosakata Bab 1–5 ditranskripsi dari "Kosakata minna no nihongo 1 Bab 1-25.pdf". Teks PDF memakai encoding font rusak, sehingga transkripsi dibaca dari render halaman 1–9 dan koreksinya dicatat di kepala `src/features/kana/kotoba/data.ts`.
- Pengaturan: nickname, satu atau beberapa bab, depan kartu kana atau kanji, dan 10/20/semua soal. Depan kartu menampilkan kata; setelah memilih satu dari empat arti, kartu dibalik ke bagian belakang lengkap (kana, kanji, arti, catatan, TTS).
- Hasil: skor, akurasi, waktu, rincian per bab, daftar kata salah, tabel jawaban, "Ulangi N kata ini", dan "Main lagi". Tidak ada perubahan database atau action.

## Pemeriksaan otomatis

- `npx vitest run src/features/kana/`: **26 lulus** (15 baru untuk Tebak Kotoba). Menguji jumlah kata per bab, key unik, referensi grup, konflik untuk arti/tulisan depan yang sama, fallback kanji → kana, cakupan setiap kata per bab dengan empat pilihan tanpa konflik (8 putaran acak per bab), prioritas pengecoh sejenis, batas jumlah soal dan gabungan bab, ulang kata tertentu, penguncian jawaban, waktu baca tidak dihitung, hasil per bab, restore saat kartu belakang terbuka, serta snapshot rusak.
- `npm test -- --maxWorkers=2`: **62 file, 776 tes lulus**.
- `npm run lint` dan `npm run typecheck`: lulus.
- `next build` (env dummy, tanpa database): kompilasi dan TypeScript lulus; build berhenti saat prerender `/sitemap.xml` karena `prisma.article.findMany()` tidak dapat menjangkau database. Kegagalan ini berasal dari lingkungan verifikasi, bukan dari route baru. Build produksi penuh perlu dikonfirmasi di CI/Vercel.
- Dependency `xlsx` (cdn.sheetjs.com) diblokir jaringan lingkungan verifikasi; untuk pemeriksaan lokal dipasang `xlsx@0.18.5` dari npm tanpa mengubah `package.json`/lockfile.

## Pemeriksaan tampilan

- Chromium (Playwright) desktop 1280 px: validasi nickname kosong, pilih Bab 1 + 2, depan kanji, 10 soal; jawab dengan keyboard 1–4, lanjut dengan Enter, refresh di soal ke-4 memulihkan kartu belakang yang sedang terbuka, halaman hasil tampil, dan "Ulangi 7 kata ini" membuka sesi 7 soal. Tidak ada error konsol atau page error.
- Viewport 390 px: form, kartu depan/belakang, dan pilihan tampil tanpa scroll horizontal (`scrollWidth` 390).
- Contoh tampilan: [kartu belakang desktop](evidence/2026-10-29-kotoba-quiz-back.png) dan [kartu belakang HP](evidence/2026-10-29-kotoba-quiz-mobile.png).

## Batas verifikasi

- Arti dan catatan perlu ditinjau pengajar, terutama kata yang dikoreksi dari PDF (きょうし, はじめまして, そちら Bab 4, びじゅつかん, ほんのきもちです).
- TTS bergantung pada voice browser; belum diuji di perangkat nyata.
- UAT lanjutan: selesaikan satu bab penuh di HP dan desktop, uji mode kanji untuk Bab 4–5, dan uji tombol Dengar di perangkat yang memiliki voice Jepang.

## Tambahan: opsi lewati (29 Oktober 2026)

- `npx vitest run src/features/kana/`: **27 lulus**, termasuk tes lewati: kunci dibuka tanpa pilihan, tidak bisa melewati kata yang bukan soal aktif atau dua kali, snapshot dengan `selectedKey: null` dipulihkan, serta hasil menghitung benar/dilewati dan memasukkan kata dilewati ke daftar ulang.
- Chromium desktop, Bab 4, 10 soal: satu kata dilewati lewat tombol dan satu lewat keyboard `L`; kartu belakang berwarna kuning dengan label "Dilewati", hasil menampilkan Salah 5 dan Dilewati 2, dan "Ulangi 7 kata ini" mencakup keduanya. Tidak ada error konsol.

## Tambahan: timer per kata (29 Oktober 2026)

- `npx vitest run src/features/kana/`: **32 lulus**, termasuk tes timer: validasi 3–300 detik bulat atau tanpa batas, sisa waktu, waktu habis tepat di batas, jawaban terlambat dicatat waktu habis, pemisahan dilewati/waktu habis di hasil, snapshot dengan waktu melebihi batas ditolak, dan sesi lama tanpa field timer tetap dipulihkan.
- Chromium desktop, Bab 5, 10 soal, timer 4 detik: input 2 dan kosong menampilkan "Minimal 3 detik." dan "Isi batas waktu dalam detik." (form memakai `noValidate` agar pesan aplikasi yang tampil, bukan tooltip browser). Hitung mundur tampil, kata pertama otomatis dibalik "Waktu habis", refresh di tengah soal tetap berakhir waktu habis setelah batas, dan hasil menampilkan kolom Waktu habis serta badge "Timer 4 dtk". Viewport 390 px tanpa scroll horizontal; tidak ada error konsol.

## Tambahan: Bab 6–10 (31 Oktober 2026)

- 256 kosakata baru (Bab 6: 54, Bab 7: 48, Bab 8: 57, Bab 9: 50, Bab 10: 47) ditranskripsi dari halaman 10–16 PDF yang sama; baris yang tumpang tindih di PDF diperiksa ulang pada render 300 dpi. Total 509 kata.
- Koreksi PDF: おそがしい → いそがしい, スボーン → スポーツ, kanji やさしい 優しい → 易しい (arti "mudah"), ーだんめ → 〜だんめ, salah ketik arti ("dai", "sumah", "walfiat", "perempeuan").
- Grup konflik ditambah untuk arti yang bertumpuk lintas bab, termasuk tulisan sama dengan arti berbeda (あります Bab 9/10, 〜から Bab 4/9, すみません Bab 3/9). Skrip pemeriksaan sinonim bersama menyisakan 11 pasangan yang memang kontras belajar (ちち/おとうさん, さむい/つめたい, います/あります, dan variasi "permisi" dengan konteks berbeda).
- Batas jumlah soal pada skema sesi sebelumnya 500, sehingga "Semua" Bab 1–10 (509 kata) tidak akan bisa dipulihkan setelah refresh. Batas kini mengikuti jumlah kata di data; tes memulihkan sesi 509 soal.
- `npx vitest run src/features/kana/`: **37 lulus**, termasuk cakupan per bab untuk Bab 6–10 (8 putaran acak per bab, empat pilihan tanpa konflik).

## Tambahan: Bab 11–15 (31 Oktober 2026)

- 296 kosakata baru (Bab 11: 62, Bab 12: 50, Bab 13: 61, Bab 14: 73, Bab 15: 50) dari halaman 17–26 PDF. Total 805 kata.
- Koreksi PDF: オフト → ソフト, みんなさん → みなさん, ーかい/ーだい dan sejenisnya → 〜, arti 〜ちゃく ("berangkat ke ~" → "tiba di ~"), こうむいん ("pegawai kantor" → "pegawai negeri"). Bab 11 No. 6 かいしゃを〜 (kolom arti kosong) digabung ke No. 5 menjadi やすみます（かいしゃを〜）.
- Bab 13–15 memuat kosakata referensi yang sudah ada di bab lain (だいがく, スーパー, デパート, びじゅつかん, としょかん, でんき, きゅうこう, とっきゅう, ふつう, じこくひょう, しやくしょ, こうこう, すみません, みなさん, かいしゃいん, ぎんこういん, きょうし, けんきゅうしゃ, エンジニア). Semuanya ditandai konflik dengan pasangannya agar tidak muncul sebagai pengecoh satu sama lain; tes kesamaan tulisan/arti memastikannya.
- Skrip sinonim bersama menyisakan pasangan kontras yang disengaja (〜さい/〜ねん, 〜がつ/〜かげつ, どれ/どちら, あに/おにいさん dan pasangan saudara lain, おてら/じんじゃ, あります/います).
- `npx vitest run src/features/kana/`: **42 lulus**, termasuk cakupan per bab untuk Bab 11–15 dan pemulihan sesi "Semua" Bab 1–15 (805 soal).

## Tambahan: Bab 16–20 (31 Oktober 2026)

- 230 kosakata baru (Bab 16: 51, Bab 17: 83, Bab 18: 46, Bab 19: 34, Bab 20: 16) dari halaman 27–35 PDF. Total 1.035 kata.
- Koreksi PDF: げりがします → げりをします, かぜをひき → かぜをひきます, arti いちども ("sekali-sekali" → "belum pernah sekali pun", dengan bentuk negatif), このあいだ ("tempo akhir" → "tempo hari"), おちゃ Bab 19 ("the" → "teh, upacara minum teh").
- Kana sama dengan arti berbeda ditandai konflik: はな 鼻/花, かみ 髪/紙, とぶ 飛ぶ/跳ぶ (dalam Bab 18), おちゃ Bab 6/19, それから Bab 6/11/17. Bagian tubuh Bab 17 yang mengulang Bab 16 (かお, め, みみ, あたま, dst.) ditandai konflik dengan pasangannya.
- Bab 20 hanya 16 kata; pilihan "20 kata" menghasilkan 16 soal (seluruh bab), sesuai batas engine.
- `npx vitest run src/features/kana/`: **47 lulus**, termasuk cakupan per bab untuk Bab 16–20.

## Tambahan: Bab 21–25 (1 November 2026)

- 136 kosakata baru (Bab 21: 40, Bab 22: 20, Bab 23: 29, Bab 24: 17, Bab 25: 30) dari halaman 36–40 PDF. Total 1.171 kata; seluruh isi PDF Bab 1–25 kini tercakup.
- Koreksi PDF: おしいれ 押し入れ ("kulkas" → lemari dinding tempat futon), おく 億 ("ratusan juta" → seratus juta), kanji ちゅうしゃじょう 駐車所 → 駐車場, かえます 変えます ("menukar" → mengubah), ろうじん ("orang tua" → lansia, agar tidak tertukar dengan りょうしん).
- Tulisan sama dengan arti berbeda ditandai konflik: きます 着ます/来ます, はし 橋/箸, ひきます 引きます/弾きます, かえます 変えます/換えます, おくります "mengantar"/"mengirim", おく 億/奥, よく Bab 9/22. Daftar sekolah Bab 21 dan 25 yang mengulang Bab 13 (ようちえん–だいがく) ditandai konflik dengan pasangannya.
- `npx vitest run src/features/kana/`: **52 lulus**, termasuk cakupan per bab untuk Bab 21–25.

## Penyelarasan dengan daftar kosakata revisi (1 November 2026)

- Repo materi kini memakai `kosakata/kosakata-bab-01-25.md` (1.173 baris) sebagai satu-satunya sumber kosakata; PDF scan lama dihapus. Data dibandingkan baris per baris dengan skrip sekali pakai (kana, kanji, jumlah baris, dan arti).
- Kana dan kanji: semua 43 koreksi kanji/bacaan di `catatan-koreksi.md` sudah sama dengan data. Sisa perbedaan hanya format yang disengaja (konteks partikel pada kata kerja berkana sama, tanpa kurung di depan kartu, どの〜, トイレ（お手洗い）, おいのり tanpa （〜をします） yang dipindah ke catatan).
- Disamakan dengan daftar: Bab 1 No. 26 おいくつ menjadi entri sendiri (sebelumnya digabung ke なんさい); kanji Bab 8 No. 53 （〜、）もう一杯いかがですか; カレーライス; エアメール／こうくうびん; おしょうがつ／お正月 Bab 23.
- Arti yang dikoreksi di daftar revisi dan kini disamakan: かぜ / かぜをひきます (flu, pilek), たな (rak), せいさんき (mesin penyesuaian tarif), せ (tinggi badan, punggung), さかだちします (berdiri dengan tangan), らくご, ほいくえん (daycare), まち 町 (kota kecil), かいちょう (ketua (dewan) perusahaan), こしょう (catatan こしょうしています), いれます (membuat, menyeduh), だいがくいん (S2/S3), がくし (gelar sarjana), びじゅつかん (galeri seni). かぜ kini ditandai konflik dengan インフルエンザ dan はなみずがでます.
- Tetap berbeda dari daftar (dipertahankan): ろうじん "lansia" (daftar: "orang tua", tertukar dengan りょうしん), ふとん "futon (kasur dan selimut ala Jepang)" (daftar: "selimut berisi kapas"), dan ejaan KBBI. Bab 11 No. 6 tetap digabung karena kolom artinya kosong di daftar.
- Total 1.172 kata (Bab 1: 45). `npx vitest run src/features/kana/`: **52 lulus**.

## Tambahan: pilihan kata inti (1 November 2026)

- Setiap kata kini punya `kind`: `inti`, `referensi` (kosakata referensi bertema di ekor Bab 13–25), atau `nama` (nama diri dari latihan). Hasilnya 942 kata inti, 209 referensi, dan 21 nama diri. Rincian per bab ada di `docs/module/kana.md`, bagian "Kata inti dan kata tambahan".
- Form punya pilihan "Kata yang diuji: Semua kata / Inti saja", dan `?cakupan=inti` bisa dipakai untuk memilihnya lewat URL. Setup dan sesi menyimpan `scope`; sesi lama tanpa `scope` dipulihkan sebagai semua kata.
- `npx vitest run src/features/kana/kotoba`: **69 lulus**. Tesnya mencakup jumlah inti/referensi/nama per bab, referensi selalu di ekor daftar bab, dan sesi inti setiap bab (empat pilihan, semuanya kata inti dan tanpa konflik, bisa dipulihkan). Juga diuji: sesi lama tanpa `scope`, serta snapshot inti yang disisipi kata referensi ditolak. Seluruh suite: **866 lulus**; `tsc --noEmit` dan ESLint bersih.
- Browser (Playwright, dev server): `?bab=13&cakupan=inti` membuka form dengan "Inti saja" terpilih, Bab 13 "29 kata", dan "Semua (29)". Pindah ke "Semua kata" mengubahnya menjadi 61. Sesi inti Bab 13 berjalan 29 kartu tanpa kata referensi (はくぶつかん, デパート, モスク, コンビニ tidak muncul), dan hasilnya memuat badge "Kata inti". Di sesi semua kata Bab 15, kartu はいゆう memuat label "Kata tambahan · referensi: pekerjaan". Lebar 375 px tanpa scroll horizontal; konsol tanpa error.
- Bukti: `evidence/2026-11-01-kotoba-inti-setup.png` (form) dan `evidence/2026-11-01-kotoba-inti-back.png` (label kata tambahan di belakang kartu).
