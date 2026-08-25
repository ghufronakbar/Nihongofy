# N4 2017-07 — ekstraksi paket baru

Status: `needs_review` (3 soal, semuanya di 表記). Sisanya lolos gate deterministik.

## Sumber

- `data/sources/n4-2017-07/n4-2017-07-questions.pdf` — 54 hal. Susunannya:
  hal. 2–11 文字・語彙 · 12–18 文法 · 19–26 読解 · 29–42 lembar soal 聴解 · **43–44 正答表 (kunci)**
  · 45–54 聴解原文 (skrip).
- `data/sources/n4-2017-07/n4-2017-07-choukai.mp3` — audio listening utuh, 2192.5 s, belum dipotong.
- SHA256 sumber + klip: `source-sha256.txt`.

Catatan sumber: halaman soal berupa gambar hasil scan **150 ppi** (1066×1508 per halaman, JPEG),
tapi halaman skrip 45–54 punya **text layer asli** — jadi seluruh skrip listening diekstrak
sebagai teks (`pdftotext`), bukan OCR, termasuk ruby furigana sebagai baris terpisah.

## Struktur (aturan sesi N4)

| Sesi | Section | Mondai |
|---|---|---|
| 1 | MOJI_GOI | 問題1 漢字読み (9) · 問題2 表記 (6) · 問題3 文脈規定 (9) · 問題4 言い換え類義 (5) · 問題5 用法 (5) |
| 2 | BUNPOU + DOKKAI | 問題1 文法形式 (15) · 問題2 文の組み立て (5) · 問題3 文章の文法 (5) · 問題4 短文 (4) · 問題5 中文 (4) · 問題6 情報検索 (2) |
| 3 | CHOUKAI | 問題1 課題理解 (8) · 問題2 ポイント理解 (7) · 問題3 発話表現 (5) · 問題4 即時応答 (8) |

15 item, **97 soal**, 11 context, 10 gambar. (Bandingkan paket 2018-07: 98 soal — bedanya
文脈規定 9 vs 10 dan 表記 6 vs 6; memang beda antar penyelenggaraan.)

## Gate deterministik (semua lolos)

- `mondaiType` unik; `section` ↔ `session` konsisten aturan N4.
- Tiap soal tepat 4 pilihan `codeAnswer` 1–4 unik; semua `questionContextRef` resolve; tidak ada context yatim.
- **97/97 `questionAnswer` cocok dengan kunci hal. 43–44.**

## Item `needs_review` — 表記 (問題2) soal 3, 4, 5

Pengecoh di 表記 sengaja memakai kanji yang beda satu-dua coretan. Pada scan 150 ppi
(satu kanji ≈ 20 px) perbedaan itu **hilang**: keempat pilihan terbaca sama persis. Sudah
dicoba render 900 dpi dan membandingkan bitmap glif satu per satu — resolusi sumbernya memang
batasnya, bukan cara rendernya.

| Soal | Kata | Status |
|---|---|---|
| 3 | あるいて | pengecoh **perkiraan** (`走いて` / `進いて` / `通いて`); jawaban benar `歩いて` sesuai kunci |
| 4 | べんり | terbaca (beda radikal 亻 vs 彳 masih kelihatan): `徆利` / `便理` / `徆理` / `便利` |
| 5 | ねむかった | pengecoh **perkiraan** (`眼むかった` / `眼かった` / `眠むかった`); jawaban benar `眠かった` sesuai kunci |

Yang dijamin benar hanya pilihan yang menjadi jawaban. Kalau nanti ada scan resolusi lebih
tinggi, soal 3 dan 5 yang perlu diperbaiki lebih dulu (soal 4 sudah terbaca). Diteruskan atas
keputusan pemilik data.

Catatan pemilihan pengecoh soal 3: versi pertama memakai `赱いて` dan `步いて` — keduanya bentuk
lama/varian dari `走` dan `歩`, dan `步いて` praktis sama saja dengan jawaban benar sehingga tidak
layak jadi pengecoh. Diganti ke kanji gerak lain yang jelas salah bacaannya: `進いて` dan `通いて`.

## Audio

Dipotong jadi 4 klip per mondai (mp3 mono 32 kHz 64 kbps), batas dari ASR bertimestamp
(`whisper-cli`, `ggml-large-v3-turbo`) + `silencedetect`:

| Klip | Rentang | Durasi | Awal (ASR) | Akhir (ASR) |
|---|---|---:|---|---|
| `-01` | 45.33–727.60 | 682.3 s | 「問題1 問題1ではまず質問を聞いてください…」 | 「…このボタンを押しますか?」= 問題1 8番 |
| `-02` | 726.38–1535.20 | 808.8 s | 「問題2 問題2ではまず質問を…」 | 「…何時に出発しますか?」= 問題2 7番 |
| `-03` | 1533.97–1810.90 | 276.9 s | 「問題3 問題3では絵を見ながら…」 | 「3 ペン使ってくれる」= 問題3 5番 |
| `-04` | 1809.73–2192.51 | 382.8 s | 「問題4 問題4では絵などがありません…」 | akhir ujian |

Batas 問題2→問題3 dan 問題3→問題4 diambil dari **jeda menjawab yang panjang** (12.22 s pada
1521.75–1533.97 dan 10.19 s pada 1799.55–1809.73), bukan dari penanda ASR: whisper berhalusinasi
di area hening panjang itu (mengulang kalimat pertanyaan terakhir puluhan kali), jadi timestamp
penandanya tidak dapat dipercaya di sini. Batas 問題1→問題2 memakai penanda ASR (726.38) karena
di sana tidak ada hening ≥0.8 s di bawah −32 dB. Semua klip diverifikasi ulang lewat ASR pada
16 detik awal dan akhir: tiap klip berisi satu mondai utuh, pertanyaan penutupnya tidak terpotong.

## Gambar

10 gambar dipotong 300 dpi dengan deteksi blok otomatis:

- 問題1 課題理解: 1番, 2番, 4番, 5番, 6番 (3番, 7番, 8番 pilihannya teks — tanpa gambar).
- 問題3 発話表現: 1番–5番.

Ilustrasi di PDF ini jauh lebih bersih daripada paket 2018-07 dan tanpa watermark diagonal.

## Cloudinary

14 aset (4 audio + 10 gambar) di `jlpt-exam/data/n4-2017-07`, semuanya dibaca ulang lewat Admin
API dan ukuran byte-nya cocok. Detail: `cloudinary-upload-results.json`.

## Keputusan pemodelan (bukan error)

- **Pilihan yang menempel di gambar** (問題1 1番, 2番, 5番, 6番): `answerText` dikosongkan karena
  angka 1–4 tercetak di dalam ilustrasi. 4番 tetap diisi (アイ/アエ/イウ/イエ tercetak sebagai teks).
- **発話表現**: `questionText` kosong (lembar soal hanya berisi gambar bertanda panah), pilihan
  kosong karena ketiganya diucapkan; pilihan ke-4 `""` penyesuaian schema.
- **即時応答**: seluruhnya kosong; pilihan ke-4 `""` penyesuaian schema. Semua jawaban benar di rentang 1–3.
- **Furigana** hanya ditranskrip pada kata bergaris bawah di 問題1 漢字読み, mengikuti konvensi paket lain.
- `explanation` dibiarkan `null` (PDF ini tidak memuat 解析, hanya kunci + skrip).
