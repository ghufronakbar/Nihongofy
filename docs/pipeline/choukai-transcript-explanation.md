# Pipeline Transkrip dan Pembahasan CHOUKAI

Dokumen ini mendefinisikan target pipeline. Script dan schema transkrip belum dibuat; implementasi
harus dilakukan bertahap dan diuji pada satu paket N5 sebelum dipakai massal.

## Status audio

- Seluruh paket N5 dan N4 yang sudah diproses memiliki `Question.questionAudio` per soal.
- N3, N2, dan N1 masih dimigrasikan bertahap dan dapat memakai
  `QuestionContext.storyAudio` per mondai.
- Selama transisi, `questionAudio` adalah sumber utama; `storyAudio` hanya fallback bila soal
  belum memiliki klip individual.
- Audio context lama tidak dihapus sampai seluruh soal dalam paket lolos pemeriksaan durasi,
  metadata objek R2, dan SHA-256 readback dari CDN publik.

## Sumber lokal

Simpan dokumen sumber di folder yang sudah diabaikan Git:

```text
data/sources/choukai-transcripts/
├── N5/
│   └── n5-2018-07/
│       └── transcript.pdf
├── N4/
├── N3/
├── N2/
└── N1/
```

PDF lebih disukai untuk dokumen banyak halaman karena urutan halaman terjaga. PNG diterima untuk
halaman tunggal atau potongan yang lebih jelas daripada PDF. PDF dirender menjadi gambar 250-300
DPI sebelum dikirim ke model; file sumber asli tidak diunggah ke R2 dan tidak masuk Git.

## Urutan kerja

1. Script ekstraksi membaca PDF/PNG dan menghitung SHA-256 sumber.
2. Setiap halaman dikirim ke gateway memakai `ag/gemini-3.8-flash` dengan reasoning effort
   `high`.
3. Model hanya menyalin teks Jepang dan mengelompokkannya berdasarkan paket, `mondaiType`, dan
   nomor soal. Hasil ditulis ke `data/generated/choukai-transcripts/`, bukan fixture atau
   database. Folder staging ini diabaikan Git.
4. Manusia mengaudit teks, urutan soal, label pembicara, pertanyaan yang diucapkan, dan pilihan
   audio.
5. Hanya entri yang sudah ditandai reviewed yang boleh diterapkan ke fixture lokal.
6. Importer transkrip melakukan upsert in-place ke database dengan pasangan
   `nama paket -> mondaiType -> order soal`; ID soal, attempt, practice, report, media, dan kunci
   jawaban tidak berubah.
7. Generator pembahasan khusus membaca transkrip reviewed lalu mengirim transkrip, audio per
   soal, gambar soal/context, gambar pilihan, teks pilihan, serta kunci resmi ke model.
8. Pembahasan diaudit di fixture sebelum diimpor melalui jalur
   `seed:question-explanation` yang sudah ada.

## Batas keamanan data

- Transkrip tidak disimpan di `questionText` atau `QuestionContext.storyText` karena kedua field
  tersebut dapat tampil kepada peserta.
- Target schema adalah relasi 1:1 terpisah dari `Question`, dengan teks dan metadata audit seperti
  model, versi prompt, waktu generate, dan waktu review.
- Query ujian, Latihan Cepat, hasil, dan diskusi tidak boleh memilih relasi transkrip. Akses awal
  hanya untuk script offline dan halaman admin/audit.
- Menyembunyikan elemen di komponen client tidak cukup; transkrip tidak boleh ikut masuk payload
  Server Component atau Server Action publik.

## Guard wajib

- Jumlah hasil OCR harus sama dengan jumlah soal target atau proses berhenti.
- `mondaiType` dan nomor soal harus unik serta ada di fixture.
- Hasil OCR tidak boleh langsung mengubah fixture/database.
- Generator pembahasan harus gagal secara eksplisit bila audio atau gambar yang diwajibkan tidak
  berhasil dikirim; tidak boleh diam-diam berargumen hanya dari kunci jawaban.
- Semua script harus resumable, idempotent, memiliki mode check/dry-run, dan menulis file secara
  atomik.

## Urutan implementasi

1. Finalkan kontrak fixture dan schema relasi transkrip.
2. Buat migration dan importer transkrip yang aman, lalu verifikasi database kosong untuk relasi
   baru.
3. Buat ekstraktor PDF/PNG ke staging dan uji pada satu paket N5.
4. Audit hasil pilot, terapkan ke fixture, lalu sinkronkan ke database.
5. Uji kemampuan audio multimodal gateway pada satu soal tanpa menulis pembahasan.
6. Buat generator pembahasan CHOUKAI dan jalankan pilot kecil sebelum dipakai per level.
