# N4 2013-07 聴解 audio segmentation manifest

## Source

- `audio.m4a`
- SHA-256: `e7e022baa2fdb50820c15bca39bee099b9834bc0f4daa7b6aa92556f4834fb86`
- AAC/M4A, stereo, 44.1 kHz, source duration `2316.957007` seconds.
- Timestamped ASR: faster-whisper small, Japanese, CPU/int8, 454 segments, reported duration `2316.958125` seconds.
- Silence detection: FFmpeg `silencedetect=noise=-35dB:d=0.7`.

## Selected spans

| Clip | Mondai / canonical type | Source start | Source end | Boundary evidence | FFprobe readback | Status |
|---|---|---:|---:|---|---:|---|
| `n4-2013-07-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | 0.000000 | 791.232675 | next long silence `791.232675–803.445646`; 問題2 marker ASR `807.18` | 791.275102 | auto-pass candidate |
| `n4-2013-07-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | 791.232675 | 1642.549773 | transition pause `1642.549773–1646.387755`; `ではまた続けます`; 問題3 marker `1654.40` | 851.356735 | auto-pass candidate |
| `n4-2013-07-03.mp3` | 問題3 / `CHOUKAI_EXPRESSION` | 1642.549773 | 1914.986712 | next long silence `1914.986712–1925.219410`; 問題4 marker `1928.91` | 272.483265 | auto-pass candidate |
| `n4-2013-07-04.mp3` | 問題4 / `CHOUKAI_QUICK_RESPONSE` | 1914.986712 | 2280.118912 | source test ending at ASR `2281.79`; trailing source silence starts `2280.118912` | 365.165714 | auto-pass candidate |

## Local item coverage

- 問題1: 8 items.
- 問題2: 7 items.
- 問題3: 5 items.
- 問題4: 8 items.

All clips decode with FFmpeg. MP3 frame padding accounts for the small difference between intended spans and FFprobe durations.
