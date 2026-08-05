# N2 2016-07 — hasil scraping ulang

Status: `needs_review` (1 item). Sisanya lolos gate deterministik.

Latar belakang: `src/test-package-data/n2-2016-07.json` yang lama ternyata berisi paket
**2017年07月** (field `name` pun tertulis "JLPT N2 - 2017年07月", bentrok dengan
`n2-2017-07.json` sehingga salah satu paket pasti di-skip saat seed). File itu ditulis ulang
dari nol dari PDF asli 2016年7月.

## Sumber

- `data/sources/n2-2016-07/n2-2016-07-questions.pdf` — 17 hal., booklet soal (第1页–第16页), tanpa text layer (hasil scan).
- `data/sources/n2-2016-07/n2-2016-07-answer.pdf` — 13 hal., 参考答案 (第17页) + 試題解析 + skrip listening (第25页–第29页).
- SHA256 semua sumber + audio: `source-sha256.txt`.
- Metode OCR: pembacaan visual per halaman (render `pdftoppm` 300 dpi untuk area yang perlu diperbesar).

## Gate deterministik (semua lolos)

- 19 `testPackageItem`, `mondaiType` unik, section/session konsisten aturan N2 (1 = MOJI_GOI+BUNPOU+DOKKAI, 2 = CHOUKAI).
- 107 soal; tiap soal tepat 4 pilihan dengan `codeAnswer` 1–4 unik.
- 17 `questionContext`, semua `questionContextRef` resolve, tidak ada context yatim.
- **107/107 `questionAnswer` cocok dengan kunci resmi 第17页** — kecuali 聴解 問題5, lihat di bawah.
- Markup hanya `{漢字|かな}`, `__…__`, `[_]`, `[★]`; tidak ada HTML mentah.

## Audio

Lima klip di `data/audio/n2-2016-07/` diverifikasi milik ujian ini, bukan paket lain
(ini yang paling perlu dicek karena JSON lamanya tertukar). ASR `whisper-cli`
(`ggml-large-v3-turbo`, `-l ja`) dijalankan pada awal tiap klip dan dicocokkan dengan skrip
listening di 第25页–第29页:

Diperiksa 40 detik pertama **dan** 40 detik terakhir tiap klip (kutipan di bawah adalah keluaran
ASR apa adanya, termasuk salah dengarnya):

| Klip | Durasi | Awal klip | Akhir klip |
|---|---:|---|---|
| `-01` | 483.0 s | 「一番 電話で男の人と女の人が話しています…」 = 問題1 1番 ✓ | 「…頼みますよ 女の人はこの後まず何をしますか」 = pertanyaan 問題1 5番 ✓ |
| `-02` | 677.0 s | 「では始めます 一番 花屋で女の人と定員が話しています…」 = 問題2 1番 ✓ | 「…この会社の野菜ジュースの売上が伸びた理由は何ですか?」 = pertanyaan 問題2 6番 ✓ |
| `-03` | 473.0 s | 「1番 講演会で男の人が話しています…」 = 問題3 1番 ✓ | 「専門家の話のテーマは何ですか 1 鳥の目と虫の目の共通点…4 自分に合った仕事を見つける方法」 = pertanyaan+pilihan 問題3 5番 ✓ |
| `-04` | 417.0 s | 「あ始めます 一番 佐藤さん社長がお呼びですよ…」 = 問題4 1番 ✓ | 「12番 先輩、ざっとでいいので…3 後でもよかったら見とくよ」 = 問題4 12番 ✓ |
| `-05` | 528.0 s | 「1番 街のボランティアセンターで女の学生と係の人が話しています…」 = 問題5 1番 ✓ | 「…ここにする 質問1 男の学生は何番の学校に…質問2…」 = 問題5 3番 ✓ |

Jadi tiap klip berisi **satu mondai utuh**, dari 1番 sampai pertanyaan butir terakhir, tanpa
tumpang tindih dan tanpa ada butir yang terpotong. Klip tidak dipotong ulang.

