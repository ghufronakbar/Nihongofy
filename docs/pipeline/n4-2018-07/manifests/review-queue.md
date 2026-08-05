# N4 2018-07 — ekstraksi paket baru

Status: `resolved`. Satu-satunya item review sudah diputuskan pemilik data (lihat bagian
聴解 問題4 1番); seluruh gate deterministik lolos.

Catatan penamaan: di Drive sumbernya hanya tertulis "2018" tanpa bulan; bulan `07` dipakai atas
keputusan pemilik data. `name` paket = `JLPT N4 - 2018年07月`.

## Sumber

- `data/sources/n4-2018-07/n4-2018-07-questions.pdf` — 23 hal., hasil scan tanpa text layer,
  ada watermark pihak ketiga (teks diagonal Vietnam + QR/keterangan Mandarin). Susunannya:
  hal. 1 sampul · 2–4 文字・語彙 · 5–9 文法・読解 · 10–13 lembar soal 聴解 · **14 参考答案 (kunci)**
  · 15–19 試題解析 · 20–23 聴解原文 (skrip).
- `data/sources/n4-2018-07/n4-2018-07-choukai.m4a` — audio listening utuh, 2302.4 s, belum dipotong.
- SHA256 semua sumber + klip hasil potong: `source-sha256.txt`.

## Struktur (sesuai aturan sesi N4)

| Sesi | Section | Mondai |
|---|---|---|
| 1 | MOJI_GOI | 問題1 漢字読み (9) · 問題2 表記 (6) · 問題3 文脈規定 (10) · 問題4 言い換え類義 (5) · 問題5 用法 (5) |
| 2 | BUNPOU + DOKKAI | 問題1 文法形式 (15) · 問題2 文の組み立て (5) · 問題3 文章の文法 (5) · 問題4 短文 (4) · 問題5 中文 (4) · 問題6 情報検索 (2) |
| 3 | CHOUKAI | 問題1 課題理解 (8) · 問題2 ポイント理解 (7) · 問題3 発話表現 (5) · 問題4 即時応答 (8) |

15 `testPackageItem`, **98 soal**, 11 context, 12 gambar. Tidak ada `MOJI_GOI_WORD_FORMATION`
(語形成 memang tidak ada di N4). Penomoran mondai di sesi 2 mengikuti cetakan aslinya (文法 mulai
dari 問題1 lagi, 読解 lanjut ke 問題4–6).

## Gate deterministik (semua lolos)

- `mondaiType` unik; `section` ↔ `session` konsisten aturan N4 (MOJI_GOI=1, BUNPOU/DOKKAI=2, CHOUKAI=3).
- Tiap soal tepat 4 pilihan dengan `codeAnswer` 1–4 unik; semua `questionContextRef` resolve.
- **97 dari 98 jawaban identik dengan kunci cetak hal. 14.** Satu selisih disengaja, lihat di bawah.
- Kunci hal. 14 juga dicek silang dengan 試題解析: bagian 読解 (26)–(35) cocok seluruhnya.

## Item review (sudah diputuskan) — 聴解 問題4 (即時応答) 1番

Kunci cetak menulis **3**, di JSON diisi **1**, dan **pemilik data sudah menyetujui pemakaian
jawaban 1**. Isi soalnya (skrip hal. 23):

> よかったら、お茶をもう一杯いかがですか。
> 1. すみません、いただきます。  2. もう一杯どうぞ。  3. いいえ、どういたしまして。

Pilihan 3「いいえ、どういたしまして」adalah balasan untuk ucapan terima kasih, bukan untuk tawaran;
jawaban wajar untuk menerima tawaran adalah 1. Tujuh butir lain di baris kunci yang sama
(2番–8番) semuanya cocok sempurna dengan skrip, jadi dugaan terkuat: satu sel kunci salah ketik
di PDF kompilasi pihak ketiga ini. Perubahan ini **keputusan editorial, bukan dari sumber**,
dan sudah disetujui pemilik data — jadi `1` adalah nilai final untuk paket ini.

## Audio

Dipotong dari m4a asli menjadi 4 klip per mondai (mp3 mono 32 kHz 64 kbps):

