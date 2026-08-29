# N5 2017-07 聴解 audio segmentation manifest

## Source

- File: `/Users/lanstheprodigy/Downloads/Choukai N5-2017年7月.m4a`
- SHA-256: `7c8f8d2827b19a1e34e2271fe50f0513989dbac3f69606a804d600fb0a49e5d1`
- Codec: AAC in M4A; stereo; 44.1 kHz
- Source duration: `1709.950000` seconds
- Timestamped ASR: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese)
- Transcript: `listening-transcript.txt`
- Silence evidence: FFmpeg `silencedetect=noise=-32dB:d=0.8`

## Selected spans

| Clip | Mondai / type | Source start | Source end | Marker evidence | FFprobe duration | Status |
|---|---|---:|---:|---|---:|---|
| `n5-2017-07-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | 52.500 | 618.000 | 問題1 at 53.66; next 問題2 at 616.12 | 565.500 s | auto_pass |
| `n5-2017-07-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | 615.000 | 1154.500 | 問題2 at 616.12; next 問題3 at 1152.96 | 539.500 s | auto_pass |
| `n5-2017-07-03.mp3` | 問題3 / `CHOUKAI_EXPRESSION` | 1151.800 | 1445.200 | 問題3 at 1152.96; next 問題4 at 1443.62 | 293.400 s | auto_pass |
| `n5-2017-07-04.mp3` | 問題4 / `CHOUKAI_QUICK_RESPONSE` | 1442.500 | 1709.950 | 問題4 at 1443.62; source end | 267.450 s | auto_pass |

Internal boundaries overlap by roughly 2.2 to 3.0 seconds. Each clip therefore retains its own mondai announcement while the previous clip keeps the complete final response window.

## Coverage readback

- 問題1 item markers 1-7 appear at approximately 169.70, 217.04, 274.70, 328.30, 394.50, 468.68, and 547.54 seconds.
- 問題2 item markers begin at approximately 751.98, 811.74, 892.92, 964.24, 1020, and 1076.48 seconds.
- 問題3 item markers begin at approximately 1257.80, 1287, 1319.70, 1366.26, and 1388.76 seconds.
- 問題4 contains six quick-response items and runs through the final source response window.

All outputs are MP3 mono, 32 kHz, 64 kbps. The complete MP3 is retained locally as `data/audio/n5-2017-07/n5-2017-07.mp3`; only the four per-mondai clips are referenced by the fixture and uploaded.