Dua catatan:

- Klip dimulai tepat di 「1番」, **setelah** instruksi mondai dan contoh (例) — bukan dari
  pengumuman 「問題N」 seperti paket 2013-12. Ini tidak mengurangi isi soal: teks instruksinya
  tetap ada di field `instruction` tiap `testPackageItem`. Sisa ±353 detik (2931 s audio penuh
  vs 2578 s total kelima klip) adalah pembukaan ujian, instruksi, dan 例.
- Akhir klip `-03` memperdengarkan keempat pilihan 問題3 5番, dan akhir klip `-04`
  memperdengarkan ketiga respons 問題4 12番 — konfirmasi langsung bahwa pilihan kedua mondai itu
  memang diucapkan, tidak tercetak, sesuai keputusan mengosongkan `answerText`.
- Teks ASR hanya dipakai sebagai bukti QA (dan jelas ada salah dengarnya: 「定員」untuk 店員,
  「昨日」untuk 木の, plus halusinasi 「ご視聴ありがとうございました」 di bagian hening). Tidak
  ada satu pun teks ASR yang masuk ke JSON — semua isi JSON berasal dari booklet cetak.

URL Cloudinary yang sudah ada dipakai kembali, bukan upload baru: `content-length` kelima aset
**byte-identik** dengan file lokal yang barusan diverifikasi, dan semuanya balas `HTTP 200
audio/mpeg`. Jadi audio di Cloudinary sejak awal memang audio 2016-07 yang benar — yang salah
dulu hanya isi JSON-nya.

## Item `needs_review`

1. **Kunci 聴解 問題5 tidak tercetak.** Di tabel kunci 第17页, baris 問題5 hanya berisi label
   `(1) (2) (3)` dengan sel jawaban kosong (cacat cetak yang sama seperti paket 2013-12).
   Keempat jawaban di JSON (`3, 3, 3, 4`) **diturunkan dari skrip listening**, bukan disalin
   dari kunci:
   - 1番 → `3` 学習を支援するボランティア (英語＋子供、水曜17:30 「この時間ならなんとかなりそう」; 通訳=平日日中 tidak bisa, 読み聞かせ=bahasa Jepang, 料理教室=peserta 主婦).
   - 2番 → `3` 新しい宣伝方法を試す (ubah interior mahal & harus tutup lama; iklan internet murah dan mudah).
   - 3番質問1 → `3` (男の学生: 「その国の家庭でありのままの暮らしを体験してみたかったから」= sekolah nomor 3, homestay).
   - 3番質問2 → `4` (女の学生: 「しっかり勉強できるところ」＋「学校帰りにショッピング」= sekolah nomor 4, 授業が厳しい・町の中心部).

   Keyakinan tinggi, tapi tetap perlu konfirmasi manusia karena bukan dari kunci resmi.

## Keputusan pemodelan (bukan error)

- **Choukai audio-only** (問題3 概要理解, 問題4 即時応答, 問題5 1番・2番): `questionText` dan
  keempat `answerText` sengaja dikosongkan `""` — di lembar soal asli memang tertulis
  「問題用紙に何も印刷されていません」. Hanya 問題5 3番 yang punya pilihan tercetak
  (`1番`〜`4番`). Paket lama seperti `n2-2017-07.json` mengisi field ini dari transkrip; sesuai
  keputusan, data lama dibiarkan dan konvensi kosong ini dipakai untuk data baru.
- **問題4 即時応答** aslinya hanya 3 respons; pilihan ke-4 diisi `""` sebagai penyesuaian schema
  (kontrak repo mewajibkan tepat 4 pilihan). Semua jawaban benar ada di rentang 1–3.
- `explanation` dibiarkan `null`. Halaman 試題解析 di PDF jawaban berisi pembahasan per nomor
  dalam bahasa Mandarin dan bisa dipakai menyusul kalau memang mau diisi.
