# N5 2024-07 extraction review

Status: `auto_pass`. Every extracted answer matches the printed key (one key typo noted below),
all media is on R2 and read back, and every deterministic gate passes. 24 original questions were
added to bring the written sections up to the size of the other N5 packages; they are listed in
"Supplementary questions". CHOUKAI transcripts and explanations are not generated yet.

## Sources

SHA-256 values are in `manifests/source-sha256.txt`.

- `jlpt-n5-2024-07 (1).pdf`: 25 scanned pages with a "JLPT MOGI / Yuuki Bùi" watermark. Pages
  1-3 are 文字・語彙, pages 4-13 are 文法・読解, and pages 14-25 are the 聴解 question sheets.
- `kunci jlpt-n5-2024-07.pdf`: 3-page answer key with a 聴解正解表. `script choukai n5 2024 7.pdf`
  is byte-identical to this file, so no printed listening script exists.
- `choukai-jlpt-n5-2024-07.mp3`: complete listening audio, MP3 44.1 kHz stereo, 1712.7 seconds.
- This is a reconstruction of the 2024-07 exam from candidates' memory, not the official booklet.
  Its question counts follow the shorter N5 format used since 2020, while the other N5 packages in
  this repo (2010-2018) use the older, longer format.

## Extracted structure

Counts are extracted + supplementary.

| Session | Section | Mondai |
|---|---|---|
| 1 | MOJI_GOI | 漢字読み (7+5), 表記 (5+3), 文脈規定 (6+4), 言い換え類義 (3+2) |
| 2 | BUNPOU + DOKKAI | 文法形式 (9+7), 文の組み立て (4+1), 文章の文法 (4+1), 短文 (2+1), 中文 (2), 情報検索 (1) |
| 3 | CHOUKAI | 課題理解 (7), ポイント理解 (6), 発話表現 (5), 即時応答 (6) |

The fixture has 14 items, 91 questions (67 extracted, 24 supplementary), and 10 contexts. That
matches the 2012-12, 2013-07, and 2018-07 packages mondai for mondai.

## Answer key

This table covers the extracted questions only. The supplementary questions have no printed key;
their answers are listed in "Supplementary questions".

| Mondai | Fixture | Printed key |
|---|---|---|
| 漢字読み | 3423412 | 3423412 |
| 表記 | 34124 | 34124 |
| 文脈規定 | 242311 | 242311 |
| 言い換え類義 | 314 | 314 |
| 文法形式 | 432423114 | 43222311**4** (see below) |
| 文の組み立て | 1123 | 1123 |
| 文章の文法 | 3241 | 3241 |
| 短文 / 中文 | 13 / 41 | 13 / 41 |
| 情報検索 | 1 | not printed |
| 課題理解 | 2122334 | 2122334 |
| ポイント理解 | 144324 | 144324 |
| 発話表現 | 11231 | 11231 |
| 即時応答 | 233213 | 233213 |

- 文法形式 no. 4: the digit string says `2`, but the key's own worked line is 「カメラ（が）ほしいです」,
  and が is choice 4 (choice 2 is か). The fixture uses 4.
- 情報検索 no. 22 has no printed answer. Eggs are cheapest at ② on the 14th (99円) and apples at ④
  on the 13th (50円), which is choice 1 「13日に④、14日に②」.
- All 24 CHOUKAI answers were also checked against the audio content. For example, 課題理解 no. 7
  says to press the black button and then 1006, which is choice 4.

## Audio segmentation

- Timestamped ASR: `manifests/asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`,
  Japanese). Silence evidence: FFmpeg `silencedetect=noise=-32dB:d=0.8`.
- Spans: `manifests/question-audio-timestamps.json`, in absolute seconds of the source MP3.
- Each question clip starts 0.6 s before its 「N番」 onset and ends 1.0 s into the answer pause that
  precedes the next announcement. The two 「1番」 clips were moved later after a check showed the
  first cut still contained 「…始めます」. Their onsets were found with a 0.25 s silence scan.
- Each mondai clip starts 1.0 s before 「問題N」 and ends 0.3 s before the next 「問題N」. The
  問題2 clip includes the mid-test break 「ここで ちょっと 休みましょう」.
- Output format matches `prisma/segment-question-audio-r2.mjs`: MP3, mono, 32 kHz, 64 kbps,
  metadata stripped. The source's embedded cover art is not copied.
- Verification: every question clip was re-transcribed. Each starts with its own 「N番」, and none
  contains the next question's announcement. All 28 clip durations are within 0.1 s of plan.

## Media

- `manifests/r2-upload-results.json`: 28 audio clips and 12 images under
  `jlpt-exam/test-packages/n5-2024-07/`, keyed by SHA-256 prefix with immutable cache headers.
  Every object was checked with HeadObject and downloaded from the public URL with a matching
  SHA-256.
