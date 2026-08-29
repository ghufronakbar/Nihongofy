# N5 2018-07 extraction review

Status: `auto_pass`. All deterministic gates pass and no unresolved review item remains.

## Sources

- `/Users/lanstheprodigy/Downloads/N5-2018年.pdf`: 24 scanned pages, no text layer. Pages 3-5 contain 文字・語彙, pages 5-10 contain 文法・読解, pages 11-14 contain 聴解 question sheets, page 15 contains the answer key, pages 16-20 contain written-question explanations, and pages 21-24 contain 聴解原文.
- `/Users/lanstheprodigy/Downloads/Choukai N5-2018年.m4a`: complete listening audio, 1730.593 seconds.
- The requested package month is July (`07`); the source cover itself only says 2018.

## Extracted structure

| Session | Section | Mondai |
|---|---|---|
| 1 | MOJI_GOI | 漢字読み (12), 表記 (8), 文脈規定 (10), 言い換え類義 (5) |
| 2 | BUNPOU + DOKKAI | 文法形式 (16), 文の組み立て (5), 文章の文法 (5), 短文 (3), 中文 (2), 情報検索 (1) |
| 3 | CHOUKAI | 課題理解 (7), ポイント理解 (6), 発話表現 (5), 即時応答 (6) |

The final package has 14 items, 91 questions, 10 contexts, 13 question images, and 4 audio contexts. N5 has no 語形成 or 用法 mondai in this booklet.

## Verification

- All 91 answers match the printed answer table on page 15 and the individual answer labels in pages 16-20.
- Every question has four schema choices with code answers 1-4, every answer resolves to a choice, all question orders are sequential, and every context reference resolves.
- `npm run seed:test-package:check -- --file n5-2018-07.json` passes.
- All 17 uploaded assets (4 audio clips and 13 images) were read back through the Cloudinary Admin API and downloaded over HTTPS with matching byte counts.
- All image crops were visually checked. The source watermark remains visible but does not cover any required option or illustration.
- Full-audio ASR was checked against the printed 聴解原文. Clip boundaries were selected from explicit 問題 markers and verified at the heads and tails of all four output clips.

## Modeling decisions

- Picture-choice questions keep `answerText` empty because the alternatives are printed inside `questionImage`.
- 発話表現 and 即時応答 keep `questionText` and spoken `answerText` empty; the fourth empty choice is the repository's schema adaptation for original three-choice questions.
- The 高木大学 route diagram is represented as a Markdown table in `storyText`, preserving all four routes without requiring a separate story image.
- Explanations are omitted. The Chinese commentary pages were used only to cross-check the printed answer key and source reading.
