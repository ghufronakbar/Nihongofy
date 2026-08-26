# N4 2018-12 listening question booklet extraction

## Provenance

Question booklet scans: `rendered/highres/page-10.png` through `page-13.png`; focused crops under `ocr/listening-crops/`. Audio wording is corroborated by `generated/n4-2018-12-asr.json`. Exact answers are authoritative from `ocr/answers-and-transcript.md`.

## 問題1 — 課題理解 — 8 items

Question text is spoken; printed answer semantics are modeled below. Shared audio context: `ctx-choukai-1`.

1. `店の人は何を使って絵本を包みますか。` Printed artwork is one multi-object prompt labeled ア・イ・ウ・エ; source crop still needs final extraction if included as a local question image. Four combination choices are printed in the booklet.
2. `男の学生はいつまでに本を返さなければなりませんか。` Printed date/calendar alternatives; source page artwork should remain a question image if uploaded.
3. `留学生は小学校に何を持って行かなければなりませんか。` Four separate picture answer alternatives; preserve as `questionChoices[].answerImage` if uploaded.
4. `男の学生は何を書きますか。` One form diagram labeled ア=クラス, イ=名前, ウ=じゅうしょ, エ=電話ばんごう. Printed choices: `アイウエ`, `アイウ`, `イウエ`, `イウ`.
5. `女の人はどこから資料を持って行きますか。` One drawer diagram with four numbered positions; preserve as one question image.
6. `女の店員はこれから何をしなければなりませんか。` Four separate picture answer alternatives; preserve as answer images if uploaded.
7. `このクラスの留学生はどこでテキストを買いますか。`
   1. 駅前の本屋
   2. 大学の中の本屋
   3. 事務所
   4. 食堂の前
8. `男の人は来週の日曜日、体育館に何を持って来なければなりませんか。` The printed prompt uses an ア・イ・ウ equipment diagram and combination choices. ASR establishes the semantic requirement as indoor shoes; do not replace the booklet's printed combination choices with transcript prose.

Official answers: `[1, 3, 2, 4, 3, 3, 3, 1]`.

## 問題2 — ポイント理解 — 7 items

Question text is spoken but preserved from the authoritative transcript/ASR. Printed choices are text-only. Shared audio context: `ctx-choukai-2`.

1. `女の人は昨日友達と一緒に何をしたと言っていますか。`
   1. 海の近くで食事した
   2. 山に登った
   3. 海で泳いだ
   4. 海岸を散歩した
2. `学生は工場で何を作っている時に見学をしますか。`
   1. ジュース
   2. アイスクリーム
   3. キャンディー
   4. クッキー
3. `男の学生はいつ山本さんに手紙を渡しますか。`
   1. 山本さんが教室にいる時
   2. 山本さんが教室を出た時
   3. 山本さんが図書館にいる時
   4. 山本さんが図書館を出た時
4. `桜動物園はオープンの日にどうなりますか。`
   1. 開く時間が早くなる
   2. 閉まる時間が遅くなる
   3. 中学生以下はただになる
   4. チケットが安くなる
5. `女の留学生は日本の自動販売機について、どんなことに驚いたと言っていますか。`
   1. いろいろな場所に置いてあること
   2. 売っている物の種類
   3. 言葉を話すこと
   4. お金が盗まれないこと
6. `卵が安くなる時間は何時から何時までですか。`
   1. 5時から5時半まで
   2. 5時から6時まで
   3. 5時半から6時まで
   4. 5時半から6時半まで
7. `男の人はどうして東公園がいいと言っていますか。`
   1. 食べ物の店がたくさんあるから
   2. 祭りがあってにぎやかだから
   3. 船の上で桜が見られるから
   4. 会社から歩いて行けるから

Official answers: `[1, 2, 4, 2, 2, 4, 3]`.

## 問題3 — 発話表現 — 5 items

The printed scenes are single prompt images; spoken responses are choices. The five source-resolution crops under `generated/images/` passed visual QA for complete panel borders, arrows, figures, and safe margins. Shared audio context: `ctx-choukai-3`.

- `n4-2018-12-m3-q1.png`: classroom scene; arrow targets left figure.
- `n4-2018-12-m3-q2.png`: two students/desks; arrow targets right-hand student.
- `n4-2018-12-m3-q3.png`: elevator scene; arrow targets suited man at controls.
- `n4-2018-12-m3-q4.png`: walking scene; arrow targets woman on right.
- `n4-2018-12-m3-q5.png`: two people beside hanging calligraphy; arrow targets man on right.

All question/choice text fields remain empty because the booklet prints only scenes and the answers are spoken. The repository requires four structural choices; the original prompt selects from 1–3, so choice 4 must remain an empty documented schema adapter.

Official answers: `[2, 2, 1, 3, 2]`.

## 問題4 — 即時応答 — 8 items

The booklet explicitly prints no item text or choices. It instructs candidates to listen to one sentence and three responses, then choose from 1–3. Preserve empty question/choice text and add one empty fourth structural choice for the repository schema. Shared audio context: `ctx-choukai-4`.

Official answers: `[3, 3, 3, 1, 2, 3, 2, 1]`.
