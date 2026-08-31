# N1 2022-12 review queue

## Resolved during extraction

- [x] The standalone answer-key PDF is used as the authoritative key.
- [x] Question PDF page 44 incorrectly summarizes 問題8 as `1312`; the standalone key and passage review confirm `2112`.
- [x] Vertical text for question 48 was manually transcribed from the rendered page.
- [x] OCR corrections include `パンダ`, `対峙`, `一役買っています`, `知の体系`, `必然`, `暗礁に乗り上げる`, `不可欠`, `自信`, and the date `2022年8月1日から2023年3月31日`.
- [x] All five listening clips have Cloudinary HEAD readback success.

## Non-blocking notes

- The source question PDF is an edited third-party copy and includes an inconsistent answer summary on its final page; the separate answer-key PDF is retained as provenance.
- ASR contains expected hallucination around silent instruction gaps in 問題5. Segment boundaries were checked against audible mondai markers and the supplied listening script, not ASR text alone.
