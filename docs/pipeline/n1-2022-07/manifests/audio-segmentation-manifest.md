# N1 2022-07 聴解 audio segmentation manifest

## Source

- File: `/Users/lanstheprodigy/Downloads/jlpt-n1-2022-07.mp3`
- SHA-256: `356390b3c6351ea1472158b1770637878b6828f9d166e4858b349b58a752702f`
- Codec: MP3; stereo; 44.1 kHz
- Source duration: `3185.489` seconds
- Timestamped ASR: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese)
- Transcript: `listening-transcript.txt`

## Selected spans

| Clip | Mondai / type | Source start | Source end | Boundary evidence | FFprobe duration | SHA-256 |
|---|---|---:|---:|---|---:|---|
| `n1-2022-07-01.mp3` | `CHOUKAI_TASK_BASED` | 58.920 | 647.820 | 問題1 marker starts at 61.920; 問題2 marker starts at 644.820 | 588.900 s | `7a11aa40a17a40991ba3b6eb14a247fa4902d0c2901c7be7e8fa568c50499df2` |
| `n1-2022-07-02.mp3` | `CHOUKAI_MAIN_POINT` | 641.820 | 1642.720 | 問題2 marker starts at 644.820; 問題3 marker starts at 1639.720 | 1000.900 s | `4bb209978eed4fd93b95e981f4f1062bf065fa9f5ca9fa7ba84a72d69b848534` |
| `n1-2022-07-03.mp3` | `CHOUKAI_OUTLINE` | 1636.720 | 2312.420 | 問題3 marker starts at 1639.720; 問題4 marker starts at 2309.420 | 675.700 s | `1894741a75b30cd09f2f37169bff27204dd5efe179b2789aee5e7cce6a4d9a01` |
| `n1-2022-07-04.mp3` | `CHOUKAI_QUICK_RESPONSE` | 2306.420 | 2806.940 | 問題4 marker starts at 2309.420; 問題5 marker starts at 2803.940 | 500.520 s | `99a51f7ba615e34182c0f26c2e218301d6ba2064e5188e4949829b6fe807896f` |
| `n1-2022-07-05.mp3` | `CHOUKAI_INTEGRATED` | 2800.940 | 3185.489 | 問題5 marker starts at 2803.940; test ends at source end | 384.537 s | `e3893462294ccea7b11fc5cae0642630d46164ad51e7d2cdb3db05a4472bc563` |

Every internal boundary has six seconds of total overlap around the audible mondai marker. All clips are MP3 mono, 32 kHz, 64 kbps. The normalized full MP3 is retained locally as `data/audio/n1-2022-07/n1-2022-07.mp3` and is not referenced by the fixture.

## Upload readback

The five per-mondai clips were uploaded to Cloudinary folder `jlpt-exam/data/n1-2022-07`. Every versioned URL returned HTTP success during readback; metadata is recorded in `cloudinary-upload-results.json`.
