# N3 2018-07 Choukai audio segmentation

## Scope and source

- Package: `n3-2018-07`
- Source audio: `audio.mp3`
- Source duration (FFprobe): `2241.567347 s`
- Source stream: MP3, 44.1 kHz, stereo, 68,389 bit/s
- Script/order source: `ocr/answers-all.txt` listening-script block headed `2018 年07月N3 聴力原文`, corroborated by rendered answers pages containing the script (`rendered/answers/page-32.png` onward).
- Question-page source: `rendered/questions/page-13.png` (printed page 12). `rendered/questions/page-14.png` was promotional/app content rather than a JLPT question page.
- Segmentation method: script sequence plus long silence intervals detected with FFmpeg `silencedetect=noise=-35dB:d=0.8`; conservative section cuts were placed at the start of the long silence immediately before the next section's material.
- Timestamped Japanese ASR: **unavailable**. No local timestamped ASR executable/artifact was present, so marker evidence is explicitly not claimed.
- Overall status: **needs_review** (all five clips). Acoustic/script ordering is usable for staging, but marker-level ASR and final boundary ownership still require review.

## Boundary ledger

The source spans are half-open `[start, end)` seconds. FFmpeg MP3 encoding introduces small frame-padding/readback differences; the FFprobe durations below are the authoritative output readback values.

| Clip | Mondai / type | Intended source span (s) | Selected silence evidence | Marker evidence | FFprobe duration (s) | Status |
|---|---|---:|---|---|---:|---|
| `n3-2018-07-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | `0.000–687.222` | Section-start clip; no preceding boundary selected. Next-section silence begins `687.222–707.486` (20.265 s). | unavailable (no timestamped ASR) | `687.255510` | `needs_review` |
| `n3-2018-07-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | `687.222–1095.723` | `687.222–707.486` (20.265 s), immediately before the next section's material; following boundary silence begins `1095.723–1115.990` (20.267 s). | unavailable (no timestamped ASR) | `408.528980` | `needs_review` |
| `n3-2018-07-03.mp3` | 問題3 / `CHOUKAI_OUTLINE` | `1095.723–1315.746` | `1095.723–1115.990` (20.267 s); following boundary silence begins `1315.746–1330.811` (15.065 s). | unavailable (no timestamped ASR) | `220.055510` | `needs_review` |
| `n3-2018-07-04.mp3` | 問題4 / `CHOUKAI_EXPRESSION` | `1315.746–1509.866` | `1315.746–1330.811` (15.065 s); following boundary silence begins `1509.866–1518.094` (8.227 s). | unavailable (no timestamped ASR) | `194.168163` | `needs_review` |
| `n3-2018-07-05.mp3` | 問題5 / `CHOUKAI_QUICK_RESPONSE` | `1509.866–2241.567` | `1509.866–1518.094` (8.227 s), retained at the start of this final section; ends at source duration. | unavailable (no timestamped ASR) | `731.715918` | `needs_review` |

## Acoustic evidence

Long silence candidates used for the four section boundaries:

- `687.222–707.486` — 20.264558 s
- `1095.723–1115.990` — 20.267000 s
- `1315.746–1330.811` — 15.064694 s
- `1509.866–1518.094` — 8.227415 s

These are not equal-duration splits. The selected boundaries preserve the script's five-mondai sequence and the following section's leading material. Because there is no timestamped ASR, this manifest does not label any cut as an ASR-confirmed `問題N` marker boundary.

## Output files

- `generated/audio/n3-2018-07-01.mp3`
- `generated/audio/n3-2018-07-02.mp3`
- `generated/audio/n3-2018-07-03.mp3`
- `generated/audio/n3-2018-07-04.mp3`
- `generated/audio/n3-2018-07-05.mp3`

All five outputs were read successfully by FFprobe as stereo 44.1 kHz MP3 files. No repository, Cloudinary, or remote-media writes were performed.
