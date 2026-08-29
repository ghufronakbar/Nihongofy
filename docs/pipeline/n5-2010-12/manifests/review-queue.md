# N5 2010-12 extraction review

Status: `auto_pass`. All deterministic gates pass and no unresolved review item remains.

## Extracted structure

| Session | Section | Mondai |
|---|---|---|
| 1 | MOJI_GOI | 漢字読み (10), 表記 (8), 文脈規定 (10), 言い換え類義 (5) |
| 2 | BUNPOU + DOKKAI | 文法形式 (16), 文の組み立て (5), 文章の文法 (5), 短文 (3), 中文 (2), 情報検索 (1) |
| 3 | CHOUKAI | 課題理解 (7), ポイント理解 (6), 発話表現 (5), 即時応答 (6) |

The final package has 14 items, 89 questions, 10 contexts, 11 question images, and 4 audio contexts. N5 has no 語形成 or 用法 mondai in this booklet.

## Source recovery

- The supplied PDF scan omits one listening question-sheet page after 課題理解 question 4. As a result, the printed picture choices for 課題理解 questions 5 and 6 are absent.
- The written questions, answer table, listening scripts, audio, and every visible listening panel match the already validated `n5-2017-07` package exactly.
- The two missing picture panels were recovered from that matching package, independently downloaded, visually checked, and re-uploaded under the `n5-2010-12` namespace.
- All other nine image crops come directly from the supplied PDF.

## Verification

- All 89 answers match the printed answer table on PDF page 13.
- Every question has four schema choices with code answers 1-4, every answer resolves to a choice, all question orders are sequential, and every context reference resolves.
- The N5 session model is preserved: 文字・語彙 in session 1, 文法・読解 in session 2, and 聴解 in session 3.
- All 15 uploaded assets passed Cloudinary Admin API readback and independent HTTPS download with matching SHA-256 hashes and byte counts.
- All 11 image panels were visually checked for complete choices, arrows, artwork, and labels.
- Audio boundaries use explicit ASR 問題 markers, include short overlaps, and retain the spoken exam ending.
- Picture-choice questions use one `questionImage` and four empty `answerText` values because the numbered alternatives are printed in the image.
- 発話表現 and 即時応答 use four empty structural choices. The source provides three spoken responses; choice 4 is the repository schema adapter and no official answer points to it.
- Explanations are omitted because the source provides an answer key and Chinese commentary, but no official Japanese explanations.
- `npm run build` passes on Next.js 16.2.10.
- `npm run lint -- --max-warnings=0` reaches the repository baseline after temporary extraction scripts are removed: 2 existing `no-explicit-any` errors and 28 existing warnings outside this package.
