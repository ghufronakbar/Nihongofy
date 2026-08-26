# N4 2018-12 聴解 audio segmentation manifest

## Source

- File: `audio.m4a`
- SHA-256: `ba81cfbc6265384a0f8992367efbfaa4175bff17c965610bf1671ffc0dd9bed5`
- Codec: AAC in M4A; stereo; 44.1 kHz
- Source duration: `2302.432993` seconds
- Timestamped ASR: `generated/n4-2018-12-asr.json` (faster-whisper small, Japanese, CPU/int8; 413 segments; reported duration `2302.468875` seconds)
- Silence evidence: FFmpeg `silencedetect=noise=-35dB:d=0.7`, recorded in `generated/silence-0.7.log`

## Selected spans

| Clip | Mondai / type | Source start | Source end | Selected preceding/next silence | Marker evidence | FFprobe output duration | Status |
|---|---|---:|---:|---|---|---:|---|
| `n4-2018-12-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | 0.000 | 761.162 | next: 761.162–773.504 | 問題1 at 46.49; next 問題2 at 777.21 | 761.208163 | auto-pass candidate |
| `n4-2018-12-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | 761.162 | 1654.301 | start silence retains own announcement; next: 1654.301–1666.634 | 問題2 at 777.21; next 問題3 at 1670.36 | 893.178776 | auto-pass candidate |
| `n4-2018-12-03.mp3` | 問題3 / `CHOUKAI_EXPRESSION` | 1654.301 | 1929.264 | start silence retains own announcement; next: 1929.264–1939.618 | 問題3 at 1670.36; next 問題4 at 1943.26 | 274.991020 | auto-pass candidate |
| `n4-2018-12-04.mp3` | 問題4 / `CHOUKAI_QUICK_RESPONSE` | 1929.264 | 2302.468875 | start silence retains own announcement | 問題4 at 1943.26; final test end at 2297.23 | 373.237551 | auto-pass candidate |

## Coverage readback

- 問題1 item markers: 1–8 at approximately 160.88, 237.54, 313.61, 390.88, 461.39, 539.42, 617.12, 673.04.
- 問題2 item markers: 1–7 at approximately 910.67, 1024.75, 1120.56, 1233.92, 1342.62, 1458.75, 1554.57.
- 問題3 item markers: 1–5 at approximately 1754.40, 1793.79, 1836.08, 1873.07, 1909.52.
- 問題4 item markers: 1–8 at approximately 2029.74, 2061.15, 2094.59, 2129.26, 2164.57, 2199.45, 2230.65, 2265.93.

The four spans are non-equal and derive from transcript ownership, explicit ASR section markers, and the long silence immediately preceding each next section announcement. MP3 frame padding explains the small difference between intended and FFprobe durations.
