# Audio Segmentation Manifest - JLPT N1 2019-07

Source duration: `3181.466009` seconds. Boundaries were selected from Japanese ASR markers and checked against the listening script.

| Mondai | Marker | Clip start | Clip end | Duration | Output |
|---|---:|---:|---:|---:|---|
| 問題1 | 70.200 | 67.200 | 672.540 | 605.340 | `n1-2019-07-01.mp3` |
| 問題2 | 669.540 | 666.540 | 1469.360 | 802.820 | `n1-2019-07-02.mp3` |
| 問題3 | 1466.360 | 1463.360 | 2136.580 | 673.220 | `n1-2019-07-03.mp3` |
| 問題4 | 2133.580 | 2130.580 | 2644.980 | 514.400 | `n1-2019-07-04.mp3` |
| 問題5 | 2641.980 | 2638.980 | source end | 542.504 | `n1-2019-07-05.mp3` |

Each boundary includes three seconds of overlap before and after the detected marker where a following marker exists. Outputs are mono MP3 at 32 kHz and 64 kbps.

FFmpeg silence detection around the inter-mondai markers confirmed multi-second low-energy gaps at each transition. The overlap keeps the spoken `問題N` marker inside both QA-safe edges without cutting the first instruction.
