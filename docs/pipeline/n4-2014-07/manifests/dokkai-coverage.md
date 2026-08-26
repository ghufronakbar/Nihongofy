# N4 2014-07 Dokkai coverage

## Scope and result

- Artifact: `generated/fragments/dokkai.json`
- Section: `DOKKAI`, session `2`
- Source-derived total: **10** questions, not 20.
- Compact answer-key rows from native high-resolution page 15:
  - Mondai 4, questions 26–29: `1112`
  - Mondai 5, questions 30–33: `4324`
  - Mondai 6, questions 34–35: `33`

## Source coverage and provenance

| Mondai | Questions | Fragment item | Context/source recovery | Answer source | Explanation check |
| --- | --- | --- | --- | --- | --- |
| 4 | 26–29 | `DOKKAI_SHORT_TEXT` / order 4 | Native question pages 08–09: elevator notice (26), `元気たまご` passage (27–28), and Yamaguchi memo (29) | native page 15, row `1112` | native explanation pages 19–20 support the answer recovery for 26–29 |
| 5 | 30–33 | `DOKKAI_MEDIUM_TEXT` / order 5 | Native question pages 09–10: complete bookstore passage and all question/choice sets | native page 15, row `4324` | native explanation pages 20 support the answer recovery for 30–33 |
| 6 | 34–35 | `DOKKAI_INFORMATION_RETRIEVAL` / order 6 | Native question page 10 plus native facing/right page 11: complete curry menu, group lists, drinks, and note | native page 15, row `33` | native explanation page 20 supports the answer recovery for 34–35 |

Native question pages 12–13 were also read for the required 08–13 range and classified as Choukai material only; they do not contribute Dokkai text or contexts.

## Context references

- `ctx-dokkai-26` → Q26 elevator notice
- `ctx-dokkai-27-28` → Q27–28 `元気たまご` passage
- `ctx-dokkai-29` → Q29 office memo
- `ctx-dokkai-medium` → Q30–33 bookstore passage
- `ctx-dokkai-info` → Q34–35 curry menu/table

## Native input identity

All inspected requested inputs were regular 2382×3369 RGB PNGs with PNG signature `89504e470d0a1a0a`:

- question p08: `ba6803bc07bae4e5b44cbfeed612156a7e1b7808c81180afd2b6c92d9abb0394`
- question p09: `637678db4714ef0356d4210b151b730c7ded92d5620e3bc4bc505939feae375f`
- question p10: `c4aa3483fa26b6957790a294c37cb73b9b1144ca3dabff291031479049a7e6ed`
- question p12 (read/classified as Choukai): `4a19ed4bb220e1d4f3c4666e41bc27059e0b236c8c1744e71d9f8b2da094f469`
- question p13 (read/classified as Choukai): `fc3625c7b70d1d1fc3dcd99b5464232e26f0fee0b49eea82d59dc15391eed857`
- facing page p11: `2ea73937c1da7885aa637a8c9c04099ac705ea8600b8c7bfe0efb0b559107267`
- answer key p15: `a046ed9b5ff87788c68f7c9e400efd1093c0fdcda89bc24d9a8da4519eaa731f`
- explanation p18: `58cdcea98b8e49ff9e4e984aee0ad7ab48ee62bc9a0065e7685bc2ed8324885e`
- explanation p19: `dbde2e2ec6aedcf0593abd358d3d789873a1cd34e6e0dfe1d7311de20cfc5653`
- explanation p20: `ee79bbcf41abd3d1253988de529f78f0a8b2a8bcb212ba0c26898c06adcb43aa`

## Validation target

The final disk validation must require JSON parse success; exactly the three canonical Dokkai enums at session 2/orders 4–6; count rows `4/4/2`; answer rows `1112`, `4324`, `33`; all context refs resolvable; and four nonempty choices with codes `1,2,3,4` per question.