- Images were cropped from the PDF at 200 dpi, checked visually, and stored as JPEG (quality 85).
  The source watermark remains but does not cover any option. The examples (れい) are not included.
- The CHOUKAI layout follows N5 2018-07: one context per mondai holds the mondai clip as
  `storyAudio`, and each question carries its own `questionAudio`.

## Modeling decisions

- 漢字読み no. 1 underlines only 店; the PDF underline also covers の.
- 短文 (2) prints 「学校に行っていま。」; it is stored as 「行っていました。」.
- 15分 is stored as {分|ふん}; the scan's furigana is unclear.
- ポイント理解 no. 6 prints the choices as 「だい4かい」…「だい7かい」, but the audio and the
  question are about 課 (「7課から始めます」, 「何課」). The choices are stored as 「だい4か」…「だい7か」.
- 課題理解 no. 7 keeps the printed key sequences as `answerText` (①→⓪→⑥ and so on) in addition to the
  image.
- Other picture-choice questions keep `answerText` empty because the alternatives are in
  `questionImage`. 発話表現 and 即時応答 keep `questionText` and spoken choices empty, and the
  unused fourth choice is the schema adaptation for three-choice questions.
- The 情報検索 flyer is a Markdown table in `storyText`, titled 「Yuuki やすい！」 as printed.
- CHOUKAI `questionText` was written from the audio, because no printed script exists.

## Supplementary questions

These 24 questions are original, not from the 2024-07 exam. They were written to bring the package
up to the size of the other N5 packages. Each one is appended after the extracted questions of
its mondai, so the extracted questions keep their order numbers. The fixture schema has no field
for marking a question as original, so this list is the record.

| Mondai | Orders | Answers | Tested points |
|---|---|---|---|
| 漢字読み | 8-12 | 21431 | 八百円, 午後, 白い, 聞いて, 名前 |
| 表記 | 6-8 | 123 | みぎ (右), でんわ (電話), やすみ (休み) |
| 文脈規定 | 7-10 | 3432 | まど, いたかった, あびます, ジュース |
| 言い換え類義 | 4-5 | 21 | せまい = ひろくない, おととい = ふつかまえ |
| 文法形式 | 10-16 | 1323124 | と, 〜たり〜たり, まだ, 〜てから, 〜に行く, どうして, 〜くなる |
| 文の組み立て | 5 | 4 | 〜たあとで (★ = としょかん) |
| 文章の文法 | 5 | 2 | blank (26): とても with positive past |
| 短文 | 3 | 4 | new notice `ctx-dokkai-4-3`: class trip and rainy-day rule |

Level checks:

- Every 漢字読み target and every 表記 answer uses only kanji from the 80-kanji N5 list.
- New text outside the 表記 options has furigana on every kanji. Kanji outside the N5 list appear
  only with furigana.
- Content words were checked against `src/flashcard-data/vocab/n5.json`. きたない is listed as
  N4 there, so 言い換え uses せまい instead. カレー is not listed, so it was replaced.
- Grammar points come from `src/bunpou-data/points/n5.json`. 〜ながら is not in that list, so it
  is not used.
- No supplementary question repeats a point tested by an extracted question in the same mondai.
- A separate reviewer solved all 24 questions without the key. Its answers matched the fixture on
  all 24, it found exactly one defensible answer for each, and it found nothing above N5. The
  notice originally said 「おかしは 学校が 買います」; the reviewer flagged it as unnatural, so
  that sentence was removed.

The 文章の文法 change affects the extracted passage:

- The blanks are numbered by question position in session 2. With 16 文法形式 and 5 文の組み立て
  questions, the blanks are now (22)-(26) instead of (14)-(17), as in the 2018-07 package. The
  instruction says 「22 から 26」.
- Blank (26) was added to the last sentence of レーさん's essay as
  「…みそしるは (26) おいしかったです。」. The rest of the passage is unchanged.

## Not done

- `audioTranscript` is not set. The whisper output is not a human-audited transcript, so it does
  not meet the contract. Use the existing CHOUKAI transcript pipeline and audit its output.
- Explanations are not generated: `npm run gen:explanation -- --file n5-2024-07.json`.

## Database

- The first seed created the 67-question version as package id 49.
- After the supplement, `seed:test-package --replace-existing` replaced it with the 91-question
  version as package id 50. Package 49 had no attempts, comments, practice answers, or bunpou links
  at the time.
- A follow-up run reports `SKIP … sudah lengkap (id=50)`. A field-by-field comparison of all 91
  questions (text, answer, choices, context) and the 14 instructions found no differences from the
  fixture.
