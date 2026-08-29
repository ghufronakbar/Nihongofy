# N5 2012-12 extraction review

Status: `auto_pass`. All deterministic gates pass and no unresolved review item remains.

## Extracted structure

| Session | Section | Mondai |
|---|---|---|
| 1 | MOJI_GOI | 漢字読み (12), 表記 (8), 文脈規定 (10), 言い換え類義 (5) |
| 2 | BUNPOU + DOKKAI | 文法形式 (16), 文の組み立て (5), 文章の文法 (5), 短文 (3), 中文 (2), 情報検索 (1) |
| 3 | CHOUKAI | 課題理解 (7), ポイント理解 (6), 発話表現 (5), 即時応答 (6) |

The final package has 14 items, 91 questions, 10 contexts, 11 question images, and 4 audio contexts. N5 has no 語形成 or 用法 mondai in this booklet.

## Source recovery

- The supplied PDF scan jumps from BUNPOU_TEXT_GRAMMAR choices 22-23 on page 6 directly to DOKKAI_MEDIUM_TEXT on page 7.
- Choices 24-26 and all three DOKKAI_SHORT_TEXT questions 27-29 were recovered from the matching public PassJapanese 2012-12 N5 grammar-reading archive.
- Recovered content was cross-checked against the official answer and explanation pages in the supplied PDF: 24=3, 25=4, 26=2, 27=4, 28=4, 29=3.
- The source anomaly is fully resolved in the fixture; no placeholder or invented distractor remains.

## Verification

- All 91 answers match the printed answer table.
- Every question has four schema choices with code answers 1-4, every answer resolves to a choice, all question orders are sequential, and every context reference resolves.
- The N5 session model is preserved: 文字・語彙 in session 1, 文法・読解 in session 2, and 聴解 in session 3.
- All 15 uploaded assets passed Cloudinary Admin API readback and independent HTTPS download with matching SHA-256 hashes and byte counts.
- All 11 image crops were visually checked for complete choice panels, arrows, artwork, and labels.
- Audio boundaries use explicit ASR 問題 markers, contain short overlaps, and exclude the long trailing silence.
- Picture-choice questions use one `questionImage` and four empty `answerText` values because the numbered alternatives are printed in the image.
- 発話表現 and 即時応答 use four empty structural choices. The source provides three spoken responses; choice 4 is the repository schema adapter and no official answer points to it.
- Explanations are omitted because the source provides an answer key and listening script but no official Japanese explanations.
- `npm run seed:test-package:check -- --file n5-2012-12.json`, deterministic fixture/media audits, JSON parsing, checksum verification, `git diff --check`, and `npm run build` pass.
- `npm run lint -- --max-warnings=0` remains blocked only by the repository baseline after temporary extraction files are removed: 2 pre-existing `no-explicit-any` errors and 28 unused-import warnings outside this data extraction.
