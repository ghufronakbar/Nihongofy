# N4 2013-12 review notes

## Completed and verified

- Written source coverage is complete for all 70 written questions.
- Answer mappings reconcile literally to the compact answer key: 98 total questions.
- Listening type/count mapping is source-derived: `8 / 7 / 5 / 8`.
- 19 source-native picture crops were inspected. The initially too-tight four vehicle crops were regenerated and individually passed visual QA.
- 4 MP3s and 19 PNGs were uploaded to Cloudinary under `jlpt-exam/data/n4-2013-12`. Every asset has Admin API readback and independent HTTPS byte-range/MIME verification.

## Audio review approved

The four Choukai clips were segmented using timestamped Japanese ASR markers plus long silence intervals. The user reviewed the full per-Mondai playback files on Discord and approved all four final cuts. Final local audio checksums are identical to those reviewed files, then the four Cloudinary audio assets were overwritten and verified again via Admin readback plus independent HTTPS range/MIME checks.

The final audio ledger, exact spans, checksums, and approval status are in `manifests/audio-segmentation-manifest.json`.

The JSON deliberately leaves Choukai spoken text empty where the original test UI is audio-only; it does not insert the transcript as on-screen question/choice text.

## Three-choice listening schema adapter

The original instructions for `CHOUKAI_EXPRESSION` (Mondai 3) and `CHOUKAI_QUICK_RESPONSE` (Mondai 4) explicitly say to choose from `1から3`. The repository schema nevertheless requires exactly four `questionChoices` with codes `1, 2, 3, 4` for every question. For these two Mondai types only, choices 1–3 preserve the source's spoken alternatives as audio-only empty text; code 4 is a required **empty structural adapter**, not an invented fourth spoken answer. Every official answer in these Mondai remains in codes 1–3. The original instruction text remains unmodified in the JSON.
