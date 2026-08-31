# N1 2021-12 聴解 audio segmentation manifest

## Source

- File: `/Users/lanstheprodigy/Downloads/jlpt-n1-2021-12.mp3`
- SHA-256: `0cb6e40f18bba91df0e7b4ba8f64e4b6c4625c4184f3e13eac5195223e30fe48`
- Codec: MP3; mono; 44.1 kHz
- Source duration: `3474.312` seconds
- Timestamped ASR: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese)
- Transcript: `listening-transcript.txt`

## Selected spans

| Clip | Mondai / type | Source start | Source end | Boundary evidence | FFprobe duration | SHA-256 |
|---|---|---:|---:|---|---:|---|
| `n1-2021-12-01.mp3` | `CHOUKAI_TASK_BASED` | 62.660 | 755.500 | 問題1 marker starts at 65.660; 問題2 marker starts at 752.500 | 692.840 s | `1d7bc46e41f8ac5867f3b4674665049f041e22a408008f16323e117c44053c9d` |
| `n1-2021-12-02.mp3` | `CHOUKAI_MAIN_POINT` | 749.500 | 1826.540 | 問題2 marker starts at 752.500; 問題3 marker starts at 1823.540 | 1077.040 s | `94519618ecfc042b3509986a80997dc5843e5955d8422d781ac5da61c1df341c` |
| `n1-2021-12-03.mp3` | `CHOUKAI_OUTLINE` | 1820.540 | 2558.880 | 問題3 marker starts at 1823.540; 問題4 marker starts at 2555.880 | 738.340 s | `d2ac1bd267211227066b21c83c3550bf9d8577735f01d162d52f7a0c9ec71dd3` |
| `n1-2021-12-04.mp3` | `CHOUKAI_QUICK_RESPONSE` | 2552.880 | 3062.680 | 問題4 marker starts at 2555.880; 問題5 marker starts at 3059.680 | 509.800 s | `d38be1196be0163157e73f469242e6697cac71ac8317a4fc284a8d38ee08b871` |
| `n1-2021-12-05.mp3` | `CHOUKAI_INTEGRATED` | 3056.680 | 3474.312 | 問題5 marker starts at 3059.680; test ends at source end | 417.632 s | `cce86168d1881230e29dc8eda8423912d7db29fd32d6a8b0d95aa76b3814b568` |

Every internal boundary has six seconds of total overlap around the audible mondai marker. All clips are MP3 mono, 32 kHz, 64 kbps. The normalized full MP3 is retained locally as `data/audio/n1-2021-12/n1-2021-12.mp3` and is not referenced by the fixture.

## Upload readback

The five per-mondai clips were uploaded to Cloudinary folder `jlpt-exam/data/n1-2021-12`. Every versioned URL returned HTTP success during readback; metadata is recorded in `cloudinary-upload-results.json`.
