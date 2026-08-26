# N3 2016-07 聴解 audio segmentation manifest

- Source: `audio.mp3`
- Source SHA-256: `6fdda21080241de66ad6ddc208e7ef2e290db31c876a70b2343aee8b84df4852`
- Probe: MP3, stereo, 44.1 kHz, duration `1999.307755` seconds, 19,237,088 bytes.
- ASR: `n3-2016-07-asr.json`, faster-whisper small, Japanese, CPU/int8, 428 segments, reported duration `1999.281625` seconds.
- Silence detector: FFmpeg `silencedetect=noise=-35dB:d=1.2` produced no intervals in the current run.

## Status

`needs_review` — timestamped ASR exists, but reliable mondai-level marker evidence is incomplete. The ASR did not consistently emit `問題1`–`問題5`; some item markers were recognized, but the beginning is affected by source watermark/promo audio and the section transitions are not yet independently reconciled against the script.

No final clips are claimed or attached to package JSON yet. Do not set `storyAudio` until each boundary is supported by script order, ASR evidence, acoustic evidence, and FFprobe readback.

## Expected listening shape

- 問題1 / `CHOUKAI_TASK_BASED`: 6 questions
- 問題2 / `CHOUKAI_MAIN_POINT`: 6 questions
- 問題3 / `CHOUKAI_OUTLINE`: 3 questions
- 問題4 / `CHOUKAI_EXPRESSION`: 4 questions, image prompts
- 問題5 / `CHOUKAI_INTEGRATED`: 9 questions

## Review blockers

1. Locate the true start after the promotional audio at the beginning.
2. Reconcile all five mondai transitions against the rendered script pages 16–19.
3. Select conservative boundaries with padding; do not use equal-duration splitting.
4. Create and visually inspect four Q4 image crops from the question booklet before any upload.
5. After every cut, record source span, selected silence/marker evidence, output duration, checksum, and final status.
