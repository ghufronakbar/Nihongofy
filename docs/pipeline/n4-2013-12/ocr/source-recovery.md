# N4 2013-12 source recovery

## Extraction method

The supplied PDF is image-only (no embedded text). Written-question content was recovered from the original question scans—not the answer key—using high-resolution page rendering, Japanese OCR, focused visual readback, and source-pixel verification for ambiguous glyphs. The compact answer key on scan 14 was used only to populate `questionAnswer`.

## Page coverage

| Scan | Original content recovered |
|---:|---|
| 2 | Moji Goi Mondai 1 (Q1–9), Mondai 2 (Q10–14) |
| 3 | Moji Goi Mondai 2 (Q15), Mondai 3 (Q16–25), Mondai 4 (Q26–28) |
| 4 | Moji Goi Mondai 4 (Q29–30), Mondai 5 (Q31–35), Bunpou Mondai 1 begins |
| 5 | Bunpou Mondai 1 Q3–15, Mondai 2 Q16–17 |
| 6 | Bunpou Mondai 2 Q18–20, Mondai 3 Q21–25 |
| 7 | Dokkai Mondai 4 contexts (1)–(3), Q26–28 |
| 8 | Dokkai Q29 and Mondai 5 context/Q30–32 |
| 9 | Dokkai Q33 and Mondai 6 context/Q34–35 |
| 10–13 | Choukai choice/picture material |
| 20–23 | Choukai transcript/script, used for boundary QA only |

## Answer-key rows read from scan 14

```text
Moji Goi M1: 322411342
Moji Goi M2: 143214
Moji Goi M3: 1321234241
Moji Goi M4: 21432
Moji Goi M5: 44211
Bunpou M1: 314144242232131
Bunpou M2: 21334
Bunpou M3: 41132
Dokkai M4: 2134
Dokkai M5: 2124
Dokkai M6: 34
Choukai M1: 32424343
Choukai M2: 3243211
Choukai M3: 22312
Choukai M4: 12331132
```

## Focused correction

Moji Goi Q11 was source-pixel rechecked because generic OCR reordered/misread the four small kanji. The source choices are `1. 間いて`, `2. 閉いて`, `3. 閑いて`, `4. 開いて`; the answer-key code `4` therefore resolves to `開いて`.
