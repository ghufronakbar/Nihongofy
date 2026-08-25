# N3 2020-12 聴解 audio segmentation manifest

- Source: `/opt/data/jlpt-pipeline/sources/n3-2020-12/audio.mp3`
- Source duration: `2254.968s`; ffprobe: MP3, 44.1 kHz, stereo
- Acoustic evidence: `/opt/data/jlpt-pipeline/sources/n3-2020-12/generated-silence.log` (`silencedetect=noise=-35dB:d=1.2`)
- Method: boundaries follow the long 問題 transition gaps identified in the supplied audio/script structure and silence detection; not equal-duration splitting. Clips are source-audio trims with conservative transition-gap boundaries.

| 問題 | Output | Start (s) | End (s) | Duration (s) | Boundary evidence | Status |
|---|---|---:|---:|---:|---|---|
| 1 | `generated/audio/n3-2020-12-01.mp3` | 0.000 | 699.029 | 699.029 | Ends at 20.199s silence 699.029–719.228 before 問題2 block | PASS |
| 2 | `generated/audio/n3-2020-12-02.mp3` | 719.228 | 1341.507 | 622.279 | Starts after 問題2 transition gap; ends at 13.302s silence 1341.507–1354.809 before 問題3 | PASS |
| 3 | `generated/audio/n3-2020-12-03.mp3` | 1354.809 | 1786.190 | 431.381 | Starts after 問題3 transition gap; ends at 10.014s silence 1786.190–1796.204 before 問題4 | PASS |
| 4 | `generated/audio/n3-2020-12-04.mp3` | 1796.204 | 1821.819 | 25.615 | 問題4 quick-response block; ends at 10.029s silence 1821.819–1831.848 before 問題5 | PASS |
| 5 | `generated/audio/n3-2020-12-05.mp3` | 1831.848 | 2254.936 | 423.088 | Starts after 問題5 transition gap; ends at source trailing silence 2250.261–2254.936 | PASS |

## Cross-checks

- ASR marker evidence: supplied script order is 問題1 → 問題2 → 問題3 → 問題4 → 問題5; the long silence gaps above align with the section transitions and the rendered listening-page sequence (pages 11–13).
- The segmentation deliberately preserves the complete section blocks, including the long pauses between individual questions; it does not split questions or use equal parts.
- All five output clips were generated with FFmpeg stream-copy trimming and are validated separately with `ffprobe`.
- Answer mappings represented in `generated/fragments/choukai.json`: P1 `2,3,4,2,2,4`; P2 `3,2,4,4,2,3`; P3 `1,4,2`; P4 `2,2,3,2`; P5 `2,3,2,3,1,2,3,1,2`.

## Review note

The supplied ASR transcript was not present as a package-local generated JSON, so marker corroboration is based on the authoritative audio script and rendered listening-page order plus the measured silence log. The clips remain marked PASS for technical segmentation and require no equal-split fallback.

## ffprobe validation command

```sh
ffprobe -v error -show_entries format=duration:stream=codec_name,sample_rate,channels -of default=noprint_wrappers=1 generated/audio/n3-2020-12-0N.mp3
```
