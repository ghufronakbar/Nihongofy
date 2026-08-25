# N3 2020-12 image review

## Choukai 問題4

Status: `not_applicable` — no question-image upload is required.

The rendered listening page was rechecked at full resolution. The illustrated four-panel rows on the page belong to Choukai 問題3 and 問題6, not 問題4. 問題4 is a text-choice item with four printed choices:

1. マイクをセットする
2. しりょうをコピーする
3. 机といすをならべる
4. パソコンを用意する

Therefore, `questionImage` remains `null` for 問題4 by design. No image crop from the earlier mistaken coordinates was uploaded or added to the package.

Evidence:
- Source: `questions.pdf`, listening page scan index 11 (rendered as `rendered/questions/page-13.png` in the package workspace).
- Reinspection confirmed the illustrated row near the upper-middle is labeled 問題3; the 問題4 block below contains only text choices.
- The earlier candidate crops were rejected because they showed text fragments and no panel border/arrow.

This replaces the earlier incorrect assumption that 問題4 required four image crops.

## Other illustrated Choukai items

Illustrations are present for 問題3 and 問題6 in the source scan. They are not currently modeled as question images because the package fragment intentionally represents those audio-driven items with empty printed question/choice text; they remain documented for future image-media review if the repository renderer requires those panels.
