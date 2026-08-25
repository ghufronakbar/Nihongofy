# JLPT N3 — December 2022 question-page manifest

Source: `questions.pdf` and rendered pages under `rendered/questions/`.
Text cross-check: `ocr/questions-all.txt` plus per-page OCR files. This is a page-role/layout manifest only; no final JSON is generated here.

## Scope and numbering

- PDF scan pages: 1–25.
- Scan page 1 is a vocabulary-section cover/instruction page with no printed page number and no test questions.
- Scan pages 2–6 are printed pages 1–4 of Language Knowledge (文字・語彙), followed by printed page 5 of Grammar/Reading; the rendered files are named by scan page (`page-01.png` … `page-25.png`).
- Scan pages 6–19 are printed pages 5–18 of 文法・読解.
- Scan pages 20–25 are printed pages 19–24 of 聴解.
- Written question numbering is global within the relevant booklet parts: vocabulary 1–35, grammar/reading 1–38. Listening numbering resets by mondai and is local (番).
- The rendered pages carry a recurring diagonal third-party watermark (Tôi Yêu Ngoại Ngữ Group / Yuuki Bùi or similar). It is not exam content and can interfere with OCR, especially over dense text and illustrations.

## Page-role table

| Scan page / rendered file | Printed page | Section / role | Mondai | Question range | Contexts, tables, images | OCR / layout anomalies and evidence |
|---|---:|---|---|---|---|---|
| 1 / `page-01.png` | — | Vocabulary cover/instructions | — | none | Cover/instruction design; registration-number and name fields; no question media | OCR text is blank. Rendered page visibly has the N3 2022-2 vocabulary cover, notes, and blank form-like fields. Do not treat note numerals 1–5 as question numbers. |
| 2 / `page-02.png` | 1 | Language Knowledge — Vocabulary (`もじ・ごい`) | 問題1, 問題2 | 問題1: 1–8; 問題2: 9–12 | Standalone sentence items; no passages, tables, charts, or images | OCR has `問題1`/`問題2` correctly, but contains duplicated punctuation in Q1 (`います。。`) and watermark/footer attribution. Q11 OCR reads `いの調子`; visual/layout indicates the intended blank is the body-part word. |
| 3 / `page-03.png` | 2 | Language Knowledge — Vocabulary | 問題2, 問題3 | 問題2: 13–14; 問題3: 15–24 | Standalone sentence items; no tables/images | OCR heading is corrupted as `間題3` and `人れる`; Q14 has `いっぱんできな` rather than the printed `一般的な`-type wording. Footer watermark text is extracted as content. |
| 4 / `page-04.png` | 3 | Language Knowledge — Vocabulary | 問題3, 問題4, 問題5 | 問題3: Q25; 問題4: 26–30; 問題5: Q31 | Standalone vocabulary sentences and choices; no tables/images | OCR omits/normalizes underline locations and has spacing/punctuation artifacts. Section transitions occur mid-page. |
| 5 / `page-05.png` | 4 | Language Knowledge — Vocabulary | 問題5 | 32–35 | Four usage-in-context blocks; no tables/images | OCR has irregular spaces and punctuation, e.g. `A 銀行とB 銀行`; watermark/footer attribution. Printed range is continuous 31–35 across pages 4–5. |
| 6 / `page-06.png` | 5 | Grammar/Reading (`文法・読解`) | 問題1 | 1–7 | Mostly standalone grammar sentences. Context labels/dialogues: classroom (Q1, Q4), Kitayama City website (Q2), phone/general speech and dentist dialogue (Q7) | Header OCR has `文法・読解・（70 分）`; hyphen/long-vowel and line-wrap artifacts (`スピ—チ`). No tables/images. |
| 7 / `page-07.png` | 6 | Grammar/Reading | 問題1, 問題2 | 問題1: Q8–13 (Q8–12 continue; Q13 is shoe-store dialogue); 問題2: 14–18 | Dialogues: telephone Q8/Q11, directions Q9, casual conversation Q10, shoe shop Q13. Sentence-ordering/star items Q14–18 | OCR reading order is anomalous: options for Q12 appear after the start of 問題2/Q14–18 in `questions-all.txt`; visual page layout should be used to associate Q12 choices and Q13. OCR corrupts heading as `次の文のに ★ 人る` and star/underline markers. |
| 8 / `page-08.png` | 7 | Grammar/Reading | 問題2, 問題3 | 問題2: Q14–18; 問題3 begins with instructions/passage, blanks 19–22 | Q14–18 sentence ordering; Q19–22 shared essay context `京都旅行`, international-student composition by グエン ティ ラン | OCR order places Q13 after Q14–18, although page layout starts with Q13 tail then 問題2. Star markers and underlines are fragile. The passage page intentionally has blanks but no answer choices; choices are on page 10. |
| 9 / `page-09.png` | 8 | Grammar/Reading | 問題3 | passage for Q19–22 | Shared passage: `京都旅行`; ryokan/onsen, lost wristwatch, kindness of inn staff | OCR extracts large blank regions as empty lines and may drop box geometry around numbered blanks. Passage is text-only; no table/image. |
| 10 / `page-10.png` | 9 | Grammar/Reading | 問題3, 問題4 begins | Q19–22 choices; 問題4 instructions | Four choice sets for the page-9 essay; no new passage yet | OCR correctly separates Q19–22 choices but watermarks/footer are mixed into text. Section transition begins at bottom/next role; keep choices linked to page-9 shared context. |
| 11 / `page-11.png` | 10 | Grammar/Reading | 問題4 | Q23; passage (2) begins | Passage (1): company/copy-machine notice (`会社で`), boxed notice/table-like bordered insert; Q23. Passage (2): daughter learning to throw a ball begins | OCR merges the bordered notice into normal prose and places notice lines after Q23 in extraction order. Printed question number appears as boxed/overlaid `23` and may OCR as `2３`. |
| 12 / `page-12.png` | 11 | Grammar/Reading | 問題4 | Q24–25 | Q24 uses passage (2), television/ball-throwing context. Passage (3) is a store email about a sold-out brown leather wallet; Q25 | OCR separates email lines imperfectly and may confuse boxed numerals (`２４`, `２５`) with ordinary text. Email is a bordered/document-like context, not an image. |
| 13 / `page-13.png` | 12 | Grammar/Reading | 問題4 | Q26 | Passage (4): flyer/essay about exchanging unwanted old shoes for discount coupons and using incineration heat for energy; note `燃やす：焼く` | OCR is mostly linear but loses visual emphasis/spacing in the flyer-like text. Q26 is the only numbered question on this page; no actual image/table. |
| 14 / `page-14.png` | 13 | Grammar/Reading | 問題5 | Q27–29 | Passage (1): radio memories; references ①懐かしい声 and ②また、ラジオ; three comprehension questions | OCR may drop furigana and punctuation around numbered references. Text-only passage; no tables/images. |
| 15 / `page-15.png` | 14 | Grammar/Reading | 問題5 | Q30–32 | Passage (2): rural relocation/farming information session; references ①説明会 and ②共通点 | OCR normalizes full-width numerals and has spacing around paragraph breaks. Text-only passage; no tables/images. |
| 16 / `page-16.png` | 15 | Grammar/Reading | 問題6 | passage; Q33–36 choices not yet printed | Shared sleep/temperature passage: insomnia, exercise timing, body-center temperature, warm bath; final blank for Q36 | Page is passage-only with a large empty lower area; OCR may lose underlined/reference markers ①–③ and line breaks. Choices are on page 17. |
| 17 / `page-17.png` | 16 | Grammar/Reading | 問題6 | Q33–36 | Choice page for page-16 shared sleep passage | OCR has line spacing and full-width numeral variation (`３３` etc.); no tables/images. Keep Q33–36 attached to page-16 context, not as standalone stems. |
| 18 / `page-18.png` | 17 | Grammar/Reading | 問題7 | Q37–38 | Instructions refer to two notices on the right page; questions concern bus-trip selection/cancellation. The actual notices are on page 19. | OCR has blank space where the facing-page notices are absent and has `パス旅行`/`口パート`-like recognition errors. This is a cross-page context dependency. |
| 19 / `page-19.png` | 18 | Grammar/Reading | 問題7 | source/context only; supports Q37–38 | Large four-option bus-tour table: ① city sightseeing + onsen, ② cheese site + museum, ③ museum + onsen, ④ hiking + onsen; prices, meals, departure dates; meeting/application/payment/cancellation rules and contact details | Table structure is essential and must not be flattened without preserving cell ownership. OCR confuses full-width punctuation/numerals (`7、5００`, `１０月３０日`) and duplicates the heading `【お申し込み・お支払い】`; diagonal watermark crosses table. Q37/Q38 are printed on page 18, not page 19. |
| 20 / `page-20.png` | 19 | Listening (`聴解`) | 問題1 | 1–3 (local 番) | Audio-only/listening prompts. Q3 has four answer options consisting of pair combinations `ア イ`, `ア エ`, `イ ウ`, `ウ エ`; no printed picture/table visible | OCR instruction is noisy (`ます質問`, `から`); Q3’s option glyphs and spacing are layout-sensitive. Listening question numbering resets here; do not merge with written Q1–3. |
| 21 / `page-21.png` | 20 | Listening | 問題1 | 4–6 (local 番) | Audio-only/listening prompts; standalone choices; no images/tables | OCR has hiragana segmentation errors (`としよかん`, `ぶんがくぶ`) and large blank lower area. Problem 1 continues from page 20. |
| 22 / `page-22.png` | 21 | Listening | 問題2 | 1–4 (local 番) | Audio-only prompts with four choices each; no printed contextual figures | OCR has `ます質問`/spacing errors and mixed-width numerals. New mondai resets to 1番. |
| 23 / `page-23.png` | 22 | Listening | 問題2, 問題3 | 問題2: 5–6; 問題3: unnumbered audio-only section | Q2 5–6 choices; 問題3 explicitly says nothing is printed for the question and has memo area (`メモ`) | Large blank memo area is intentional for audio-only Q3. OCR may represent the memo area as many empty lines. 問題3 has no printed question range because question/choices are spoken. |
| 24 / `page-24.png` | 23 | Listening | 問題4 | 1–2 (local 番) | Picture-based response questions; two boxed grayscale illustrations, arrows identify the speaker/person; no printed answer choices (choices are heard) | OCR contains only headings/item labels because image content is not text. Rendered page has substantial whitespace below images and watermark crossing illustrations. Q1 label may be misread as `I番`. |
| 25 / `page-25.png` | 24 | Listening | 問題4, 問題5 | 問題4: 3–4; 問題5: unnumbered audio-only section | Two further picture-based Q4 items (images not represented in OCR), then 問題5 instructions and memo area; no printed choices for either audio-only format | OCR is nearly blank for image regions and cannot establish image semantics. Blank memo area for 問題5 is intentional. Problem 5 has no printed question range; response/options are spoken. |

