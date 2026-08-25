# N3 December 2019 Choukai audio segmentation

Status: `verified_candidate` — boundaries are supported by timestamped Japanese ASR, explicit `問題N` markers, FFmpeg silence detection, source-script sequence, and FFprobe output. They are not equal-duration splits.

## Sources and method

- Full recording: `audio.mp3`
- Source duration: `2163.048 s`
- Source stream: MP3, 48,000 Hz, stereo, 128 kb/s
- Timestamped full ASR: `generated/audio-asr-base.jsonl`
- Focused boundary ASR: `generated/audio-boundary-asr-base.jsonl`
- ASR engine: `faster-whisper-base`, Japanese, word timestamps
- Silence logs:
  - `generated-silence-35dB.log` — `silencedetect=noise=-35dB:d=0.8`
  - `generated-silence-40dB.log` — `silencedetect=noise=-40dB:d=0.5`
- Script/order evidence: `ocr/audio-script-all.txt`
- Segmentation rule: each clip begins at the **start of the silence immediately before its own `問題N` announcement**. The clip ends where the next clip begins. 問題1 begins at source time 0 to retain the official recording intro; 問題5 ends at the source duration to retain the closing announcement.

## Outputs

| Mondai | Output | Source start | Source end | Intended span | FFprobe duration | Marker evidence immediately after start | Boundary silence evidence | Status |
|---|---|---:|---:|---:|---:|---|---|---|
| 問題1 | `generated/audio/n3-2019-12-01.mp3` | 0.000 | 543.054 | 543.054 | 543.096 | ASR 3.580–13.840: `日本語能力試験、聴解N3、これからN3の聴解試験を始めます`; ASR 15.220–22.300: `問題1。問題1では…` | source start | PASS |
| 問題2 | `generated/audio/n3-2019-12-02.mp3` | 543.054 | 1284.809 | 741.755 | 741.792 | focused ASR 544.380–556.740: `問題2、問題2では、まず質問を聞いてください…` | -35 dB: 543.054–544.842 (1.789 s); -40 dB: 543.258–544.842 (1.584 s) | PASS |
| 問題3 | `generated/audio/n3-2019-12-03.mp3` | 1284.809 | 1596.238 | 311.429 | 311.472 | focused ASR 1286.200–1294.440: `問題3、問題3では…何も印刷されていません` | -35 dB: 1284.809–1286.604 (1.795 s); -40 dB: 1285.028–1286.603 (1.576 s) | PASS |
| 問題4 | `generated/audio/n3-2019-12-04.mp3` | 1596.238 | 1788.521 | 192.283 | 192.312 | focused ASR 1597.760–1605.580: `問題4。問題4では絵を見ながら質問を聞いてください` | -35 dB: 1596.238–1598.039 (1.801 s); -40 dB: 1596.444–1598.037 (1.593 s) | PASS |
| 問題5 | `generated/audio/n3-2019-12-05.mp3` | 1788.521 | 2163.048 | 374.527 | 374.544 | focused ASR marker words at 1790.040–1793.680: `問題5。問題5では…`; ASR 1800.300–1815.760 gives its instructions | -35 dB: 1788.521–1790.341 (1.820 s); -40 dB: 1788.747–1790.341 (1.594 s) | PASS |

MP3 frame/encoder padding accounts for the small difference between intended spans and FFprobe durations (0.017–0.043 s); no boundary was chosen from encoded output duration.

## End-edge evidence

- 問題1 final scripted item is Q6; the next detected section marker is 問題2 at ~544.38 s.
- 問題2 final scripted item is Q6, followed by the official pause (`ここで、ちょっと休みましょう`) and continuation, then 問題3 at ~1286.20 s.
- 問題3 final scripted item is Q3; the next marker is 問題4 at ~1597.76 s.
- 問題4 final scripted item is Q4; the next marker is 問題5 at ~1790.04 s.
- 問題5 final scripted item is Q9; ASR 2131.520–2135.340 detects the closing announcement (`これで…試験を終わります`), followed by source-end silence through 2163.048 s.

## Reproduction and QA

- Reproduction script: `generated/segment_choukai_audio.py`
- All five outputs were re-encoded at MP3/48 kHz/stereo/128 kb/s and read successfully by FFprobe.
- Counts and script order are 6/6/3/4/9; no item marker falls across a chosen section boundary.
- The package-local fragment initially kept all five `storyAudio` fields `null` during source-only generation. Final assembly uploaded/read back the five clips and populated verified Cloudinary URLs in `src/test-package-data/n3-2019-12.json`.

## Review caveat

Base-model ASR contains occasional lexical errors in ordinary dialogue (`問題用紙` may be rendered as `問題用詞`, etc.), but the numeric `問題1`–`問題5` markers, section instruction phrases, and their temporal order are independently corroborated by the authoritative script and two silence thresholds. Boundary status is therefore `verified_candidate`; human listening can still be used as a final publication check.
