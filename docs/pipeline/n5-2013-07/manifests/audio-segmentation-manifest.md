# N5 2013-07 audio segmentation

Source: `/Users/lanstheprodigy/Downloads/Choukai N5-2013年7月.mp3`

The source is MP3 stereo, 44.1 kHz, with a duration of 1779.409 seconds. Explicit ASR markers and the official listening script were used to identify the four mondai boundaries.

| Output | Mondai | Start | End | Evidence | Duration | Status |
|---|---|---:|---:|---|---:|---|
| `n5-2013-07-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | 90.000 | 673.000 | 問題1 instructions begin around 01:31; 問題2 marker at 11:11.360 | 583.000 s | auto_pass |
| `n5-2013-07-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | 670.000 | 1221.000 | 問題2 marker at 11:11.360; 問題3 marker at 20:19.220 | 551.000 s | auto_pass |
| `n5-2013-07-03.mp3` | 問題3 / `CHOUKAI_EXPRESSION` | 1217.500 | 1490.000 | 問題3 marker at 20:19.220; 問題4 marker at 24:47.560 | 272.500 s | auto_pass |
| `n5-2013-07-04.mp3` | 問題4 / `CHOUKAI_QUICK_RESPONSE` | 1485.500 | 1779.409 | 問題4 marker at 24:47.560; source end at 29:39.409 | 293.909 s | auto_pass |

Internal boundaries intentionally overlap by a few seconds so the transition announcement is not clipped. All outputs are MP3 mono, 32 kHz, 64 kbps. The complete normalized MP3 is retained locally as `data/audio/n5-2013-07/n5-2013-07.mp3`; only the four per-mondai clips are referenced by the fixture and uploaded.
