# N5 2012-12 聴解 audio segmentation manifest

## Source

- File: `/Users/lanstheprodigy/Downloads/Choukai N5-2012年12月.m4a`
- SHA-256: `88afeee93f0bb0b4311f016fa4d1f19a0035c7f5c1cece1ed88dffa3d9345557`
- Codec: AAC in M4A; stereo; 44.1 kHz
- Source duration: `1843.958005` seconds
- Timestamp evidence: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese)
- Transcript: `listening-transcript.txt`, checked against printed scripts on PDF pages 20-22

## Selected spans

| Clip | Mondai / type | Source start | Source end | Marker evidence | FFprobe duration | Status |
|---|---|---:|---:|---|---:|---|
| `n5-2012-12-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | 90.500 | 631.500 | 問題1 at 92.160; next 問題2 at 629.460 | 541.000 s | auto_pass |
| `n5-2012-12-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | 627.000 | 1201.500 | 問題2 at 629.460; next 問題3 at 1198.660 | 574.500 s | auto_pass |
| `n5-2012-12-03.mp3` | 問題3 / `CHOUKAI_EXPRESSION` | 1196.000 | 1470.500 | 問題3 at 1198.660; next 問題4 at 1467.760 | 274.500 s | auto_pass |
| `n5-2012-12-04.mp3` | 問題4 / `CHOUKAI_QUICK_RESPONSE` | 1465.000 | 1744.000 | 問題4 at 1467.760; exam end at 1741.400 | 279.000 s | auto_pass |

Internal boundaries overlap by 4.5 to 5.5 seconds. Each clip retains its own mondai announcement while the preceding clip keeps the complete final response window. The fourth clip ends after the spoken exam closing and excludes roughly 100 seconds of trailing silence.

All outputs are MP3 mono, 32 kHz, 64 kbps. The complete normalized MP3 is retained locally as `data/audio/n5-2012-12/n5-2012-12.mp3`; only the four per-mondai clips are referenced by the fixture and uploaded.
