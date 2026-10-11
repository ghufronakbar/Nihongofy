# Pipeline Transkrip dan Pembahasan CHOUKAI

Dokumen ini mendefinisikan target pipeline. Schema, kontrak fixture, importer, dan ekstraktor OCR
sudah tersedia; panggilan OCR nyata dan generator pembahasan tetap harus diuji pada satu paket N5
sebelum dipakai massal.

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

Nama folder mengikuti nama fixture tanpa `.json`. Contoh menjalankan ekstraksi:

```bash
npm run choukai:transcript:extract -- --file n5-2018-07.json --dry-run
npm run choukai:transcript:extract -- --file n5-2018-07.json --limit 1
npm run choukai:transcript:extract -- --file n5-2018-07.json
```

Default model adalah `ag/gemini-3.8-flash`, default reasoning effort `high`, dan setiap request
memuat maksimal empat halaman dengan satu halaman overlap. `--limit 1` cocok untuk pilot biaya dan
format respons sebelum seluruh dokumen diproses.

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

## Audit staging dan penerapan

Hasil OCR ditulis ke:

```text
data/generated/choukai-transcripts/<package-slug>/extraction.json
```

Sebelum diterapkan, audit dan perbaiki `merged.entries`, lalu pastikan `merged.conflicts`,
`merged.missing`, dan `merged.unassigned` semuanya kosong. Setelah selesai, ubah metadata review:

```json
{
  "review": {
    "status": "APPROVED",
    "reviewedAt": "2026-10-12T12:00:00+07:00"
  }
}
```

Kemudian jalankan berurutan:

```bash
npm run choukai:transcript:apply -- --file n5-2018-07.json --check
npm run choukai:transcript:apply -- --file n5-2018-07.json
npm run seed:question-transcript:check -- --file n5-2018-07.json
npm run seed:question-transcript -- --file n5-2018-07.json
```

`apply` hanya mengubah fixture lokal. `seed:question-transcript` baru melakukan upsert ke database.
Keduanya tidak mengubah ID soal, attempt, practice, report, media, kunci, atau pembahasan.

## Batas keamanan data

- Transkrip tidak disimpan di `questionText` atau `QuestionContext.storyText` karena kedua field
  tersebut dapat tampil kepada peserta.
- Transkrip memakai relasi 1:1 `QuestionAudioTranscript`, dengan teks dan metadata audit seperti
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

1. [Selesai] Finalkan kontrak fixture dan schema relasi transkrip.
2. [Selesai] Buat migration dan importer transkrip yang aman.
3. Terapkan migration dan verifikasi tabel baru kosong serta tidak dapat diakses role Data API.
4. [Selesai] Buat ekstraktor PDF/PNG ke staging dan jalur apply reviewed ke fixture.
5. Uji panggilan OCR nyata pada satu batch paket N5.
6. Audit hasil pilot, terapkan ke fixture, lalu sinkronkan ke database.
7. Uji kemampuan audio multimodal gateway pada satu soal tanpa menulis pembahasan.
8. Buat generator pembahasan CHOUKAI dan jalankan pilot kecil sebelum dipakai per level.
