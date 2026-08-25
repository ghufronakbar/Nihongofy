# N3 July 2019 Choukai audio segmentation

## Scope

- Package root: `/opt/data/jlpt-pipeline/sources/n3-2019-07`
- Source audio: `audio.mp3`
- Source audio probe: MP3, 48 kHz, stereo, 128001 bit/s, `2138.040000` seconds, `34209069` bytes.
- Output clips: exactly five package-local files under `generated/audio/`.
- Remote/repository writes: none.

## Source/page-role reconciliation

The source booklet's rendered cover notes state that test-paper analysis starts at printed page 14 and the listening script starts at printed page 19. Rendered filenames were not treated as printed-page numbers.

- `rendered/script/page-01.png` through `page-04.png`: listening script sequence for 問題1–5.
- `rendered/highres/questions/page-13.png`: printed 聴解 question page containing 問題1 (1–6) and 問題2 (1–4), with printed four-choice alternatives.
- `rendered/highres/questions/page-14.png`: printed 聴解 question page continuing 問題2 (5–6), plus 問題3, 問題4, and 問題5. 問題4 contains four printed picture prompts with arrows; they are scene prompts, not four answer alternatives. 問題3 and 問題5 are audio-only; 問題5 uses three heard alternatives.

## Evidence and limitations

No timestamped Japanese ASR artifact or marker transcript was available in the package. Therefore, no marker-level ASR evidence is claimed. Boundaries were selected from the authoritative script sequence (問題1→問題2→問題3→問題4→問題5) and acoustic silence detection at `-35 dB / 0.8 s`.

All five boundaries are `needs_review`: the long pause before each next section is acoustically clear, but the absence of timestamped ASR means the exact `問題N` announcement cannot be independently verified. The selected boundary is the start of the long silence so that the following clip retains its leading transition/instruction material.

## Selected spans

| Clip | Mondai/type | Source span (s) | Selected boundary evidence | Output duration (ffprobe) | Status |
|---|---|---:|---|---:|---|
| `n3-2019-07-01.mp3` | 問題1 / `CHOUKAI_TASK_BASED` (6) | `0.000–578.458` | source start; script order, no preceding marker | `578.496` | `needs_review` |
| `n3-2019-07-02.mp3` | 問題2 / `CHOUKAI_MAIN_POINT` (6) | `578.458–1193.257` | silence `578.458–598.561` (`20.103 s`), marker ASR unavailable | `614.832` | `needs_review` |
| `n3-2019-07-03.mp3` | 問題3 / `CHOUKAI_OUTLINE` (3) | `1193.257–1575.373` | silence `1193.257–1206.605` (`13.348 s`), marker ASR unavailable | `382.152` | `needs_review` |
| `n3-2019-07-04.mp3` | 問題4 / `CHOUKAI_EXPRESSION` (4) | `1575.373–1761.621` | silence `1575.373–1584.380` (`9.007 s`), marker ASR unavailable | `186.288` | `needs_review` |
| `n3-2019-07-05.mp3` | 問題5 / `CHOUKAI_QUICK_RESPONSE` (9) | `1761.621–2138.040` | silence `1761.621–1773.095` (`11.474 s`), marker ASR unavailable; source end retained | `376.416` | `needs_review` |

FFmpeg MP3 frame padding accounts for the small readback differences between intended spans and probed output durations. The five output durations are intentionally non-equal and preserve evidence-based source spans.

## Answer-key reconciliation

The supplied `ocr/answers-all.txt` answer rows were scoped by repeated local 問題 number and reconciled to the requested Choukai mapping:

- 問題1: `213222`
- 問題2: `231313`
- 問題3: `144`
- 問題4: `2113`
- 問題5: `232221311`

No definite red answer markings were legible on the rendered script pages; the JSON uses the supplied authoritative key.

## Local-only media policy

`generated/fragments/choukai.json` keeps all `storyAudio`, `questionImage`, and `answerImage` fields explicitly `null`. Local MP3 paths are documented here only. No image crops were written because the requested outputs are the fragment, five audio clips, and this manifest; 問題4 picture-panel cropping remains a review/final-media task.

## Validation record

- JSON syntax: passed with Python `json.load`/`json.tool`.
- Audio: all five clips probed successfully with `ffprobe`; MP3 codec, stereo channels, and 48 kHz read back.
- Final status: `needs_review` because ASR marker evidence is unavailable and 問題4 picture-panel media is not cropped/uploaded in this local-only task.
