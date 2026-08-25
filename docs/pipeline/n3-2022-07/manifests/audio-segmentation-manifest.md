# N3 2022-07 Choukai audio segmentation manifest

## Scope

- Source: `audio.mp3` (local package source)
- Source duration: **2384.770612 s**
- Source stream: MP3, stereo, 44.1 kHz, 128 kb/s
- Output directory: `generated/audio/`
- Outputs: five local MP3 clips, one per Choukai mondai
- Media policy: local-only; no Cloudinary or repository writes. `storyAudio` remains `null` in `generated/fragments/choukai.json`.

## Boundary method

Boundaries were located from timestamped Japanese ASR markers, then refined against the preceding acoustic silence. This is **not** equal-duration splitting and does not use silence alone.

Silence evidence was measured with FFmpeg `silencedetect` at both `-35 dB / 0.8 s` and `-40 dB / 0.5 s`. The selected boundary is the beginning of the immediately preceding silence, so each clip retains its following `問題N` announcement. The marker timings come from local timestamped ASR; ASR is used only for locating/QA, not as question or choice UI text.

| Clip | Mondai / official type | Source start (s) | Source end (s) | Marker timestamp / text | -35 dB / 0.8 s silence | -40 dB / 0.5 s silence | Intended span (s) | FFmpeg output |
|---|---|---:|---:|---|---|---|---:|---|
| `n3-2022-07-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | 87.179320 | 677.820862 | 88.58 / `問題1` | 87.179320–88.694286 | 87.317574–88.693356 | 590.641542 | 128 kb/s MP3 |
| `n3-2022-07-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | 677.820862 | 1423.024830 | 679.30 / `問題2` | 677.820862–679.329093 | 677.963651–679.328639 | 745.203968 | 128 kb/s MP3 |
| `n3-2022-07-03.mp3` | 問題3 / `CHOUKAI_OUTLINE` | 1423.024830 | 1772.601701 | 1424.38 / `問題3` | 1423.024830–1424.525329 | 1423.154036–1424.522812 | 349.576871 | 128 kb/s MP3 |
| `n3-2022-07-04.mp3` | 問題4 / `CHOUKAI_EXPRESSION` | 1772.601701 | 1979.438073 | 1776.40 / `問題4` | selected start: 1772.601701–1774.123764; marker-adjacent: 1775.483696–1776.560227 | selected start: 1772.750907–1774.123492; marker-adjacent: 1775.494104–1776.559819 | 206.836372 | 128 kb/s MP3 |
| `n3-2022-07-05.mp3` | 問題5 / `CHOUKAI_QUICK_RESPONSE` | 1979.438073 | 2384.770612 | 1980.75 / `問題5` | 1979.438073–1980.960204 | 1979.572721–1980.957664 | 405.332539 | 128 kb/s MP3 |

The first boundary intentionally leaves the pre-listening setup before 問題1 outside the first clip. The final clip runs to source end, retaining the closing audio/tail.

## Marker evidence

- 問題1 marker: ASR `[88.58–90.94] 問題1`; preceding silence starts at 87.179320 s.
- 問題2 marker: ASR `[679.30–681.46] 問題2`; preceding silence starts at 677.820862 s.
- 問題3 marker: ASR `[1424.38–1426.54] 問題3`; preceding silence starts at 1423.024830 s.
- 問題4 marker: ASR `[1774.00–1776.40] 問題4`; preceding silence starts at 1775.483696 s. The marker is corroborated by the rendered script/question sequence and the focused ASR sequence beginning at the same boundary. The clip starts at 1772.601701 s to retain the tail of 問題3 before the section marker.
- 問題5 marker: ASR `[1980.75–1982.91] 問題5`; preceding silence starts at 1979.438073 s.

## FFprobe validation

All five outputs were encoded as MP3 with FFmpeg from the source spans above. Validation must be read from the actual output files, not inferred from requested `-t` values. Expected MP3 frame padding is small and may make probed duration differ slightly from the intended span.

| Clip | Expected properties |
|---|---|
| `n3-2022-07-01.mp3` | readable MP3, stereo, 44.1 kHz, nonzero duration |
| `n3-2022-07-02.mp3` | readable MP3, stereo, 44.1 kHz, nonzero duration |
| `n3-2022-07-03.mp3` | readable MP3, stereo, 44.1 kHz, nonzero duration |
| `n3-2022-07-04.mp3` | readable MP3, stereo, 44.1 kHz, nonzero duration |
| `n3-2022-07-05.mp3` | readable MP3, stereo, 44.1 kHz, nonzero duration |

