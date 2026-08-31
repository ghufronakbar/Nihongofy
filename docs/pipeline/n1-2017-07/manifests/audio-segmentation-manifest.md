# Audio Segmentation Manifest - JLPT N1 2017-07

Source duration: `3083.870` seconds. Boundaries were selected from Japanese ASR markers and corroborated with the official listening script and FFmpeg silence detection.

| Mondai | Marker | Clip start | Clip end | Uploaded duration | Output |
|---|---:|---:|---:|---:|---|
| 問題1 | 76.240 | 73.240 | 661.120 | 587.916 | `n1-2017-07-01.mp3` |
| 問題2 | 658.120 | 655.120 | 1442.380 | 787.320 | `n1-2017-07-02.mp3` |
| 問題3 | 1439.380 | 1436.380 | 2084.460 | 648.144 | `n1-2017-07-03.mp3` |
| 問題4 | 2081.460 | 2078.460 | 2573.420 | 495.000 | `n1-2017-07-04.mp3` |
| 問題5 | 2570.420 | 2567.420 | source end | 516.564 | `n1-2017-07-05.mp3` |

Each transition keeps three seconds before and after the detected mondai marker. The six-second overlap protects the spoken transition from timestamp drift. Outputs are mono MP3 at 32 kHz and 64 kbps.
