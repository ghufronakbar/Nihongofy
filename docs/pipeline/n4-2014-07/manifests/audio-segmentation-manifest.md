# N4 July 2014 Choukai audio segmentation

## Source

- Package: `n4-2014-07`
- Original file: `audio.mp3` (extension retained from Drive download)
- Actual container/codec: MP4/M4A container with AAC audio, stereo, 44.1 kHz
- Source duration: `2298.906009` seconds
- Source SHA-256: `80ce92d3503b10457843aa15de0c02a343ab67e8a94460c8109f5c121cf0af9c`
- Boundary method: listening-transcript sequence (`問題1`–`問題4`) plus silence evidence and audio-correlation readback. Timestamped Japanese ASR was unavailable.

## Output clips

All clips are normalized to MP3, stereo, 44.1 kHz. Source spans are derived by correlation against the original AAC stream; output durations include MP3 frame padding.

| Clip | Mondai | Source span (s) | Output duration (s) | Status |
| --- | --- | ---: | ---: | --- |
| `n4-2014-07-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | `0.000–826.200` | `826.305306` | `needs_review` |
| `n4-2014-07-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | `846.500–1525.800` | `679.444898` | `needs_review` |
| `n4-2014-07-03.mp3` | 問題3 / `CHOUKAI_EXPRESSION` | `1546.000–1761.600` | `215.666939` | `needs_review` |
| `n4-2014-07-04.mp3` | 問題4 / `CHOUKAI_QUICK_RESPONSE` | `1771.900–2298.906` | `527.020408` | `needs_review` |

## Evidence and review status

- The combined PDF's listening transcripts are mapped package-locally as scan pages 21–24 for `問題1`–`問題4`.
- Each clip begins after the prior section's long transition/silence region so the following clip owns its section instructions.
- All four clips decode successfully via `ffprobe` as MP3/stereo/44.1 kHz.
- Without timestamped ASR markers, all boundaries remain `needs_review`; no ASR corroboration is claimed.

## Media policy

- The source has printed picture-choice panels for Choukai 問題1 local questions 2, 6, and 8. These are modeled as individual `answerImage` fields once verified uploads are available.
- Choukai 問題3 is scene-prompt based and uses `questionImage` only. The Q1 scene crop passed QA. Q2–Q5 scene crops did not pass isolation/arrow QA, so their fields remain `null` pending a clean source crop.
