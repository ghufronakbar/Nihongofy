# N1 2023-07 聴解 audio segmentation manifest

## Source

- File: `/Users/lanstheprodigy/Downloads/jlpt-n1-2023-07.mp3`
- SHA-256: `b3251109a5b5a6bfdf79ff3d857d853a940c3a0e2cbd8c87c3a6e087173b3278`
- Codec: MP3; stereo; 44.1 kHz
- Source duration: `2325.600` seconds
- Timestamped ASR: `asr-timestamps.json` (`whisper-cli`, `ggml-large-v3-turbo`, Japanese)
- Transcript: `listening-transcript.txt`

## Selected spans

| Clip | Mondai / type | Source start | Source end | Boundary evidence | FFprobe duration | SHA-256 |
|---|---|---:|---:|---|---:|---|
| `n1-2023-07-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` | 0.000 | 467.300 | 問題2 item 1 starts at 464.300 | 467.300 s | `1f012ca52031fbb830936154aebf02c1e57606ed333e61948ac3fe7d28c6009c` |
| `n1-2023-07-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` | 461.300 | 1187.960 | 問題3 starts at 1184.960 | 726.660 s | `33aa1312bce6add50c014388d69c70e665f66cca36c7e32c301091765da8ffac` |
| `n1-2023-07-03.mp3` | 問題3 / `CHOUKAI_OUTLINE` | 1181.960 | 1673.620 | 問題4 starts at 1670.620 | 491.660 s | `5bfddb0f1a560086582e1d49acd34f98f16141f86387a6ddd31f22dbf240a4e3` |
| `n1-2023-07-04.mp3` | 問題4 / `CHOUKAI_QUICK_RESPONSE` | 1667.620 | 2024.900 | 問題5 starts at 2021.900 | 357.280 s | `115899b546d53ea5be12bd9c758d6bf888edc3c3c2f4f4ef2615465a0df08352` |
| `n1-2023-07-05.mp3` | 問題5 / `CHOUKAI_INTEGRATED` | 2018.900 | 2325.600 | test end at 2325.600 | 306.700 s | `0259808f9a40707d558f1c091cab8b7fa638de445c6998e72e6346c6361ab4b9` |

Every internal boundary has six seconds of total overlap: the preceding clip ends three seconds after the boundary and the following clip starts three seconds before it. All clips are MP3 mono, 32 kHz, 64 kbps. The complete normalized MP3 is retained locally as `data/audio/n1-2023-07/n1-2023-07.mp3` and is not referenced by the fixture.

## Upload readback

The five per-mondai clips were uploaded to Cloudinary folder `jlpt-exam/data/n1-2023-07`. Every versioned URL returned HTTP success during readback; full metadata is recorded in `cloudinary-upload-results.json`.
