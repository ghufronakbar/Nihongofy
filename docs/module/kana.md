# Modul Kana

## Status Aktual

**Pengenalan, self-review, Quiz 46 Kana, dan Tebak Kotoba Minna no Nihongo Bab 1–5 tersedia.** Hiragana dan katakana berasal dari fixture terkurasi; kosakata Tebak Kotoba ditranskripsi dari daftar kosakata Minna no Nihongo I milik pengajar. Kedua quiz berjalan seluruhnya di browser tanpa login atau penyimpanan database; progress kartu belajar untuk akun tetap memakai counter per kartu.

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
- `/kana/kotoba` (opsional `?bab=1`–`?bab=5` untuk bab awal)

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

- 253 kosakata Minna no Nihongo I Bab 1–5 (44, 47, 44, 59, 59 kata). Pengaturan: nickname 1–32 karakter, satu atau beberapa bab, tampilan depan kartu (hiragana/katakana atau kanji), dan jumlah soal 10, 20, atau semua kata pada bab terpilih.
- Mode kanji memakai kolom kanji daftar sumber; kata tanpa kanji (kata ganti, katakana, ungkapan) tetap tampil dalam kana dan label kartu ikut menjadi "Kana".
- Depan kartu menampilkan kata, siswa memilih satu dari empat arti. Setelah memilih, kartu dibalik: bagian belakang memuat kana, kanji, arti, catatan pemakaian, tombol dengar (TTS), serta penanda benar/salah. Kartu berikutnya dibuka dengan tombol "Lanjut" atau Enter; keyboard 1–4 untuk memilih.
- Pengecoh diambil berurutan dari kelompok kata sejenis (`KOTOBA_FAMILIES`, mis. nama hari, tanggal, kosoado, alat transportasi), lalu dari bab yang sama, lalu dari bab lain yang dipilih. Kata yang artinya bertumpuk atau tulisannya sama (`KOTOBA_CONFLICTS`, mis. せんせい/きょうし, いいえ/ちがいます, そちら Bab 3/Bab 4) tidak pernah muncul bersama dalam satu soal.
- Waktu dihitung sejak depan kartu tampil sampai arti dipilih; waktu membaca bagian belakang tidak dihitung.
- Hasil menampilkan skor/akurasi, total dan rata-rata waktu, rincian per bab bila memilih lebih dari satu bab, daftar kata yang perlu diulang, dan tabel semua jawaban. "Ulangi N kata ini" memulai sesi baru hanya dari kata yang salah; "Main lagi" mengacak ulang dengan pengaturan yang sama.

## Data dan Persistence

- Konten kana adalah fixture kode di `src/features/kana/data/kana.ts`, bukan tabel content database.
- Untuk user login, `KanaProgress` menyimpan `viewCount`, `correctCount`, `againCount`, dan timestamp.
- Untuk guest, UI tetap bisa dipakai tetapi data hanya hidup di state halaman dan hilang saat refresh.
- Data progress divalidasi terhadap daftar stable `kanaKey` yang dikenal aplikasi.
- Quiz memakai `sessionStorage` dengan key `nihongofy:kana-quiz:v1`, terpisah dari progress kartu belajar, termasuk untuk siswa yang sedang login. Tidak ada action atau query database untuk hasil quiz.
- Kosakata Tebak Kotoba adalah fixture kode di `src/features/kana/kotoba/data.ts`, ditranskripsi dari "Kosakata minna no nihongo 1 Bab 1-25.pdf". Koreksi terhadap PDF dicatat di kepala file (mis. らいげつ 来週 → 来月, penanda angka `ー` → `〜`, arti きょうし dan はつか). Key kata (`bab-<bab>-<no>`) mengikuti nomor baris PDF; jangan diubah karena dipakai snapshot sesi.
- Sesi Tebak Kotoba memakai `sessionStorage` key `nihongofy:kotoba-quiz:v1` dan divalidasi Zod: bab terpilih, keunikan soal, empat pilihan tanpa konflik arti, urutan jawaban, dan timestamp. Refresh saat bagian belakang kartu terbuka tetap memulihkan kartu tersebut.
- Snapshot quiz divalidasi dengan Zod: jumlah/keunikan kana, script, pilihan, urutan jawaban, dan konsistensi timestamp. Refresh mempertahankan timer soal, jawaban, serta hasil; tutup tab mengakhiri penyimpanan sementara.
- Jika penyimpanan browser ditolak, quiz tetap berjalan di memori dan UI mengingatkan agar tidak refresh serta mengunduh hasil.
- Ekspor memakai Canvas browser tanpa dependency tambahan atau upload. Nickname dan jawaban tidak dimasukkan ke URL.

## Keterbatasan Aktual

- Bukan SRS: tidak ada due date, interval, random queue, atau jadwal review.
- Tidak ada latihan menulis/drawing, digraph yoon seperti `きゃ`, atau kata contoh. Quiz hanya menguji 46 kana dasar, belum dakuten/handakuten.
- Tebak Kotoba baru mencakup Bab 1–5 dan satu arah (kata → arti). Belum ada arah arti → kata, ekspor gambar hasil, atau progress akun. Arti dan catatan mengikuti daftar sumber yang sudah dirapikan, belum ditinjau ulang oleh pengajar.
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
- `src/features/study/lib/tts.ts`