| Klip | Rentang sumber | Durasi | Awal (ASR) | Akhir (ASR) |
|---|---|---:|---|---|
| `-01` | 44.914–762.00 | 717.1 s | 「問題1 問題1ではまず質問を聞いてください…」 | 「男の人は来週の日曜日体育館に何を持ってこなければなりませんか」 |
| `-02` | 760.80–1655.10 | 894.3 s | 「問題2」 | 「男の人はどうして東公園がいいと言っていますか」 |
| `-03` | 1653.90–1930.10 | 276.2 s | 「問題3」 | 「…3 何を書いておきましょうか」 |
| `-04` | 1928.90–2302.43 | 373.5 s | 「問題4 問題4では絵などがありません…」 | 「…これで聴解試験を終わります」 |

Metode: ASR bertimestamp (`whisper-cli`, `ggml-large-v3-turbo`, `-l ja`) atas audio penuh →
penanda 「問題N」 di 46.5 / 761.1 / 1654.3 / 1929.2 s, dipadukan dengan `silencedetect`
(`noise=-32dB:d=0.8`).

**Pelajaran penting untuk paket berikutnya:** memilih "awal hening terakhir sebelum penanda"
seperti pada paket 2013-12 **salah** di sini — kalimat pertanyaan penutup tiap mondai dan jeda
menjawabnya digabung whisper ke dalam satu segmen, sehingga hening terakhir itu jatuh di
tengah kalimat penutup dan butir terakhir terpotong ke klip berikutnya. Batas yang benar =
waktu penanda 「問題N」 itu sendiri, dengan padding ~1,2 s di ujung klip sebelumnya. Kedua versi
sudah diverifikasi ulang lewat ASR pada 12–25 detik awal dan akhir tiap klip; versi final
mengandung setiap butir secara utuh termasuk partikel 「か」 di akhir pertanyaan.

Klip utuh (`n4-2018-07.mp3`) juga disimpan di `data/audio/n4-2018-07/` mengikuti pola paket N2.

## Gambar

12 gambar dipotong dari PDF pada 300 dpi (batas kotak dideteksi otomatis lewat kerapatan piksel
gelap per baris, bukan koordinat tebakan):

- 問題1 課題理解: 1番, 2番, 3番, 4番, 5番, 6番, 8番 (7番 tidak bergambar — pilihannya teks).
- 問題3 発話表現: 1番–5番, semuanya bergambar.

Watermark sumber ikut terbawa di gambar hasil potong; tidak bisa dihilangkan tanpa merusak
garis ilustrasi.

## Cloudinary

16 aset (4 audio + 12 gambar) di-upload ke `jlpt-exam/data/n4-2018-07`, semuanya dibaca ulang
lewat Admin API dan ukuran byte-nya cocok. Detail: `cloudinary-upload-results.json`.

## Keputusan pemodelan (bukan error)

- **Pilihan yang menempel di gambar** (問題1 2番, 3番, 5番, 6番 — kalender, 4 panel, laci meja):
  `answerText` dikosongkan `""` karena angka 1–4 tercetak di dalam ilustrasi. Butir yang
  pilihannya berupa teks (4番, 7番, 8番, dan 1番 dengan アウ/アエ…) tetap diisi.
- **発話表現**: `questionText` kosong (di lembar soal memang hanya ada gambar dengan tanda panah),
  pilihan kosong karena ketiganya diucapkan. Pilihan ke-4 `""` sebagai penyesuaian schema.
- **即時応答**: seluruhnya kosong; pilihan ke-4 `""` penyesuaian schema. Semua jawaban benar ada di
  rentang 1–3.
- **Furigana**: booklet N4 asli mencetak furigana di hampir semua kanji. Yang ditranskrip hanya
  furigana pada kata bergaris bawah di 問題1 漢字読み, mengikuti konvensi paket N2 yang sudah ada.
- `explanation` dibiarkan `null`. 試題解析 hal. 15–19 (bahasa Mandarin) mencakup 文字・語彙・文法・読解
  — bisa dipakai menyusul kalau memang mau diisi. Bagian 聴解 tidak punya 解析.
