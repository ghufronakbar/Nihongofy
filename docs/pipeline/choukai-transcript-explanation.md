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
halaman tunggal atau potongan yang lebih jelas daripada PDF. PDF dirender dengan sisi terpanjang
maksimal 3000 px sebelum dikirim ke model. Batas piksel dipakai alih-alih DPI tetap agar page box
PDF yang tidak normal tidak menghasilkan gambar sangat besar tanpa tambahan detail. File sumber
asli tidak diunggah ke R2 dan tidak masuk Git.

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
4. Jalankan audit audio per-mondai dengan `gemini/gemini-3.8-flash`. Hasil STT disimpan terpisah
   di `audio-audit.json` dan tidak otomatis menggantikan OCR PDF.
5. Manusia membandingkan kedua sumber, lalu mengaudit teks, urutan soal, label pembicara,
   pertanyaan yang diucapkan, dan pilihan audio. PDF resmi tetap menjadi sumber utama; STT dipakai
   untuk menemukan salah baca atau mengisi bagian yang memang tidak tersedia di PDF.
6. Hanya entri yang sudah ditandai reviewed yang boleh diterapkan ke fixture lokal.
7. Importer transkrip melakukan upsert in-place ke database dengan pasangan
   `nama paket -> mondaiType -> order soal`; ID soal, attempt, practice, report, media, dan kunci
   jawaban tidak berubah.
8. Generator pembahasan khusus membaca transkrip reviewed lalu mengirim tipe mondai, instruksi,
   teks soal/pilihan, kunci resmi, serta seluruh gambar soal/context/pilihan ke model. Audio tidak
   dikirim secara default; `--include-audio` hanya dipakai sebagai eskalasi bila transkrip, gambar,
   dan kunci masih menyisakan konflik.
9. Hasil generator ditulis ke staging pembahasan, diaudit manusia, baru diterapkan ke fixture dan
   diimpor melalui jalur `seed:question-explanation` yang sudah ada.

Contoh audit audio:

```bash
npm run choukai:transcript:audio-audit -- --file n5-2018-07.json --limit 1
npm run choukai:transcript:audio-audit -- --file n5-2018-07.json
```

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

## Pembahasan CHOUKAI

Generator pembahasan memakai model `ag/gemini-3.8-flash`, reasoning effort `high`, dan menulis ke:

```text
data/generated/choukai-explanations/<package-slug>/explanations.json
```

Pilot lintas mondai dapat dijalankan tanpa menulis fixture/database:

```bash
npm run choukai:explanation:generate -- --file n5-2018-07.json --per-mondai 2 --dry-run
npm run choukai:explanation:generate -- --file n5-2018-07.json --per-mondai 2
```

Bila pilot parsial sudah sempat di-approve lalu paket yang sama akan dilanjutkan, buka kembali
staging secara eksplisit. Entry lama dipertahankan dan hanya scope yang belum ada atau dipilih untuk
overwrite yang diproses, sedangkan status review kembali menjadi `PENDING`:

```bash
npm run choukai:explanation:generate -- --file n5-2018-07.json --reopen
```

Setiap gambar diunduh lebih dahulu dan dikirim sebagai data URL. Jika satu gambar gagal diunduh,
soal tersebut gagal secara eksplisit dan model tidak dipanggil tanpa konteks gambar. Transkrip
reviewed menjadi sumber utama. Audio per soal hanya dikirim untuk kasus yang dieskalasikan:

```bash
npm run choukai:explanation:generate -- --file n5-2018-07.json \
  --question CHOUKAI_TASK_BASED#1 --include-audio --overwrite
```

Setelah seluruh entry target diaudit, ubah `review.status` menjadi `APPROVED` dan isi
`review.reviewedAt`. Lalu validasi dan terapkan hanya ke fixture lokal:

```bash
npm run choukai:explanation:apply -- --file n5-2018-07.json --check
npm run choukai:explanation:apply -- --file n5-2018-07.json
npm run seed:question-explanation:check -- --file n5-2018-07.json
```

Jangan jalankan `seed:question-explanation` tanpa `--check` sampai hasil staging dan perubahan
fixture sudah disetujui. Apply memverifikasi hash input agar perubahan transkrip, gambar, pilihan,
atau kunci setelah generate tidak dapat diterapkan diam-diam.

## Batas keamanan data

- Transkrip tidak disimpan di `questionText` atau `QuestionContext.storyText` karena kedua field
  tersebut dapat tampil kepada peserta.
- Transkrip memakai relasi 1:1 `QuestionAudioTranscript`, dengan teks dan metadata audit seperti
  model, versi prompt, waktu generate, dan waktu review.
- Query ujian aktif, Latihan Cepat, result summary, dan diskusi tidak boleh memilih relasi
  transkrip. Mode baca dan review attempt milik user yang sudah `COMPLETED` boleh memilih teksnya
  tanpa metadata audit.
- Tombol show/hide pada mode baca dan review hanya fitur belajar. Pada permukaan yang belum boleh
  membuka transkrip, datanya sama sekali tidak boleh masuk payload Server Component atau Server
  Action.

## Guard wajib

- Jumlah hasil OCR harus sama dengan jumlah soal target atau proses berhenti.
- `mondaiType` dan nomor soal harus unik serta ada di fixture.
- Hasil OCR tidak boleh langsung mengubah fixture/database.
- Generator pembahasan harus gagal secara eksplisit bila transkrip reviewed belum ada atau gambar
  yang diwajibkan tidak berhasil dikirim. Dalam mode eskalasi audio, kegagalan audio juga harus
  menghentikan soal; tidak boleh diam-diam berargumen hanya dari kunci jawaban.
- Semua script harus resumable, idempotent, memiliki mode check/dry-run, dan menulis file secara
  atomik.

## Urutan implementasi

1. [Selesai] Finalkan kontrak fixture dan schema relasi transkrip.
2. [Selesai] Buat migration dan importer transkrip yang aman.
3. Terapkan migration dan verifikasi tabel baru kosong serta tidak dapat diakses role Data API.
4. [Selesai] Buat ekstraktor PDF/PNG ke staging dan jalur apply reviewed ke fixture.
5. Uji panggilan OCR nyata pada satu batch paket N5.
6. Audit hasil pilot, terapkan ke fixture, lalu sinkronkan ke database.
7. [Ditunda sampai diperlukan] Uji audio multimodal gateway pada satu soal eskalasi tanpa menulis
   pembahasan ke fixture.
8. Buat generator pembahasan CHOUKAI transcript-first dan jalankan pilot kecil sebelum dipakai per
   level.
