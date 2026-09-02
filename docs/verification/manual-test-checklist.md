# Checklist Pengujian Manual

Checklist ini adalah acceptance gate untuk perubahan aplikasi. Salin bagian yang relevan ke catatan
perubahan, isi hasil aktual, dan lampirkan bukti untuk setiap kegagalan. Jangan menandai flow lulus
hanya karena halaman berhasil dirender.

## Identitas Eksekusi

| Field | Nilai |
|---|---|
| Perubahan/commit | |
| Environment dan URL | |
| Tanggal dan tester | |
| Browser + viewport | |
| Akun/data uji | |
| Flow terdampak | |
| Migration/seed yang dijalankan | Tidak ada / jelaskan |

Status per skenario: `PASS`, `FAIL`, `BLOCKED`, atau `NOT RUN`.

## Pemeriksaan Umum

- [ ] Loading, empty, error, retry, guest, dan authenticated state yang relevan memiliki hasil jelas.
- [ ] Refresh, browser back, tab ganda, dan koneksi putus tidak merusak data atau ownership.
- [ ] User A tidak dapat membaca atau mengubah data milik User B dengan mengganti ID pada URL/input.
- [ ] Tidak ada password, cookie, token, answer key, explanation, atau data pribadi di response error/log.
- [ ] Tampilan diperiksa pada mobile (lebar sekitar 390 px) dan desktop (lebar minimal 1280 px).
- [ ] Console browser tidak memiliki error baru dan request gagal memberi pesan yang dapat ditindaklanjuti.

## Register dan Login

Prasyarat: satu email baru, satu akun aktif, dan satu akun kedua untuk uji isolasi.

| Skenario | Langkah ringkas | Expected result | Status/bukti |
|---|---|---|---|
| Register valid | Daftar dengan display name, email mixed-case, dan password valid | Akun dibuat sekali, email dinormalisasi, session aktif, redirect internal benar | |
| Register invalid | Kirim field kosong, email invalid, password lemah, dan konfirmasi berbeda | Tidak ada user baru; pesan validasi tidak memuat secret | |
| Register duplicate | Daftar lagi dengan email yang sama dalam casing berbeda | Ditolak dengan pesan generik yang tidak mengungkap detail database | |
| Login valid | Login memakai email dan, bila tersedia, username legacy | Session httpOnly dibuat dan user masuk ke tujuan internal yang aman | |
| Login invalid | Uji identifier tidak ada dan password salah | Keduanya memberi pesan generik yang sama; password tidak tercatat di log | |
| Safe redirect | Isi `next` dengan path internal lalu URL eksternal/protocol-relative | Path internal diterima; tujuan eksternal jatuh ke default aman | |
| Rate limit | Ulangi kegagalan sampai batas tercapai | Request dibatasi dengan retry time; email/IP mentah tidak disimpan atau dilog | |
| Logout | Logout lalu buka route private | Cookie session hilang dan route private kembali ke login | |

## Start Exam

| Skenario | Langkah ringkas | Expected result | Status/bukti |
|---|---|---|---|
| Full mock | Mulai paket sebagai user login | Satu attempt milik user dibuat dan sesi pertama terbuka | |
| Section scope | Mulai latihan satu section | Attempt hanya memuat section pilihan dan memakai virtual session 1 | |
| Guest | Mulai paket tanpa login | Tidak ada row attempt user; scope guest tetap valid setelah refresh | |
| URL invalid | Ubah attempt ID, session, dan `questionNumber` | ID asing/invalid tidak terbuka; nomor soal fallback secara aman | |
| Refresh/tab | Jawab dan flag beberapa soal, refresh, lalu buka tab kedua | Draft tidak hilang diam-diam dan konflik tidak menghasilkan state menyesatkan | |
| Exam projection | Inspeksi payload sesuai audit leakage | Tidak ada `questionAnswer`, `correctAnswer`, atau `explanation` | |

## Submit Exam

| Skenario | Langkah ringkas | Expected result | Status/bukti |
|---|---|---|---|
| Submit normal | Isi campuran benar, salah, blank, dan flag lalu submit | Jawaban scope aktif tersimpan tepat sekali dan navigasi menuju sesi/result yang benar | |
| Payload rusak | Kirim duplicate, missing, foreign question ID, atau choice invalid | Server menolak payload; tidak ada partial write atau perubahan denominator | |
| Retry/tab ganda | Kirim request sama dua kali dan payload berbeda setelah final | Retry identik konsisten; final state tidak dapat ditimpa | |
| Session lama | Coba submit kembali sesi yang sudah final | Request ditolak/diarahkan tanpa mengubah jawaban final | |
| Last session | Submit sesi terakhir | Attempt menjadi `COMPLETED`, `finishedAt` terisi, cache consumer terbarui | |

Catatan: invariant submit penuh dan idempotency adalah gate Fase 3. Jika skenario ini gagal pada baseline
sekarang, catat sebagai bug sesuai severity; jangan mengubah expected result menjadi perilaku yang salah.

## Result

| Skenario | Langkah ringkas | Expected result | Status/bukti |
|---|---|---|---|
| Ownership/status | Buka result sendiri, attempt user lain, dan attempt belum selesai | Hanya result completed milik user yang dapat dibuka | |
| Summary | Bandingkan benar/salah/blank/flag dengan data submit | Semua total dan denominator sesuai expected question set | |
| Score copy | Periksa label score dan disclaimer | Disebut proyeksi aplikasi, bukan skor/sertifikat resmi JLPT | |
| Detail | Buka review setiap mondai | Jawaban user, kunci, explanation, furigana, dan comment tampil pada scope review | |
| Refresh | Refresh summary dan detail | Hasil stabil dan tidak membuat write baru | |

