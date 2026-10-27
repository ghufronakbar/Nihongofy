# Quiz 46 Kana — verifikasi 27 Oktober 2026

## Implementasi

- Route publik `/kana/quiz`, dengan CTA dari halaman hiragana/katakana dan pilihan awal melalui `?script=`. Seluruh route mengikuti `FEATURES.kana` dari layout induk.
- Nickname bebas 1–32 karakter, hiragana atau katakana, 46 kana dasar tanpa pengulangan, empat pilihan unik, serta pengecoh wajib untuk keluarga bentuk mirip.
- Penguncian jawaban, transisi netral, pembahasan setelah selesai, keyboard 1–4, konfirmasi mulai ulang, dan pemulihan sesi/timer melalui `sessionStorage`.
- Peta seluruh kana, skor dan waktu, daftar kesalahan, tiga jawaban benar paling lambat, serta tabel semua jawaban dengan filter kesalahan.
- Ekspor PNG ringkasan 1080 × 1470 dan laporan lengkap 1080 × 3528. Berbagi memakai file melalui Web Share bila didukung, dengan fallback unduh.
- Tidak ada perubahan database, action penyimpanan, atau integrasi progress akun untuk hasil quiz.

## Pemeriksaan otomatis

- `npx vitest run src/features/kana/quiz/engine.test.ts`: **11 lulus**. Menguji cakupan 46 kana per script, opsi unik, pasangan mirip dua arah, penguncian jawaban, ketepatan/waktu, refresh timer, snapshot rusak, serta kondisi seluruh jawaban benar/salah.
- `npm test -- --maxWorkers=2`: **64 file, 797 tes lulus**. Run pertama dengan paralelisme default saat build bersamaan mengalami satu timeout pada tes navigasi Onigiri Kitchen; run dengan dua worker lulus tanpa perubahan modul tersebut.
- `npm run lint`: lulus.
- `npm run typecheck`: lulus, termasuk setelah perapian tombol dan kontrol dialog mulai ulang.

## Pemeriksaan tampilan dan gambar

- Browser Chrome desktop: route dapat dibuka sebagai guest, form nickname kosong menampilkan pesan validasi, nickname Unicode diterima, dan kartu soal tampil di tengah dengan empat pilihan.
- Progres ke soal kedua berhasil diamati. Kontrol browser native beberapa kali timeout/terlambat memberi state, sehingga alur 46 soal, unduhan browser, Web Share native, dan viewport HP belum dapat diverifikasi penuh lewat UI otomatis.
- Fungsi ekspor aktual dijalankan melalui adapter Canvas Node di direktori sementara, tanpa dependency aplikasi tambahan. Contoh 39/46 benar, tujuh salah, 46 baris, total waktu 237.500 ms. Kedua PNG dirender dan diperiksa secara visual: kana Jepang dan emoji terbaca; tabel sampai nomor 46 serta footer tidak terpotong.
- Contoh gambar: [ringkasan](evidence/2026-10-27-kana-quiz-summary.png) dan [laporan lengkap](evidence/2026-10-27-kana-quiz-report.png). Gambar ini berisi data pengujian.

## Batas verifikasi

- `npm run build` (Turbopack) dan `npm run build -- --webpack` tertahan di tahap kompilasi selama beberapa menit tanpa hasil akhir; mesin menunjukkan tekanan memori/swap tinggi. Dihentikan agar tidak meninggalkan proses build yang membebani mesin. Build produksi belum terkonfirmasi.
- **Release blocker — P1, owner: maintainer proyek.** Verifikasi build produksi menunggu mesin dengan memori yang tersedia atau hasil CI. Keputusan rilis: belum dinyatakan siap sampai build berhasil dan UAT lanjutan di bawah selesai.
- Peringatan hydration Chrome menunjukkan atribut tambahan `bis_skin_checked`/`bis_register` dari ekstensi browser. Tidak ditambahkan `suppressHydrationWarning` pada aplikasi.
- UAT lanjutan: selesaikan masing-masing script di HP dan desktop, refresh di tengah soal, batalkan konfirmasi mulai ulang, periksa unduhan kedua gambar, dan uji Web Share pada perangkat yang mendukung.
