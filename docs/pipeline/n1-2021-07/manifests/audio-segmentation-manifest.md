# N1 2021-07 聴解 audio segmentation manifest

## Source

- File: `/Users/lanstheprodigy/Downloads/jlpt-n1-2021-07.mp3`
- SHA-256: `c31b6459d2b9032744e778f89f6cbf50848ba1df5efed819fdfab2afafe4f702`
- Codec: MP3; stereo; 44.1 kHz
- Source duration: `3161.874` seconds
- Timestamped ASR: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese)
- Transcript: `listening-transcript.txt`

## Selected spans

| Clip | Mondai / type | Source start | Source end | Boundary evidence | FFprobe duration | SHA-256 |
|---|---|---:|---:|---|---:|---|
| `n1-2021-07-01.mp3` | `CHOUKAI_TASK_BASED` | 75.400 | 663.140 | 問題1 marker starts at 78.400; 問題2 marker starts at 660.140 | 587.740 s | `542bb3c4ea9197428182e2e22400ba8d6976e2caa8a41090895b8def4da8da9c` |
| `n1-2021-07-02.mp3` | `CHOUKAI_MAIN_POINT` | 657.140 | 1597.160 | 問題2 marker starts at 660.140; 問題3 marker starts at 1594.160 | 940.020 s | `25aae07bbb2e1ae96926f15e4706e407aab1ca9ae3122e3298fcd010651ec0ad` |
| `n1-2021-07-03.mp3` | `CHOUKAI_OUTLINE` | 1591.160 | 2285.780 | 問題3 marker starts at 1594.160; 問題4 marker starts at 2282.780 | 694.620 s | `37baac57c74825a7d29452ef91e8b3155fcceb82dfc8660826e5dfb034231600` |
| `n1-2021-07-04.mp3` | `CHOUKAI_QUICK_RESPONSE` | 2279.780 | 2753.980 | 問題4 marker starts at 2282.780; 問題5 marker starts at 2750.980 | 474.200 s | `6c442f068ef3ea682960656354fd3a7ad225cdecb19f91d442aa01d7bb0c56c2` |
| `n1-2021-07-05.mp3` | `CHOUKAI_INTEGRATED` | 2747.980 | 3161.874 | 問題5 marker starts at 2750.980; test ends at source end | 413.882 s | `0e59dc6d84882abe5c80b2f0a94580813dfd279d6739b017eb55cc74d030645e` |

Every internal boundary has six seconds of total overlap around the audible mondai marker. All clips are MP3 mono, 32 kHz, 64 kbps. The normalized full MP3 is retained locally as `data/audio/n1-2021-07/n1-2021-07.mp3` and is not referenced by the fixture.

## Upload readback

The five per-mondai clips were uploaded to Cloudinary folder `jlpt-exam/data/n1-2021-07`. Every versioned URL returned HTTP success during readback; metadata is recorded in `cloudinary-upload-results.json`.
