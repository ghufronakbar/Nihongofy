# N3 2016-07 聴解 audio segmentation manifest

- Source: `audio.mp3`
- Source SHA-256: `6fdda21080241de66ad6ddc208e7ef2e290db31c876a70b2343aee8b84df4852`
- Probe: MP3, stereo, 44.1 kHz, duration `1999.307755` seconds, 19,237,088 bytes.
- ASR: `n3-2016-07-asr.json`, faster-whisper small, Japanese, CPU/int8, 428 segments, reported duration `1999.281625` seconds.
- Acoustic evidence: FFmpeg `silencedetect=noise=-35dB:d=1.2` was initially inconclusive; a focused `d=0.7` pass identified the selected long transition silences.

## Final status

`human_playback_approved_audio_uploaded`

The five corrected per-Mondai clips were delivered as native Discord voice messages and the user approved them with `okee udah oke, langsung saja merge` (Discord message `1542019786073047060`, session `20260825_203956_a82d876b`). The approved MP3 files were subsequently uploaded to Cloudinary without recutting. Their exact source SHA-256 values match the files reviewed by the user.

Every Cloudinary asset passed:

- exact local source checksum and byte count;
- signed upload to `jlpt-exam/data/n3-2016-07`;
- Admin API identity, type, format, and byte-count readback;
- independent HTTPS byte-range response (`206`, `audio/mpeg`, MP3 magic bytes).

## Final clips

| Mondai | Type | Source span (s) | FFprobe duration (s) | SHA-256 | Status |
|---|---|---:|---:|---|---|
| 1 | `CHOUKAI_TASK_BASED` | `8.392562–546.009000` | `537.652245` | `450934b533e96e3e8efd90c8c937cbab5d7ab4fa05da61bdf499c98d762ba4be` | approved/uploaded |
| 2 | `CHOUKAI_MAIN_POINT` | `546.009000–1212.846000` | `666.880000` | `704382d7e19c8a7549ab3a1e0450ea33f320d28b8fdf496f1c268922e7841bb2` | approved/uploaded |
| 3 | `CHOUKAI_OUTLINE` | `1212.846000–1524.374000` | `311.562449` | `f218e03744a52fe2f29666f0e2292b643fdb26a935c81196d4e9b07d7379c832` | approved/uploaded |
| 4 | `CHOUKAI_EXPRESSION` | `1524.374000–1681.202000` | `156.865306` | `da62090fda87cc7bdf28d4e352ef20eea95049250ac783d85ee91248b85be0e0` | approved/uploaded |
| 5 | `CHOUKAI_INTEGRATED` | `1681.202000–1999.281633` | `318.119184` | `cf6979da81e9e77f734cc554c0d45fd5c65a09b4cc45b55eda098abd07131070` | approved/uploaded |

The selected M3, M4, and M5 starts coincide with long focused-silence intervals beginning near `1212.846`, `1524.374`, and `1681.202`. The true listening start follows the source promotional lead-in at `8.392562`. Human playback approval is the final semantic boundary evidence for all five clips.

## Package attachment

`ctx-choukai-1` through `ctx-choukai-5` each carry the corresponding verified `storyAudio` HTTPS URL. The non-secret upload/readback evidence is recorded in `media-upload-results.json`.

## Remaining media note

This manifest resolves the empty Choukai audio-context defect only. The four picture prompts for `CHOUKAI_EXPRESSION` remain a separate image-media review concern and are not represented as completed by this audio repair.