## Practice

| Skenario | Langkah ringkas | Expected result | Status/bukti |
|---|---|---|---|
| Assignment | Pilih level/section/mondai/jumlah | Jumlah soal sesuai pilihan, unik, dan urutannya stabil setelah refresh | |
| Before answer | Inspeksi payload awal dan soal berikutnya | Tidak ada answer key atau explanation untuk soal yang belum dijawab | |
| First answer final | Jawab satu soal, lalu coba jawab ulang | Feedback hanya untuk soal itu dan jawaban pertama tidak tertimpa | |
| Membership | Kirim question ID di luar assignment atau choice invalid | Server menolak tanpa membuka answer key | |
| Completion | Selesaikan seluruh assignment | Count benar, answered, dan status completed sesuai data server | |
| Guest/user | Jalankan sebagai guest dan user login | Copy persistence jujur; data user tersimpan hanya pada owner yang benar | |

## Vocabulary Review

| Skenario | Langkah ringkas | Expected result | Status/bukti |
|---|---|---|---|
| Queue | Buka deck dengan kartu due dan baru | Due tampil lebih dahulu; limit harian dan urutan deck dipatuhi | |
| Rating | Uji Again, Hard, Good, dan Easy | Satu log review dan satu update progress terjadi secara konsisten | |
| Refresh | Rating lalu refresh/buka deck lain berisi kartu sama | Progress kartu tetap konsisten lintas deck | |
| Boundary | Kirim rating invalid, kartu asing, atau kartu belum due | Server menolak dan progress tidak berubah | |
| Guest | Buka deck tanpa login | Browse tersedia sesuai produk; tidak ada klaim progress tersimpan | |

## Kana Review

| Skenario | Langkah ringkas | Expected result | Status/bukti |
|---|---|---|---|
| Browse/filter | Uji hiragana dan katakana, search, serta filter grup | Hasil dan empty state benar pada mobile/desktop | |
| Review | Flip lalu nilai Correct/Again | Counter user naik sekali dan kartu berikutnya tetap responsif | |
| Concurrent event | Flip dan grade cepat/berulang | Upsert tidak kehilangan increment | |
| Invalid key | Kirim stable key yang tidak dikenal | Server menolak tanpa membuat row | |
| Guest | Review tanpa login | UI tetap berfungsi, tetapi tidak menulis progress database | |

## Article Detail

| Skenario | Langkah ringkas | Expected result | Status/bukti |
|---|---|---|---|
| Published detail | Buka artikel published dari index/search | Body terstruktur, metadata, cover, dan related article benar | |
| Unavailable slug | Buka slug tidak ada/draft/future | Menghasilkan not-found tanpa membocorkan draft | |
| Save/favorite | Toggle sebagai user lalu refresh | State dan count konsisten, terisolasi antar-user | |
| Guest action | Coba save/favorite tanpa session | Ditolak atau diarahkan login tanpa write | |
| Share/copy | Uji native share dan fallback copy | URL canonical benar dan failure memiliki feedback | |

## Profile

| Skenario | Langkah ringkas | Expected result | Status/bukti |
|---|---|---|---|
| Overview | Bandingkan statistik dengan aktivitas user | Count memakai data owner dan definisi aktivitas yang terdokumentasi | |
| Update info | Ubah display name/email valid dan invalid | Nilai dinormalisasi; duplicate/invalid ditolak tanpa partial update | |
| Avatar | Upload format/ukuran valid dan invalid | Hanya folder milik user disetujui; asset asing tidak dapat diklaim | |
| Change password | Uji current password salah, password sama, dan password valid | Hanya kasus valid mengubah hash dan merotasi session | |
| Isolation | Ubah ID/input dengan akun kedua | Profile, settings, dan statistik user lain tidak terbaca/berubah | |

## Audit Answer-Key Leakage

Jalankan audit ini setiap kali query Prisma, Server Action, Route Handler, serializer, atau cache soal
berubah. Gunakan DevTools Network dan periksa document/RSC payload serta response Server Action.

- [ ] Saat exam belum disubmit, pencarian response untuk `questionAnswer`, `correctAnswer`,
  `answerKey`, dan `explanation` tidak menemukan field atau nilai kunci.
- [ ] Saat practice baru dibuka, semua soal belum dijawab tidak membawa field/nilai tersebut.
- [ ] Setelah satu soal practice dijawab, hanya feedback soal itu yang berisi kunci dan explanation;
  soal lain tetap bersih.
- [ ] Mengubah question ID, assignment ID, attempt ID, session, atau cache state tidak membuka kunci
  di luar scope user/soal yang sah.
- [ ] Guest dan authenticated mode diuji terpisah, termasuk refresh dan tab kedua.
- [ ] Log server dan response error tidak memuat kunci, explanation, selected answer, atau payload
  `answers`.
- [ ] Mode baca dan result boleh membuka kunci sesuai keputusan produk, tetapi response exam tetap
  berasal dari projection yang berbeda.

Jika satu saja pemeriksaan leakage gagal, klasifikasikan sebagai `P0`, hentikan release, simpan bukti
tanpa menyalin answer key ke kanal publik, dan ikuti prosedur incident.

## Handoff Hasil

| Flow | Status | Ringkasan hasil aktual | Bug/incident | Bukti |
|---|---|---|---|---|
| Register/login | NOT RUN | | | |
| Start exam | NOT RUN | | | |
| Submit | NOT RUN | | | |
| Result | NOT RUN | | | |
| Practice | NOT RUN | | | |
| Vocabulary | NOT RUN | | | |
| Kana | NOT RUN | | | |
| Article detail | NOT RUN | | | |
| Profile | NOT RUN | | | |
| Answer-key leakage | NOT RUN | | | |

