# N5 2010-12 聴解 audio segmentation manifest

## Source

- File: `/Users/lanstheprodigy/Downloads/Choukai N5-2010.m4a`
- SHA-256: `880f22485b45ed6970182799ca4567ea6645972b42923a166f3d29a9ac9f62ae`
- Codec: AAC in M4A; stereo; 44.1 kHz
- Source duration: `1712.900998` seconds
- Timestamp evidence: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese)
- Transcript: `listening-transcript.txt`, checked against printed scripts on PDF pages 19-21

## Selected spans

| Clip | Mondai / type | Source start | Source end | Marker evidence | FFprobe duration | Status |
|---|---|---:|---:|---|---:|---|
| `n5-2010-12-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | 55.000 | 638.000 | 問題1 at 57.000; next 問題2 at 635.460 | 583.000 s | auto_pass |
| `n5-2010-12-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | 633.000 | 1167.500 | 問題2 at 635.460; next 問題3 at 1164.900 | 534.500 s | auto_pass |
| `n5-2010-12-03.mp3` | 問題3 / `CHOUKAI_EXPRESSION` | 1162.000 | 1433.000 | 問題3 at 1164.900; next 問題4 at 1430.000 | 271.000 s | auto_pass |
| `n5-2010-12-04.mp3` | 問題4 / `CHOUKAI_QUICK_RESPONSE` | 1428.000 | 1704.000 | 問題4 at 1430.000; exam end at 1700.720 | 276.000 s | auto_pass |

Internal boundaries overlap by 4.5 to 5 seconds. Each clip retains its own mondai announcement while the preceding clip keeps the complete final response window.

All outputs are MP3 mono, 32 kHz, 64 kbps. The complete normalized MP3 is retained locally as `data/audio/n5-2010-12/n5-2010-12.mp3`; only the four per-mondai clips are referenced by the fixture and uploaded.