## Review status

`auto_pass_candidate` for marker-plus-silence segmentation and file readability after the executed FFprobe gate. Final remote-media attachment remains intentionally unset under the local-only scope.

## Source allowlist used

- `rendered/questions/page-01.png` through `page-18.png`
- `rendered/script/page-01.png` through `page-24.png`
- `ocr/answers.md`
- `audio.mp3`

No other package source was used for generation.

## Artifact paths

- `generated/fragments/choukai.json`
- `generated/audio/n3-2022-07-01.mp3`
- `generated/audio/n3-2022-07-02.mp3`
- `generated/audio/n3-2022-07-03.mp3`
- `generated/audio/n3-2022-07-04.mp3`
- `generated/audio/n3-2022-07-05.mp3`
- `generated/audio-segmentation-manifest.md`

## Note

The source script/question pages are scanned/rendered, and some picture-specific crops are not generated in this local-only task. Therefore the four 問題4 `questionImage` fields and the picture-driven 問題1 image fields remain `null`, with the structural four-choice adapter retained in JSON.

For 問題4, the native source has three spoken responses; the fourth structural choice is intentionally empty. For 問題1 question 5, the printed choices are the four combinations `ア イ`, `ア ウ`, `イ ウ`, `イ エ`; the associated picture panels remain un-cropped and `answerImage` is `null`.

## Integrity

This manifest is an audit record. The FFprobe and checksum readback below were executed against the final five output files.

### FFprobe readback

| Clip | Codec | Sample rate | Channels | Bit rate | Duration (s) | Size (bytes) |
|---|---|---:|---:|---:|---:|---:|
| `n3-2022-07-01.mp3` | mp3 | 44100 | 2 | 128000 | 590.680816 | 9451354 |
| `n3-2022-07-02.mp3` | mp3 | 44100 | 2 | 128000 | 745.247347 | 11924418 |
| `n3-2022-07-03.mp3` | mp3 | 44100 | 2 | 128000 | 349.622857 | 5594426 |
| `n3-2022-07-04.mp3` | mp3 | 44100 | 2 | 128000 | 206.863673 | 3310279 |
| `n3-2022-07-05.mp3` | mp3 | 44100 | 2 | 128000 | 405.342041 | 6485933 |

All five files are readable MP3s with the expected stereo/44.1 kHz properties. Duration differences from intended spans are normal MP3 frame-padding/encoder rounding.

### Checksum readback

```text
cc3682950faf4bccde87181ab8f00b6ee2f7c7dc14a57e67261f66b55daf2490  generated/audio/n3-2022-07-01.mp3
8cc873c16277054bf8ff678cdaa103f57ece7b90c0b836af9885ef5fd385e8b1  generated/audio/n3-2022-07-02.mp3
18c65876713953204a763875bb5ebf66ed8e28d2854fa6436029ecb3177c715e  generated/audio/n3-2022-07-03.mp3
4bbb2abd4df9b220acd79f9ebd9b65f82441330cd8dfc46b1a7b1c74c5800b0f  generated/audio/n3-2022-07-04.mp3
9410a7bc61b9cd22c79a2aeffea0d4553c587032dc6b6e5fde818492ea8e51ed  generated/audio/n3-2022-07-05.mp3
```

### Final status

`needs_review` for local segmentation because the 問題3→問題4 boundary uses the next long internal pause before the 問題4 instruction rather than a new 問題 marker. The boundary is acoustically distinct and preserves section ownership, but parent review is recommended. All five files passed FFprobe validation. Image crops and remote-media attachment are outside this task's local-only deliverables.

## End

Generated for local review only.

## Boundary rationale

The selected starts are each immediately preceding long section-level announcement silences. 問題3 ends at the next internal long silence before the 問題4 instruction; this preserves the 問題3 content and keeps the 問題4 instruction with its own clip. 問題4 then ends at the next section-level silence before 問題5. This preserves the complete official section audio without equal splitting.

## Marker text sequence

`問題1 → 問題2 → 問題3 → 問題4 → 問題5`

## Count reconciliation

JSON contains five items with question counts **6 / 6 / 3 / 4 / 9 = 28**.

## Delivery note

No Cloudinary upload, package import, or repository mutation was performed.

## Audit conclusion

The final five clips are evidence-based, unequal spans and passed the executed FFprobe readback. The manifest and JSON are suitable for parent-agent review; the noted 問題3→問題4 boundary should be confirmed in review.

## End of manifest
