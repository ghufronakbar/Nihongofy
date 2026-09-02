# N2 2023-12 listening segmentation manifest

Status: `verified`.

Source audio: `jlpt-n2-2023-12.mp3` (2936.127166 seconds, stereo, 44.1 kHz).

Evidence:

- Japanese timestamped ASR: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese).
- Acoustic silence detection: `silencedetect=noise=-32dB:d=0.8`.
- Printed transcript: `jlpt-n2-2023-12-script-choukai.pdf`.
- Each boundary starts at the silence immediately before the following `問題N` announcement.

| Mondai | Clip | Start | End | ASR marker | Acoustic evidence | Confidence |
|---|---|---:|---:|---|---|---|
| 1 | `n2-2023-12-01.mp3` | 63.237800 | 643.683719 | `問題1` at 66.000 | silence 63.238-64.476 | high |
| 2 | `n2-2023-12-02.mp3` | 643.683719 | 1507.010476 | `問題2` at 645.420 | silence 643.684-645.477 | high |
| 3 | `n2-2023-12-03.mp3` | 1507.010476 | 2131.046825 | `問題3` at 1512.740 | silence 1507.010-1511.016 | high |
| 4 | `n2-2023-12-04.mp3` | 2131.046825 | 2554.198685 | `問題4` at 2131.060 | silence 2131.047-2136.609 | high |
| 5 | `n2-2023-12-05.mp3` | 2554.198685 | 2936.127166 | `問題5` at 2563.320 | silence 2554.199-2559.697 | high |

Output encoding: MP3, mono, 32 kHz, 64 kbps.

| Clip | Duration | Bytes |
|---|---:|---:|
| `n2-2023-12-01.mp3` | 580.445938 | 4,644,385 |
| `n2-2023-12-02.mp3` | 863.326781 | 6,907,489 |
| `n2-2023-12-03.mp3` | 624.036375 | 4,993,153 |
| `n2-2023-12-04.mp3` | 423.151875 | 3,386,113 |
| `n2-2023-12-05.mp3` | 381.928500 | 3,056,353 |

All five Cloudinary URLs returned HTTP 200 with byte counts matching the local clips.
