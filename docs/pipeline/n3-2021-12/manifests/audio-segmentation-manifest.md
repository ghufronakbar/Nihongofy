# N3 2021-12 聴解 audio segmentation manifest

- Source: `/opt/data/jlpt-pipeline/sources/n3-2021-12/audio.mp3`
- ASR: `/opt/data/jlpt-pipeline/sources/n3-2021-12/generated/n3-2021-12-asr.json` (faster-whisper base, Japanese, word timestamps; 533 segments)
- Acoustic evidence: `/opt/data/jlpt-pipeline/sources/n3-2021-12/generated/n3-2021-12-silence.log` (`silencedetect=noise=-35dB:d=1.2`)
- Method: 問題 markers corroborated with acoustic silence; boundaries are not equal-duration splits; clips include only source audio.

## 問題1
- Output: `generated/audio/n3-2021-12-01.mp3`
- Start: `80.558s`
- End: `779.910s`
- Duration: `699.352s`
- ASR marker: `84.28s`
- Evidence: ASR marker 問題1 at 84.28s; silence threshold -35 dB, minimum 1.2s; boundary chosen at acoustic gap(s) (89.964785, 91.561769, 1.596984)
- Edge transcript: 84.28-89.86 問題1。問題1では、まず質問を聞いてください。 / 91.39-96.55 それから話を聞いて、問題用士の1から4の中から、 / 97.09-99.81 最もよいものを1つ選んでください。 / … / 759.47-764.57 で、女の人と男の人がスーパーで話しています。 / 765.67-769.79 男の人は、どうして自分で料理をしませんか?
- Validation: PASS — ffprobe confirms readable MP3 (44.1 kHz mono); ASR edge transcript present within the first/last 18 seconds and marker lies inside clip

## 問題2
- Output: `generated/audio/n3-2021-12-02.mp3`
- Start: `779.910s`
- End: `1322.483s`
- Duration: `542.573s`
- ASR marker: `842.30s`
- Evidence: ASR marker 問題2 at 842.30s; silence threshold -35 dB, minimum 1.2s; boundary chosen at acoustic gap(s) (848.015102, 850.020862, 2.00576)
- Edge transcript: 796.41-798.35 たなかく、おかいもの? / … / 1300.07-1304.93 ラジオで、女の人が自分の趣味について話しています。 / 1306.11-1310.65 女の人は家で野菜を作り始めて良かったことは、 / 1311.05-1312.29 なんだと言っていますか?
- Validation: PASS — ffprobe confirms readable MP3 (44.1 kHz mono); ASR edge transcript present within the first/last 18 seconds and marker lies inside clip

## 問題3
- Output: `generated/audio/n3-2021-12-03.mp3`
- Start: `1322.483s`
- End: `1801.787s`
- Duration: `479.304s`
- ASR marker: `1557.42s`
- Evidence: ASR marker 問題3 at 1557.42s; silence threshold -35 dB, minimum 1.2s; boundary chosen at acoustic gap(s) (1564.91093, 1566.630204, 1.719274)
- Edge transcript: 1338.38-1342.24 私、最近家の2話で野菜を作り始めたんです。 / … / 1785.57-1786.05 3。 / 1787.20-1790.06 佐藤君のバイト先に食事に行きたい。 / 1792.96-1793.32 4。 / 1794.54-1797.60 佐藤君のバイト先で自分も働きたい。
- Validation: PASS — ffprobe confirms readable MP3 (44.1 kHz mono); ASR edge transcript present within the first/last 18 seconds and marker lies inside clip

## 問題4
- Output: `generated/audio/n3-2021-12-04.mp3`
- Start: `1801.787s`
- End: `2203.128s`
- Duration: `401.341s`
- ASR marker: `1972.34s`
- Evidence: ASR marker 問題4 at 1972.34s; silence threshold -35 dB, minimum 1.2s; boundary chosen at acoustic gap(s) (1979.389955, 1981.678821, 2.288866)
- Edge transcript: 1809.34-1809.86 2番。 / 1810.88-1813.12 テレビで、医者が話しています。 / 1815.20-1821.30 私は患者さんから、ストレスや疲れで体の調子が良くないという相談を受けることがあります。 / … / 2183.10-2185.68 どうやって予約するのか教えましょうか? / 2187.86-2188.10 2。 / 2189.35-2191.43 予約はどうすればいいんですか? / 2193.71-2193.97 3。
- Validation: PASS — ffprobe confirms readable MP3 (44.1 kHz mono); ASR edge transcript present within the first/last 18 seconds and marker lies inside clip

## 問題5
- Output: `generated/audio/n3-2021-12-05.mp3`
- Start: `2203.128s`
- End: `2597.434s`
- Duration: `394.305s`
- ASR marker: `2212.44s`
- Evidence: ASR marker 問題5 at 2212.44s; silence threshold -35 dB, minimum 1.2s; boundary chosen at acoustic gap(s) (2220.040204, 2221.673061, 1.632857)
- Edge transcript: 2212.44-2213.36 問題5。 / 2214.38-2215.54 問題5では、 / 2216.37-2219.91 問題用紙に何も印刷されていません。 / … / 2578.30-2580.16 では、おめに書かります。 / 2592.22-2592.70 これで、 / 2593.48-2595.22 紹介試験を終わります。
- Validation: PASS — ffprobe confirms readable MP3 (44.1 kHz mono); ASR edge transcript present within the first/last 18 seconds and marker lies inside clip
