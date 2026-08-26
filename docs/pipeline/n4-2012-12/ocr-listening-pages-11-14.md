# JLPT N4 — December 2012 聴解 layout/OCR ledger (rendered pages 11–14)

## Scope and evidence

- Source: `/opt/data/jlpt-pipeline/sources/n4-2012-12/rendered/highres/page-11.png` through `page-14.png`.
- These are rendered scan indices, not reliable printed-page numbers. No conventional printed page number was confidently visible on these four scans.
- All four files are 1191 × 1685 px PNGs. The page hashes were checked before inspection:
  - p.11 `977cd1ce705a5b45cf8071557e4c680239a95d1895af98d5f1c645a24139981b`
  - p.12 `c27527ea3a7a14d035f790402de72cc2994344efe81f146c9f385c7cb2f62277`
  - p.13 `08d59c6631c8fe4c2b2923bbde5627ed0ce4952f3010718319a9a314bfe4f4dc`
  - p.14 `e18cd897ae6b25666f538daa53be8c5e5cf554bebf9d228cda4d4218769d7213`
- Evidence basis: the rendered/high-resolution scans. The answer key was used only for the answer-code reconciliation below; it was **not** used to reconstruct stems, choices, or image content.
- The scans contain distributor banners/QR/promotional material and diagonal watermarks. Those overlays are not exam content and are excluded below.

## Canonical four-mondai mapping

| Listening mondai | Canonical type | Repository enum | Local questions | Scan-page coverage |
|---|---|---|---:|---|
| 問題1 | 課題理解 / task-based understanding | `CHOUKAI_TASK_BASED` | 8 | p.11 q1–4; p.12 q5–8 |
| 問題2 | ポイント理解 / main-point understanding | `CHOUKAI_MAIN_POINT` | 7 | p.12 q1–3; p.13 q4–7 |
| 問題3 | 発話表現 / expression | `CHOUKAI_EXPRESSION` | 5 | p.13 q1–3; p.14 q4–5 |
| 問題4 | 即時応答 / quick response | `CHOUKAI_QUICK_RESPONSE` | 8 | p.14 q1–8 (only instruction/notes on question sheet) |

**Total:** 28 listening questions, with local cardinalities **8 / 7 / 5 / 8**.

## Answer-key reconciliation (codes only)

The visible `参考答案` page labels the listening rows as 問題1–4. The exact rows are:

- 問題1 (8): `1 4 3 4 3 2 2 1`
- 問題2 (7): `4 2 3 3 1 2 3`
- 問題3 (5): `1 2 1 2 1`
- 問題4 (8): `2 3 2 1 2 3 3 1`

These codes are recorded separately from the scan OCR. They do not establish any missing printed wording or choices.

## Page-by-page rendered layout

### Rendered page 11 — 問題1, local 1–4

Printed heading/instruction:

> `聴解` / `もんだい１では、まず しつもんを 聞いて ください。それから 話を 聞いて、もんだいようしの １から４の 中から、いちばん いい ものを 一つ えらんで ください。`

The individual question stem, dialogue/talk, and required information are audio-only. The sheet prints the alternatives.

- **問題1・1ばん:** four printed picture alternatives (visible as bicycle, train, bus, car). The images are choices, not a shared prompt. No item stem is printed.
- **問題1・2ばん:** four printed picture alternatives: a bag/purse, cup, a can labelled/appearing to be `コーヒー`, and a folded paper/cloth-like object. The fourth object's exact identity is not secure at this resolution. No item stem is printed.
- **問題1・3ばん:** four printed text choices:
  1. `２まい`
  2. `４まい`
  3. `５まい`
  4. `６まい`
  The question and count information are audio-only.
- **問題1・4ばん:** one printed picture panel containing four subpictures labelled `ア`, `イ`, `ウ`, `エ`, followed by printed pair choices:
  1. `ア イ`
  2. `ア エ`
  3. `イ ウ`
  4. `イ エ`
  The question/spoken description is audio-only. The subpicture details are not transcribed as answer text; the scan appears to show a seaside scene, an outdoor/tree scene, a woman in a room/bed scene, and a woman near a train/platform scene.

**Image provenance:** q1 and q2 use four separate printed answer-image panels; q4 uses one printed four-subpicture answer panel plus pair labels. These are `answerImage[]`-type alternatives, not `questionImage` prompts.

### Rendered page 12 — 問題1 q5–8; 問題2 q1–3

#### 問題1, local 5–8

- **5ばん:** four printed picture alternatives in a 2×2 grid:
  1. bouquet/floral arrangement;
  2. decorated gift basket/container with a bow;
  3. books/notebooks/albums/documents (fine object identity not fully secure);
  4. music-related discs/media.
  No written stem is printed; prompt and spoken description are audio-only.
- **6ばん:** four printed picture alternatives in a 2×2 grid:
  1. woman at a desk/computer;
  2. woman handling a large folder/board/equipment-like object;
  3. people seated around a table/meeting;
  4. woman arranging chairs/tables.
  No written stem is printed; prompt and spoken description are audio-only.
- **7ばん:** four printed text choices:
  1. `8時半に　きょうしつ`
  2. `8時半に　たいいくかんの　前`
  3. `9時に　きょうしつ`
  4. `9時に　たいいくかんの　前`
  The question/dialogue is audio-only.
- **8ばん:** four printed text choices:
  1. `あかと　きいろ`
  2. `あかと　しろ`
  3. `あおと　きいろ`
  4. `あおと　しろ`
  The question/dialogue is audio-only.

