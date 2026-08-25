# N3 July 2017 candidate review notes

- Candidate generated from `ocr/questions-all.txt`; rendered question pages are the source-reference set.
- `storyAudio` is intentionally `null` for all five listening mondai (no audio asset supplied in this local-only task).
- Listening 問題3 and 問題5 are audio-only: printed source has no question/choice text, so structural four-choice rows are empty.
- Listening 問題4 has four `questionImage: null` placeholders; image crops remain unresolved.
- Listening 問題1/2 stems are audio-only and therefore empty; printed page 13/14 choices are retained.
- OCR contains source scan artifacts/typos in places; text is preserved rather than silently corrected.
- Review required before import: verify exact OCR glyphs, sentence-composition slot ordering, listening audio transcription, and 問題4 image crops.

- Recheck found the canonical N3 mapping for listening 問題5 is `CHOUKAI_QUICK_RESPONSE`; the package enum was corrected before final PR update.
- Recheck found the 問題4 q1–q3 crops retain the arrow and relevant scene but have artwork touching/cut at original panel edges; retain `needs_review` for visual crop presentation. q4 is edge-safe.
- ASR marker times are clear at 632.33, 1395.56, 1734.16, and 1923.24. The selected boundary clips remain review-only because no discrete silence intervals were emitted by the current silence scan.
