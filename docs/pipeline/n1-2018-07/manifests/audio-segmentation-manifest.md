# Audio Segmentation Manifest - JLPT N1 2018-07

Source duration: `3100.083469` seconds. Boundaries were selected from Japanese ASR markers and corroborated with the official listening script and FFmpeg silence detection.

| Mondai | Marker | Clip start | Clip end | Duration | Output |
|---|---:|---:|---:|---:|---|
| 問題1 | 83.320 | 80.320 | 680.000 | 599.724 | `n1-2018-07-01.mp3` |
| 問題2 | 677.000 | 674.000 | 1425.880 | 751.932 | `n1-2018-07-02.mp3` |
| 問題3 | 1422.880 | 1419.880 | 2058.280 | 638.460 | `n1-2018-07-03.mp3` |
| 問題4 | 2055.280 | 2052.280 | 2546.820 | 494.604 | `n1-2018-07-04.mp3` |
| 問題5 | 2543.820 | 2540.820 | source end | 559.332 | `n1-2018-07-05.mp3` |

Each transition keeps three seconds of overlap before and after the detected `問題N` marker. 問題1 starts three seconds before its marker, after the general exam preamble. Outputs are mono MP3 at 32 kHz and 64 kbps.

The source contains long inter-question response silences; boundary selection therefore uses spoken mondai markers rather than equal-duration splitting. FFmpeg silence detection corroborates the transition regions.
