# N3 2022-12 聴解 audio segmentation manifest

- Source: `/opt/data/jlpt-pipeline/sources/n3-2022-12/choukai.mp3`
- Method: faster-whisper base, Japanese, timestamped segments; long-silence acoustic bracketing at `-35 dB / 1.2 s`; no equal-duration splitting.
- Status: generated clips are evidence-backed; boundaries are conservative acoustic speech-envelope boundaries with ASR marker corroboration.

## 問題1
- Output: `generated/audio/n3-2022-12-01.mp3`
- Start: `77.26s`
- End: `634.27s`
- Duration: `557.01s`
- ASR marker: `80.18s`
- Evidence: ASR: 問題1 at 80.18s; acoustic start/end bracketed by 3.30s and 20.22s silence
- Edge transcript: 70.02-77.26 手を上げてください 問題がよく見えないときも / 77.26-80.18 手を上げてください / 80.18-90.82 いつでもいいです 問題1 / 90.82-101.46 問題1ではまず質問を聞いてください それから話を聞いて / … / 618.17-623.01 テーブルは壁に貼った図を見て並べてください / 623.01-647.40 では始めてください 店員はこれからまず何をしますか
- Validation: PASS — ffprobe confirms readable MP3 audio stream (44.1 kHz stereo) and edge transcript is present on both sides where source ASR covers the edge.

## 問題2
- Output: `generated/audio/n3-2022-12-02.mp3`
- Start: `643.64s`
- End: `1358.05s`
- Duration: `714.41s`
- ASR marker: `647.40s`
- Evidence: ASR: 問題2 instruction at 647.40s; acoustic start/end bracketed by 9.87s and 9.20s silence
- Edge transcript: 623.01-647.40 では始めてください 店員はこれからまず何をしますか / 647.40-656.04 問題に 問題にではまず質問を聞いてください / 656.04-661.24 その後、問題用紙を見てください / … / 1325.80-1370.38 ここでちょっと安みましょう。では、また続けます。
- Validation: PASS — ffprobe confirms readable MP3 audio stream (44.1 kHz stereo) and edge transcript is present on both sides where source ASR covers the edge.

## 問題3
- Output: `generated/audio/n3-2022-12-03.mp3`
- Start: `1361.68s`
- End: `1696.07s`
- Duration: `334.39s`
- ASR marker: `1370.38s`
- Evidence: ASR: 問題3 at 1370.38s; acoustic start/end bracketed by 3.63s and 6.63s silence
- Edge transcript: 1325.80-1370.38 ここでちょっと安みましょう。では、また続けます。 / 1370.38-1380.62 問題3。問題3では、問題用詞に何も印刷されていません。 / … / 1679.18-1685.88 3. 授業を選ぶ時の注意点 / 1685.88-1699.82 4. 教える先生の情報 / 1699.82-1704.22 問題4. 問題4では
- Validation: PASS — ffprobe confirms readable MP3 audio stream (44.1 kHz stereo) and edge transcript is present on both sides where source ASR covers the edge.

## 問題4
- Output: `generated/audio/n3-2022-12-04.mp3`
- Start: `1698.40s`
- End: `1872.75s`
- Duration: `174.35s`
- ASR marker: `1699.82s`
- Evidence: ASR: 問題4 at 1699.82s; acoustic start/end bracketed by 2.34s and 8.07s silence
- Edge transcript: 1685.88-1699.82 4. 教える先生の情報 / 1699.82-1704.22 問題4. 問題4では / 1704.22-1709.10 絵を見ながら質問を聞いてください / 1709.10-1714.34 矢印の人は何と言いますか / … / 1858.01-1861.82 見学させて欲しいんですが / 1861.82-1863.22 3 / 1863.22-1876.44 見学すればいいですか / 1876.44-1878.68 問題5
- Validation: PASS — ffprobe confirms readable MP3 audio stream (44.1 kHz stereo) and edge transcript is present on both sides where source ASR covers the edge.

## 問題5
- Output: `generated/audio/n3-2022-12-05.mp3`
- Start: `1875.09s`
- End: `2191.49s`
- Duration: `316.40s`
- ASR marker: `1876.44s`
- Evidence: ASR: 問題5 at 1876.44s; acoustic start/end bracketed by 1.53s and end-of-file silence
- Edge transcript: 1863.22-1876.44 見学すればいいですか / 1876.44-1878.68 問題5 / 1878.68-1880.72 問題5では / 1880.72-1886.56 問題用紙に何も印刷されていません / 1886.56-1891.14 まず文を聞いてください / … / 2177.24-2180.56 3 / 2180.56-2183.56 あ、こちらの資料です。どうぞ
- Validation: PASS — ffprobe confirms readable MP3 audio stream (44.1 kHz stereo) and edge transcript is present on both sides where source ASR covers the edge.
