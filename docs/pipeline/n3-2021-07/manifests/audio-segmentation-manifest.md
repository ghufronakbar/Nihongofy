# N3 2021-07 聴解 audio segmentation manifest

## Scope and evidence

- Package root: `/opt/data/jlpt-pipeline/sources/n3-2021-07`
- Source audio: `audio.mp3`
- Source audio probe: MP3, stereo, 44,100 Hz, 128 kb/s, duration `2160.326531 s`.
- Source script sequence: `rendered/script/page-01.png` through `page-19.png`.
- Printed question pages read: `rendered/questions/page-14.png` through `page-16.png`.
- Answer source read: `ocr/answers-all.txt` (it contains no Choukai key; Choukai answers were taken from the red `正解` values in the rendered script pages).
- Timestamped ASR: **not available**. No ASR marker evidence is claimed.
- Boundary method: authoritative script/session sequence plus acoustic silence detection at `-35 dB`, minimum `0.8 s`. The selected cuts use long transition silences consistent with the five script mondai sequence. All boundary statuses remain `needs_review` because no timestamped ASR marker corroboration was available.
- Audio-only UI semantics are preserved in `generated/fragments/choukai.json` with empty question/choice text. Picture crops were not written; image fields remain `null` and crop needs are documented in the JSON review notes.

## Expected Choukai structure

| Output | Official type | Count | Answer sequence | Source script answer evidence |
|---|---|---:|---|---|
| `n3-2021-07-01.mp3` | `CHOUKAI_TASK_BASED` | 6 | `441212` | script pages 01–06, red `正解` values |
| `n3-2021-07-02.mp3` | `CHOUKAI_MAIN_POINT` | 6 | `322413` | script pages 07–12, red `正解` values |
| `n3-2021-07-03.mp3` | `CHOUKAI_OUTLINE` | 3 | `441` | script pages 13–14, red `正解` values |
| `n3-2021-07-04.mp3` | `CHOUKAI_EXPRESSION` | 4 | `3113` | script pages 15–16, red `正解` values |
| `n3-2021-07-05.mp3` | `CHOUKAI_QUICK_RESPONSE` | 9 | `231222112` | script pages 17–19, red `正解` values |

Total: `6 + 6 + 3 + 4 + 9 = 28` questions.

## Selected source spans and acoustic evidence

The selected spans are source-time spans in seconds. MP3 encoder padding accounts for small readback differences in the output durations.

| Clip | Source start | Source end | Intended span | Start/end evidence | Marker evidence | Status |
|---|---:|---:|---:|---|---|---|
| `n3-2021-07-01.mp3` | `0.000` | `516.993` | `516.993 s` | Source begins at the initial silence (`0.000–3.468 s`); end is the start of the transition silence (`516.993–524.015 s`). | unavailable (no ASR) | `needs_review` |
| `n3-2021-07-02.mp3` | `516.993` | `1274.193` | `757.200 s` | Start uses the same transition-silence boundary; end is the start of the next long transition silence (`1274.193–1287.061 s`). | unavailable (no ASR) | `needs_review` |
| `n3-2021-07-03.mp3` | `1274.193` | `1624.835` | `350.642 s` | Start uses the `1274.193–1287.061 s` transition silence; the script sequence places the next mondai transition at `1454.003–1462.160 s` within this provisional span, and the selected end is the next clear session boundary at `1624.835–1633.483 s`. | unavailable (no ASR) | `needs_review` |
| `n3-2021-07-04.mp3` | `1624.835` | `1805.465` | `180.630 s` | Start uses `1624.835–1633.483 s`; end is the start of the next long transition silence (`1805.465–1815.948 s`). | unavailable (no ASR) | `needs_review` |
| `n3-2021-07-05.mp3` | `1805.465` | `2160.326531` | `354.862 s` | Start uses `1805.465–1815.948 s`; final clip ends at source duration and retains the official closing tail, including final detected silence (`2156.308–2160.301 s`). | unavailable (no ASR) | `needs_review` |

### Boundary review note

The source recording has repeated long reading/pause blocks inside session 3, particularly in the six-question main-point material and the quick-response material. Silence alone cannot prove a mondai boundary. The selected spans therefore follow the rendered script sequence and the observed session transition pattern rather than equal splitting or an unsupported claim of marker recognition. A future timestamped Japanese ASR pass should verify the spoken `問題1`–`問題5` markers and whether the provisional `問題3`/`問題4` transition is best represented by a separate marker-adjacent cut. Until then, every boundary is explicitly `needs_review`.

## Output readback / local-only policy

- `storyAudio` remains `null` in all five JSON contexts because no remote media URL is permitted in this task.
- No Cloudinary or repository writes were performed.
- No image crops were written. `CHOUKAI_EXPRESSION` question images and the picture-choice images are `null` pending permitted crop generation/review.
- Final clip files are exactly the five canonical package-local MP3s listed above.
- FFprobe readback completed for all five clips: each is readable MP3, stereo, 44,100 Hz.

## FFprobe readback

| Clip | Probed duration | Codec | Sample rate | Channels |
|---|---:|---|---:|---:|
| `n3-2021-07-01.mp3` | `517.041633 s` | `mp3` | `44100` | `2` |
| `n3-2021-07-02.mp3` | `757.237551 s` | `mp3` | `44100` | `2` |
| `n3-2021-07-03.mp3` | `350.693878 s` | `mp3` | `44100` | `2` |
| `n3-2021-07-04.mp3` | `180.662857 s` | `mp3` | `44100` | `2` |
| `n3-2021-07-05.mp3` | `354.873469 s` | `mp3` | `44100` | `2` |

The total probed clip duration differs from the source by normal independent MP3 frame padding and is not used as evidence of contiguous source coverage.
