# N4 2018-12 review notes

## Final package shape

- 15 mondai items
- 98 questions total
- MOJI_GOI 35 / BUNPOU 25 / DOKKAI 10 / CHOUKAI 28
- Answer rows exactly match the compact key and explanation corroboration in `ocr/answers-and-transcript.md`.

## Media

- Four per-mondai audio clips were cut from transcript/ASR/silence-supported boundaries and uploaded under `jlpt-exam/data/n4-2018-12`.
- Five 問題3 prompt images were source-resolution cropped, visually reviewed for border/arrow/artwork completeness, and uploaded/read back.
- 問題1 Q3 and Q6 use four separate printed answer-image panels; all eight answer images were crop-QA'd and uploaded/read back.
- 問題1 Q1, Q2, Q4, Q5 and Q8 use one prompt diagram and were uploaded/read back as question images.
- All 22 Cloudinary assets passed Admin API readback plus independent HTTP byte/MIME checks.

## Schema adapters

- 問題3 and 問題4 have three spoken responses in the source, while the repository requires exactly four choices. Choices 1–3 remain source-semantic empty/audio choices; choice 4 is an empty structural adapter. All official answers remain in 1–3.

## Validation

- JSON parse: PASS
- Deterministic package validator: PASS
- Exact per-item answer-row comparison: PASS
- Context refs, sessions, mondai/section mappings, four-choice shape, sentence-composition slots: PASS
- `git diff --check`: PASS
- `npm run build`: PASS after supplying build-only runtime env placeholders and the configured Cloudinary credentials. No production database was contacted or seeded.
- `npm run lint -- --max-warnings=0`: repository baseline FAIL (2 errors, 2 warnings) in unrelated pre-existing React files, including `src/hooks/use-mobile.ts` (`react-hooks/set-state-in-effect`) and `src/features/question-comment/components/question-comment-form.tsx` (`react-hooks/incompatible-library`). This data PR does not modify those files.

## Production state

No database seed/import or merge has been performed. Repository changes remain isolated to `feat/add-n4-2018-12-package` until review and explicit approval.
