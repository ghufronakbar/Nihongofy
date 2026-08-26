# N4 December 2012 audio segmentation

Source: `/opt/data/jlpt-pipeline/sources/n4-2012-12/audio.mp3` (actual container MP4/M4A, AAC/HE-AAC, 44.1 kHz stereo; source filename retained).

Boundaries are anchored by timestamped Japanese ASR section markers and the following section instruction. Clips are non-overlapping; no equal-duration split was used.

| clip | mondai | source span (s) | output duration (ffprobe s) | marker evidence | status |
|---|---|---:|---:|---|---|
| `n4-2012-12-01.mp3` | 問題1 / 8 questions | `0.00–731.53` | `731.559184` | `問題2` at ~731.53 | user_reviewed: user confirmed boundary is correct |
| `n4-2012-12-02.mp3` | 問題2 / 7 questions | `731.53–1537.06` | `805.564082` | `問題3` at ~1537.06 | user_reviewed: user confirmed boundary is correct |
| `n4-2012-12-03.mp3` | 問題3 / 5 questions | `1537.06–1812.88` | `275.853061` | `問題4` at ~1812.88 | user_reviewed: user confirmed boundary is correct |
| `n4-2012-12-04.mp3` | 問題4 / 8 questions | `1812.88–2156.14` | `343.301224` | end of source | user_reviewed: user confirmed boundary is correct |

The output files were decoded successfully with FFprobe and checksummed in `audio-checksums.sha256`. MP3 frame padding accounts for the small duration differences from requested spans.
