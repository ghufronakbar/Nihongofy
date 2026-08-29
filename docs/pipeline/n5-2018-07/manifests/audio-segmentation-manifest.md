# N5 2018-07 聴解 audio segmentation manifest

## Source

- File: `/Users/lanstheprodigy/Downloads/Choukai N5-2018年.m4a`
- SHA-256: `d09cb4f18006cca4350bec478341683353f897b4cbdf570a482e39be90ee98f1`
- Codec: AAC in M4A; stereo; 44.1 kHz
- Source duration: `1730.592993` seconds
- Timestamped ASR: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese)
- Transcript: `listening-transcript.txt`
- Silence evidence: FFmpeg `silencedetect=noise=-32dB:d=0.8`

## Selected spans

| Clip | Mondai / type | Source start | Source end | Marker evidence | FFprobe duration | Status |
|---|---|---:|---:|---|---:|---|
| `n5-2018-07-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | 47.500 | 626.700 | 問題1 at 48.44; next 問題2 at 625.50 | 579.200 s | auto_pass |
| `n5-2018-07-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | 624.500 | 1166.900 | 問題2 at 625.50; next 問題3 at 1165.72 | 542.400 s | auto_pass |
| `n5-2018-07-03.mp3` | 問題3 / `CHOUKAI_EXPRESSION` | 1164.500 | 1444.900 | 問題3 at 1165.72; next 問題4 at 1443.66 | 280.400 s | auto_pass |
| `n5-2018-07-04.mp3` | 問題4 / `CHOUKAI_QUICK_RESPONSE` | 1442.500 | 1730.593 | 問題4 at 1443.66; test end at 1728.48 | 288.093 s | auto_pass |

Each internal boundary overlaps by about 2.2 seconds. This keeps the next mondai announcement at the start of its own clip while preserving the preceding mondai's final response window.

## Coverage readback

- 問題1 item markers: 1-7 at approximately 159.82, 221.34, 266.40, 342.30, 414.62, 502.20, and 549.60 seconds.
- 問題2 item markers: 1-6 at approximately 751.12, 805.12, 856.70, 945.74, 1024.80, and 1101.12 seconds.
- 問題3 item markers: 1-5 at approximately 1267.32, 1311.86, 1347.94, 1382.28, and 1417.60 seconds.
- 問題4 item markers: 1-6 at approximately 1530.54, 1560.54, 1590.54, 1620.54, 1650.70, and 1682.98 seconds.

The four clips are encoded as MP3 mono, 32 kHz, 64 kbps. The complete MP3 is retained locally in `data/audio/n5-2018-07/n5-2018-07.mp3`; only the four per-mondai clips are referenced by the JSON and uploaded to Cloudinary.