**Image provenance:** q5 and q6 are printed answer-image alternatives, four panels per item. They are not spoken-response picture prompts.

#### 問題2, local 1–3

Printed instruction:

> `もんだい２では、まず しつもんを 聞いて ください。その あと、もんだいようしを 見て ください。読む 時間が あります。それから 話を 聞いて、もんだいようしの １から４の 中から、いちばん いい ものを 一つ えらんで ください。`

The instruction explicitly says to listen to the question, then look at the sheet/read the alternatives, then listen to the talk. The individual stems/dialogues are audio-only; all four alternatives are printed text.

- **1ばん:** `りょうしん` / `あね` / `いもうと` / `おとうと`
- **2ばん:** `今すぐ` / `今日の ４時` / `今日の ６時` / `あしたの ひる`
- **3ばん:** `りょこうに　行きたいから` / `デパートで　かいものが　したいから` / `日本人の　はたらきかたが　しりたいから` / `日本語の　べんきょうが　したいから`

### Rendered page 13 — 問題2 q4–7; 問題3 q1–3

#### 問題2, local 4–7

Only the four alternatives for each item are printed; stems/dialogues are audio-only. The visible choice layout is two columns (1/3 at left, 2/4 at right).

- **4ばん:** `かようび` / `すいようび` / `もくようび` / `きんようび`
- **5ばん:** `ぜんぜん　読まない` / `月に 1さつ 読む` / `月に 3さつ 読む` / `月に 10さついじょう 読む`
- **6ばん:** `小学校の　先生` / `ピアニスト` / `けいさつかん` / `かんごし`
- **7ばん:** `10 時` / `10 時 10 分` / `10 時 20 分` / `10 時 30 分`

#### 問題3, local 1–3

Printed instruction:

> `もんだい 3 では、えを 見ながら しつもんを 聞いて ください。（やじるし）の 人は 何と 言いますか。１から３の 中から、いちばん いい ものを 一つ えらんで ください。`

The sheet prints a picture prompt for each item, with an arrow identifying the speaker. The question and all three response alternatives are audio-only; they are not printed on the question sheet.

- **1ばん:** man at left and woman at right holding a dark bag; arrow points to the woman.
- **2ばん:** man at left (shoulder bag) gesturing toward a woman at right; arrow points to the man.
- **3ばん:** classroom scene; woman/student in foreground raises a hand; arrow points to her.

**Image provenance:** q1–3 are `questionImage`-type scene prompts, not answer-choice panels. The three spoken responses belong to the audio.

### Rendered page 14 — 問題3 q4–5; 問題4 instruction

#### 問題3, local 4–5

The page begins with the final two illustrated items before the explicit 問題4 heading. Their placement and sequence identify them as 問題3 q4–5; they are not 問題4 items.

- **4ばん:** framed scene with a seated woman behind a desk/open laptop and a standing man holding a large bag; arrow above the figures points to the responding person. No printed responses or item text.
- **5ばん:** framed scene with two people seated at a table with books/notebooks; arrow above the figures points to the responding person. No printed responses or item text.

Both are printed `questionImage` prompts; the spoken question and three responses are audio-only.

#### 問題4

Printed instruction:

> `もんだい４ では、えなどが ありません。まず ぶんを 聞いてください。それから、その へんじを 聞いて、１から３の 中から、いちばん いい ものを 一つ えらんで ください。`

A printed `―メモ―` note area follows. No individual 問題4 stems or responses are printed on the question sheet. All q1–8 sentence/response material is audio-only. The printed `１から３` is an instruction range, not three visible choices.

**Important schema note:** this source visibly has **three** response alternatives for 問題4, unlike the repository's generic four-choice shape. Parent-side package modeling must preserve the source cardinality or use the project's established N4 adaptation; do not invent a fourth response from the answer key.

## Printed/audio matrix

| Mondai/item | Printed on question sheet | Audio-only on question sheet |
|---|---|---|
| M1 q1–2 | Four picture choices | Stem, talk, requested fact |
| M1 q3 | Four numeric text choices | Stem, talk, requested count |
| M1 q4 | Four subpictures + four pair-label choices | Stem, talk, requested selection |
| M1 q5–6 | Four picture choices each | Stem, talk, requested fact |
| M1 q7–8 | Four text choices each | Stem, talk, requested fact |
| M2 q1–7 | Four text choices each | Question stem and dialogue/talk |
| M3 q1–5 | One arrow-marked scene image per item | Question and three spoken responses |
| M4 q1–8 | Only section instruction and `1から3` range; no item choices | Sentence and three response alternatives |

## Review/blocker notes

1. **No printed page numbers:** the rendered filenames/page indices are used for provenance; no conventional printed page number was confidently visible on pages 11–14.
2. **Watermarks/overlays:** distributor banners, QR/promo blocks, and diagonal watermarks cross the scans. They are excluded from exam OCR.
3. **Image semantic detail:** several small objects (especially M1 q2 choice 4, M1 q5 panel 3, and some M1 q4/M3 scene details) are not safe to name more precisely than the descriptions above. Their role and panel ownership are clear.
4. **M4 three-choice layout:** this is a source/layout issue to carry into parent modeling and validation. Do not infer a fourth choice.
5. **Audio not altered:** no clips were created or modified in this task. The supplied `/audio.mp3` is actually an MP4/M4A container with AAC audio (confirmed separately with ffprobe); segmentation remains with the parent agent.

Status: **layout verified; source/page coverage complete for the requested pages; exact answer-code rows reconciled; fine-grained image semantics and generic four-choice adaptation remain parent-side review items.**
