# N4 2013-07 review notes

## Candidate package

- Package: `JLPT N4 - 2013年07月`
- 15 mondai items
- 98 questions total
- MOJI_GOI 35 / BUNPOU 25 / DOKKAI 10 / CHOUKAI 28
- Parent-side deterministic validator: PASS

## Media

- 4 audio clips were cut from the source recording using ASR markers plus long-silence evidence.
- 5 問題3 prompt images were uploaded and independently verified with Cloudinary Admin readback and HTTPS byte-range/MIME checks.
- 4 問題1 問題5 answer panels were uploaded and independently verified the same way.
- The upload script was corrected after finding a duplicated input loop. The final manifest is deduplicated by `public_id`; no second upload was needed. Unique asset count: 13.
- 問題3 Q1 and Q5 image crops retain complete source panel borders; figures terminate at the original illustration frame. Keep this provenance visible for reviewer confirmation rather than silently treating the frame as a crop margin.

## Source / OCR

- The combined PDF has a corrupt/garbled text layer; native rendered scans were the primary transcription source.
- Scan 8→9 cross-page information-retrieval context is preserved in `ctx-info`.
- Compact answer rows are recorded per mondai in `ocr/answers-and-transcript.md` and compared literally by the validator.
- Three extraction workers failed before writing because of upstream 502/timeout retries; no worker self-report was used as evidence. Exact OCR artifacts were written and read back parent-side.

## Checks

- JSON parse: PASS
- Strict package validator: PASS
- Audio FFprobe/decode: PASS
- Cloudinary Admin + HTTPS readback: PASS for all 13 unique assets
- Production build: PASS
- Repository lint: baseline failure in untouched files only:
  - `src/features/question-comment/components/question-comment-form.tsx:30` (`react-hooks/incompatible-library`, warning)
  - `src/hooks/use-mobile.ts:14` (`react-hooks/set-state-in-effect`, error)
  - The lint command reports 2 errors and 2 warnings total; all are outside this data/audit diff.

## Delivery status

`candidate_generated_needs_review`: the package is structurally complete, but the PR remains review-only until source/OCR and listening image provenance are inspected. Do not seed/import or merge without explicit approval.

Raw source PDF/audio remain outside Git.