## Cross-page context and question ownership

- Vocabulary: page 2 starts 問題1 and carries into 問題2; page 3 carries 問題2 into 問題3; page 4 carries 問題3 into 問題4 and 問題5; page 5 completes 問題5.
- Grammar/reading: page 6 starts 問題1; page 7 completes 問題1 and starts 問題2; page 8 completes 問題2 and starts the shared 問題3 passage; page 9 continues that passage; page 10 supplies Q19–22 choices and begins 問題4. Preserve the Q19–22 passage/choice split.
- 問題4 has four reading contexts: (1) copy-machine notice (Q23), (2) ball-throwing TV context (Q24), (3) wallet store email (Q25), (4) old-shoes/environment passage (Q26). Contexts can span pages 11–13.
- 問題5 has two passages: radio (Q27–29) and rural relocation (Q30–32), pages 14–15.
- 問題6 passage is on page 16 and its choices on page 17 (Q33–36).
- 問題7 questions are on page 18 while the four-option bus-tour source table is on facing page 19. Model the table as a shared context for Q37–38.
- Listening 問題3 and 問題5 are intentionally audio-only: the printed sheet has instructions and memo space, not stems/choices. 問題4 is image-driven and requires the rendered pages for question media.

## Review flags before JSON generation

1. Use page images for all underlines, furigana, stars, boxed question numbers, and listening illustrations; OCR alone is insufficient.
2. Do not interpret watermark/footer attribution as source text.
3. Resolve page-7 OCR reading-order corruption around Q12, Q13, and 問題2 using the rendered layout.
4. Preserve 問題3 Q19–22 and 問題6 Q33–36 as shared-context records with question choices on later pages.
5. Preserve the page-19 bus-tour table as a structured table context; verify every option’s price, meal, date, and cancellation rule visually.
6. Treat listening local numbering separately from written numbering. Audio-only problems require audio/transcript alignment later, but this manifest does not create transcript data or final JSON.
7. All pages show a third-party diagonal watermark; flag any uncertain character obscured by it for focused crop review.
8. No repository files, PDFs, rendered images, audio, or external services were modified by this manifest task.

## Confidence convention

- `high`: printed header/page/question numbering and role are explicit in OCR and/or rendered page.
- `medium`: role/range is clear, but OCR reading order or text details are affected by cross-page layout, watermark, or tables.
- `review`: image/table/illustration semantics or an OCR conflict must be resolved before final structured data.

Overall page-role confidence is high for all 25 pages; content-level OCR confidence is medium on table/image/audio-only pages and on page 7’s reading order.

## Files inspected

- `/opt/data/jlpt-pipeline/sources/n3-2022-12/questions.pdf`
- `/opt/data/jlpt-pipeline/sources/n3-2022-12/ocr/questions-all.txt`
- `/opt/data/jlpt-pipeline/sources/n3-2022-12/ocr/questions-page-01.txt` … `questions-page-25.txt`
- `/opt/data/jlpt-pipeline/sources/n3-2022-12/rendered/questions/page-01.png` … `page-25.png`

No final JSON was generated.

[End of manifest]

## Post-write verification note

This file was written as the requested intermediate manifest and is read back after writing for verification.
