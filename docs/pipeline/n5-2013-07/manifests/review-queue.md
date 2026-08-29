# N5 2013-07 extraction review

Status: `auto_pass`. All deterministic gates pass and no unresolved review item remains.

## Extracted structure

| Session | Section | Mondai |
|---|---|---|
| 1 | MOJI_GOI | 漢字読み (12), 表記 (8), 文脈規定 (10), 言い換え類義 (5) |
| 2 | BUNPOU + DOKKAI | 文法形式 (16), 文の組み立て (5), 文章の文法 (5), 短文 (3), 中文 (2), 情報検索 (1) |
| 3 | CHOUKAI | 課題理解 (7), ポイント理解 (6), 発話表現 (5), 即時応答 (6) |

The final package has 14 items, 91 questions, 10 contexts, 11 question images, and 4 audio contexts. N5 has no 語形成 or 用法 mondai in this booklet.

## Verification

- All 91 answers match the printed official answer table.
- Every question has four schema choices with code answers 1-4, every answer resolves to a choice, all question orders are sequential, and every context reference resolves.
- The N5 session model is preserved: 文字・語彙 in session 1, 文法・読解 in session 2, and 聴解 in session 3.
- All 15 uploaded assets passed Cloudinary Admin API readback and independent HTTPS download with matching byte counts.
- All 11 image crops were visually checked for complete artwork, numbered alternatives, arrows, and labels.
- Audio boundaries were selected from explicit ASR 問題 markers and include short overlaps at internal boundaries.
- Fixture validation, deterministic count/answer checks, media-reference checks, JSON parsing, trailing-whitespace checks, and the production build pass.
- `npm run lint -- --max-warnings=0` remains blocked by the repository baseline: 2 pre-existing `no-explicit-any` errors and 28 unused-import warnings in files outside this data extraction.

## Modeling decisions

- Picture-choice questions use one `questionImage` and four empty `answerText` values because the numbered alternatives are printed in the image.
- 発話表現 and 即時応答 use four empty structural choices. The source provides three spoken responses; choice 4 is the repository schema adapter and no official answer points to it.
- The XYZ旅行 flyer is represented as a Markdown table in `storyText`, retaining transport, dates, prices, destinations, and contact details.
- Explanations are omitted because the source provides an answer key and listening script but no official explanations.
