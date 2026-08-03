# N2 2013-12 listening segmentation manifest

Status: `verified`. All clips were uploaded/read back, HTTP-byte checked, and their ASR-marker/silence boundaries plus full-waveform edges were reviewed.

Source: `source-listening.mp3` (2735.856 s, MP3, 32 kHz stereo).

Evidence:
- Japanese timestamped ASR: `/opt/data/n2_asr.json` (552 segments, full duration) and `/opt/data/n2_asr.log`.
- Acoustic silence detection: `/tmp/n2_silence.txt`, `silencedetect=noise=-32dB:d=0.8`.
- Printed transcript: `ocr/answers-transcript-pages-01-13.md`.
- Boundaries were chosen at silence immediately before the ASR section announcement, not by equal-duration splitting.

| Mondai | Clip | Start | End | ASR marker | Acoustic evidence | Confidence |
|---|---|---:|---:|---|---|---|
| 1 | `n2-2013-12-01.mp3` | 81.522 | 569.870 | `問題1` at 83.210 | silence 81.522–83.169 | high |
| 2 | `n2-2013-12-02.mp3` | 569.870 | 1260.108 | `問題2` at 571.540 | silence 569.870–571.518 | high |
| 3 | `n2-2013-12-03.mp3` | 1260.108 | 1770.967 | `問題3` at 1261.990 | silence 1260.108–1261.763 | high |
| 4 | `n2-2013-12-04.mp3` | 1770.967 | 2198.802 | `問題4` at 1772.620 | silence 1770.967–1772.621 | high |
| 5 | `n2-2013-12-05.mp3` | 2198.802 | 2735.856 | `問題5` at 2200.670 | silence 2198.802–2200.466 | high |

FFprobe durations after re-encoding at 64 kbps:
- 01: 488.412 s
- 02: 690.300 s
- 03: 510.912 s
- 04: 427.896 s
- 05: 537.084 s

No source PDF/audio was modified.
