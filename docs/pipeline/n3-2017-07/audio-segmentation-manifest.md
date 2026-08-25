# N3 July 2017 聴解 audio segmentation manifest

- Source: `/opt/data/jlpt-pipeline/sources/n3-2017-07/audio.mp3`
- Source duration: `2284.524s`; ffprobe: MP3, 32 kHz, stereo, 64 kb/s
- ASR: `asr-timestamps.json`, faster-whisper small, Japanese, word timestamps; 421 segments; duration readback `2284.4895s`
- Boundary method: ASR 問題 markers plus section transition timing. These are provisional source-envelope boundaries. ASR markers are clear, but the current silence scan did not produce discrete silence intervals at the selected boundaries; keep the clips `needs_review` rather than auto-pass.

| Mondai | Output | Start | End | FFprobe duration | Marker evidence | Status |
|---|---|---:|---:|---:|---|---|
| 1 | `n3-2017-07-01.mp3` | 0.000 | 632.330 | 632.340 | ASR 問題2 at 632.33 | needs_review |
| 2 | `n3-2017-07-02.mp3` | 632.330 | 1395.560 | 763.236 | ASR 問題3 at 1395.56 | needs_review |
| 3 | `n3-2017-07-03.mp3` | 1395.560 | 1734.160 | 338.616 | ASR 問題4 at 1734.16 | needs_review |
| 4 | `n3-2017-07-04.mp3` | 1734.160 | 1923.240 | 189.072 | ASR 問題5 at 1923.24 | needs_review |
| 5 | `n3-2017-07-05.mp3` | 1923.240 | 2284.490 | 361.224 | source tail retained | needs_review |

The manifest deliberately retains `needs_review`: ASR marker evidence exists, but transition boundaries should be audibly spot-checked and the P4 image crop mapping reviewed before production import.
