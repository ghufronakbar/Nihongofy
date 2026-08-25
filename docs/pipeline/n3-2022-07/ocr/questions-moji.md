# N3 2022-07 Moji Goi OCR coverage

Source: `ocr/questions-all.txt`, scan pages 1–3. Official answers: `ocr/answers.md`.

## Coverage

| Item | Official enum | Global questions | Source page | Count | Official answers |
|---|---|---:|---:|---:|---|
| 問題1 | `MOJI_GOI_READ_KANJI` | Q1–7 | 1 | 7 | `1 4 2 4 1 4 3` |
| 問題2 | `MOJI_GOI_WRITE_KANJI` | Q8–13 | 1 | 6 | `4 4 1 2 2 3` |
| 問題3 | `MOJI_GOI_CONTEXT` | Q14–24 | 2 | 11 | `1 2 3 2 4 1 3 3 3 4 3` |
| 問題4 | `MOJI_GOI_SYNONYM` | Q25–29 | 2 | 5 | `3 1 4 1 2` |
| 問題5 | `MOJI_GOI_WORD_USAGE` | Q30–34 | 3 | 5 | `2 3 4 1 1` |

Total: 5 official items, 34 questions, 136 choices. All items use `section: MOJI_GOI` and `session: 1`; question orders are local 1..N within each item.

## Source transcription notes

- Q13 choice 2 and choice 4 are both transcribed as `図面` in the supplied OCR. This is preserved in the JSON rather than inferred or silently corrected.
- Q21 choice 2 is transcribed as `すいた‘` in the supplied OCR, including the trailing mark. This is preserved and should be visually reviewed against the scan.
- Q30 choice 1 is transcribed as `今日は天気がいいから、傘を諦めてよさそうた。` in the supplied OCR. This is preserved as source text and should be visually reviewed.
- The answer values in the JSON follow the official answer rows, independently of semantic plausibility.

The JSON contains four non-empty choices for every question, with `codeAnswer` values 1–4 and no placeholder text.
