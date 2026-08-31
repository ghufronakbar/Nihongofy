# N1 2022-12 聴解 audio segmentation manifest

## Source

- File: `/Users/lanstheprodigy/Downloads/jlpt-n1-2022-12.mp3`
- SHA-256: `f8cd6a8bc58d9e5ff4ee1827fa5fa71964d0b8ca04a1c44517241c6d53507e03`
- Codec: MP3; stereo; 44.1 kHz
- Source duration: `3124.600` seconds
- Timestamped ASR: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese)
- Transcript: `listening-transcript.txt`

## Selected spans

| Clip | Mondai / type | Source start | Source end | Boundary evidence | FFprobe duration | SHA-256 |
|---|---|---:|---:|---|---:|---|
| `n1-2022-12-01.mp3` | `CHOUKAI_TASK_BASED` | 0.000 | 662.900 | 問題2 marker starts at 659.900 | 662.900 s | `fdd9b27aa0f7239f907af96747414c565246c713ab6d31f2ab8c46c4d123f0d5` |
| `n1-2022-12-02.mp3` | `CHOUKAI_MAIN_POINT` | 656.900 | 1600.680 | 問題2 marker starts at 659.900; 問題3 marker starts at 1597.680 | 943.780 s | `695fcc51871df39aba0c95e9fa542ae981b7f2ff79d8570c5ef5a868514747b5` |
| `n1-2022-12-03.mp3` | `CHOUKAI_OUTLINE` | 1594.680 | 2250.760 | 問題3 marker starts at 1597.680; 問題4 marker starts at 2247.760 | 656.080 s | `108f8d27fed8ec90227db422cd211412cbfc5901b43fa1173da99fd1e78b184b` |
| `n1-2022-12-04.mp3` | `CHOUKAI_QUICK_RESPONSE` | 2244.760 | 2723.860 | 問題4 marker starts at 2247.760; 問題5 marker starts at 2720.860 | 479.100 s | `96f88e3e33191159a1b98c1b3bda57790be24f4aff2c8e557e4784da9bbcabd6` |
| `n1-2022-12-05.mp3` | `CHOUKAI_INTEGRATED` | 2717.860 | 3124.600 | 問題5 marker starts at 2720.860; test ends at source end | 406.698 s | `f1baced541641ddde2dda7e9b02321002ba113e767e99cc2ea996f70b1d0f916` |

Every internal boundary has six seconds of total overlap around the audible mondai marker. All clips are MP3 mono, 32 kHz, 64 kbps. The normalized full MP3 is retained locally as `data/audio/n1-2022-12/n1-2022-12.mp3` and is not referenced by the fixture.

## Upload readback

The five per-mondai clips were uploaded to Cloudinary folder `jlpt-exam/data/n1-2022-12`. Every versioned URL returned HTTP success during readback; metadata is recorded in `cloudinary-upload-results.json`.
