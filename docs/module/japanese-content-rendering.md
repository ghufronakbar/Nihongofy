# Modul Japanese Content Rendering

## Status Aktual

**Selesai secara implementasi kode.** Renderer dipakai bersama oleh exam, practice, mode baca, result detail, dan copy-to-clipboard.

## Kemampuan Inline

- `{kanji|reading}` menjadi ruby/furigana.
- `__text__` menjadi underline.
- `[_]` dan `[★]` menjadi slot soal susun kalimat.
- Furigana dapat berada di dalam underline.
- Untuk `MOJI_GOI_READ_KANJI`, reading dalam underline disembunyikan saat mengerjakan.

## Kemampuan Document-Level

- Paragraph dan line break untuk bacaan panjang.
- Markdown-style table.
- Section `【A】`/`【B】` untuk multi-passage.
- Tabel dan section tetap memakai parser inline pada setiap sel/baris.

## Fitur Pendukung

- `FuriganaScope` menampilkan/menyembunyikan seluruh `<rt>` pada mode review.
- `CopyQuestionButton` mengubah markup ke plain text yang aman untuk clipboard.
- Copy menghilangkan reading furigana agar jawaban cara-baca kanji tidak bocor.

## Keterbatasan Aktual

- Parser bukan Markdown umum; hanya grammar internal yang terdokumentasi.
- `JapaneseText` merender konten dalam `<span>`, sehingga newline pada teks soal atau explanation tidak dipertahankan. Database saat audit memiliki 115 `questionText` dan 18 dari 20 explanation ber-newline; dialog atau pembahasan multiline dapat tampil menyambung pada exam, practice, mode baca, dan result.
- `JapanesePassage` hanya mengenali paragraph, tabel pipe, dan section `【A】`; heading/list Markdown tidak diparse. Database saat audit memiliki 5 context dengan heading `#` dan 2 dengan list, sehingga marker dapat tampil literal.
- Salah satu fixture N3 2016-07 memasukkan catatan provenance/checksum/review ke `storyText`; data tersebut sudah ikut terimpor dan dapat tampil sebagai isi bacaan.
- Section marker hanya mengenali satu huruf Latin kapital seperti `【A】`.
- Tabel mengasumsikan sintaks pipe sederhana dan belum memvalidasi konsistensi jumlah kolom.
- Furigana tidak dihasilkan otomatis; data harus sudah memiliki markup.
- Font Jepang tidak dibundle. Root hanya memuat Geist Latin, sementara `.font-japanese` bergantung pada font fallback sistem; `JapaneseText` juga tidak otomatis menambahkan `lang="ja"` atau class font Jepang.
- Clipboard API tidak memiliki UI error fallback jika permission/capability gagal.
- `docs/text-parser.md` masih membuka item QA visual manual walaupun implementasi dan dry-run parser sudah selesai.
- Kualitas akhir sangat bergantung pada hasil OCR/kurasi fixture, terutama underline referensi dan line break.

## File Utama

- `src/lib/japanese-markup.ts`
- `src/lib/japanese-document.ts`
- `src/lib/japanese-plain-text.ts`
- `src/components/japanese-text.tsx`
- `src/components/japanese-passage.tsx`
- `src/components/furigana-scope.tsx`
- `src/components/copy-question-button.tsx`
- `docs/text-parser.md`
