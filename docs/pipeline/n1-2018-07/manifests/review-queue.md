# Review Queue - JLPT N1 2018-07

Status: `auto_pass`

- Visual QA covered all 30 question-booklet pages and all 13 answer/transcript pages.
- The answer PDF and listening-script PDF are byte-identical. The shared 13-page document contains the complete answer table and listening transcript, so this is a source anomaly rather than a blocker.
- The visual answer table overrides OCR ambiguities for DOKKAI 問題9 and CHOUKAI 問題4.
- 問題9 contains nine questions in this edition; this differs from some other N1 editions and was preserved from the source.
- Quick-response items retain a fourth empty compatibility choice to satisfy the repository schema, although the official audio provides three choices.
- No question-specific image assets are required. The information-retrieval table is preserved as structured story text.
- Audio boundaries are supported by timestamped Japanese ASR, the official script, and silence detection.
