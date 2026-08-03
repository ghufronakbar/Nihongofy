# N2 2013-12 review result

Status: `auto_pass_candidate` for data/media review. Merge and production seed still require explicit approval.

## Resolved items

1. **Cloudinary media** — five per-mondai MP3 clips were uploaded directly to `jlpt-exam/data/n2-2013-12`. Every result was read back through the Cloudinary Admin API and its public HTTPS URL returned `206 audio/mpeg` with MP3 bytes.
2. **Dokkai OCR** — four previously ambiguous source phrases were resolved by direct pixel review:
   - `多田庭園`
   - `教えた仕事だけは`
   - `論戦が闘わされていることでしょう`
   - `美術館に展示（注１）してあるものに正解は一つもない`
3. **Choukai 問題5 key** — direct source review confirms: 1番=`2`, 2番=`3`, 3番質問1=`1`, 3番質問2=`3`.
4. **Choukai 問題4 modeling** — the source has three spoken responses. The repository contract requires exactly four choices, so an empty fourth choice is retained as a documented schema adapter. Correct answers are all in the source range 1–3.
5. **Audio boundaries** — each boundary is supported by a timestamped Japanese ASR section marker plus an immediately preceding silence interval. Edge transcript inspection confirms every clip begins with its own `問題N` announcement and ends before the next. Waveform QA found no obvious clipping, empty files, or abnormal amplitude.
6. **Transcript uncertainties** — degraded transcript phrases were checked against source pixels and timestamped audio where available. Transcript remains QA provenance and is not inserted into audio-only UI fields.

## Deterministic validation gates

- Root schema shape and allowed keys
- 17 unique contexts
- 19 test package items
- 107 questions
- Exactly four choices with unique `codeAnswer` 1–4
- Valid `questionAnswer`
- Resolvable context references
- N2 session/section consistency
- Balanced supported markup; no raw HTML
- Five non-null Cloudinary `storyAudio` URLs with API readback and HTTP byte verification
- Six local MP3 files verified with FFprobe

## Repository-wide pre-existing gates

These remain unrelated to this data diff:

- `npm run lint`: existing React hook errors in `src/components/ui/carousel.tsx` and `src/hooks/use-mobile.ts`.
- `npm run build`: compiles, then existing Prisma client type generation lacks the `JlptSection` export.

No Drive mutation, production database seed, merge, or deployment action was performed.
