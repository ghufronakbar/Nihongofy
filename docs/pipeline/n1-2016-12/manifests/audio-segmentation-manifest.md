# Audio Segmentation Manifest - JLPT N1 2016-12

Source duration: `3435.482` seconds. Boundaries were selected from Japanese ASR markers and corroborated with the official listening script and FFmpeg silence detection.

| Mondai | Marker | Clip start | Clip end | Uploaded duration | Output |
|---|---:|---:|---:|---:|---|
| 問題1 | 70.220 | 67.220 | 754.860 | 687.708 | `n1-2016-12-01.mp3` |
| 問題2 | 751.860 | 748.860 | 1711.500 | 962.676 | `n1-2016-12-02.mp3` |
| 問題3 | 1708.500 | 1705.500 | 2343.240 | 637.776 | `n1-2016-12-03.mp3` |
| 問題4 | 2340.240 | 2337.240 | 2869.900 | 532.728 | `n1-2016-12-04.mp3` |
| 問題5 | 2866.900 | 2863.900 | source end | 571.680 | `n1-2016-12-05.mp3` |

Each transition keeps three seconds before and after the detected mondai marker. The six-second overlap protects the spoken transition from timestamp drift. Outputs are mono MP3 at 32 kHz and 64 kbps.
