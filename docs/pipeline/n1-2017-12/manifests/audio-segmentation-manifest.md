# Audio Segmentation Manifest - JLPT N1 2017-12

Source duration: `3399.266009` seconds. Boundaries were selected from Japanese ASR markers and corroborated with the official listening script and FFmpeg silence detection.

| Mondai | Marker | Clip start | Clip end | Uploaded duration | Output |
|---|---:|---:|---:|---:|---|
| 問題1 | 76.240 | 73.240 | 792.900 | 719.712 | `n1-2017-12-01.mp3` |
| 問題2 | 789.900 | 786.900 | 1645.800 | 858.960 | `n1-2017-12-02.mp3` |
| 問題3 | 1642.800 | 1639.800 | 2319.620 | 679.860 | `n1-2017-12-03.mp3` |
| 問題4 | 2316.620 | 2313.620 | 2809.240 | 495.684 | `n1-2017-12-04.mp3` |
| 問題5 | 2806.240 | 2803.240 | source end | 596.088 | `n1-2017-12-05.mp3` |

Each transition keeps three seconds before and after the detected mondai marker. The six-second overlap protects the spoken transition from timestamp drift. Outputs are mono MP3 at 32 kHz and 64 kbps.
