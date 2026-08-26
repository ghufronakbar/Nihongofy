# JLPT N4 July 2021 audio segmentation manifest

- Source attachment: `/opt/data/jlpt-pipeline/sources/n4-2021-07/audio.ogg` (content probe: MP3)
- Source duration: `2376.019625s`; codec MP3, 44.1 kHz, mono, 64 kb/s
- ASR: `asr-timestamps.json`, Japanese faster-whisper small, word timestamps, 407 segments
- Boundary evidence: ASR section markers and surrounding listening instruction transitions. Status remains `needs_review` until human audio review.

| Mondai | Type | Output | Start | End | FFprobe duration | Marker evidence | Status |
|---|---|---|---:|---:|---:|---|---|
| 1 | `CHOUKAI_TASK_BASED` | `n4-2021-07-01.mp3` | 0.000 | 850.310 | 850.311837 | ASR `問題2` at 850.31 | needs_review |
| 2 | `CHOUKAI_MAIN_POINT` | `n4-2021-07-02.mp3` | 850.310 | 1755.000 | 904.698776 | ASR `問題3` at 1755.00 | needs_review |
| 3 | `CHOUKAI_EXPRESSION` | `n4-2021-07-03.mp3` | 1755.000 | 2025.790 | 270.785306 | ASR `問題4` at 2025.79 | needs_review |
| 4 | `CHOUKAI_QUICK_RESPONSE` | `n4-2021-07-04.mp3` | 2025.790 | 2376.020 | 350.223673 | source tail retained | needs_review |

The source attachment was supplied directly by the user after the original Drive ID returned public 404. The JSON uses the four verified Cloudinary clip URLs, one shared storyAudio context per mondai.
