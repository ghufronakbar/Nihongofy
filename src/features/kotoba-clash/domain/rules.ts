export const CLASH_RULES_VERSION = 1;
export const CLASH_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
export const CLASH_QUESTION_COUNTS = [5, 10, 15, 20] as const;
export const CLASH_COUNTDOWN_MS = 5_000;
export const CLASH_REVEAL_MS = 8_000;
export const CLASH_MIN_PLAYERS = 2;
export const CLASH_MAX_PLAYERS = 20;
export const CLASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
export const CLASH_LOBBY_IDLE_MS = 30 * 60 * 1_000;

export const CLASH_DURATIONS_MS = {
  MOJI_GOI_READ_KANJI: 30_000,
  MOJI_GOI_WRITE_KANJI: 30_000,
  MOJI_GOI_WORD_FORMATION: 30_000,
  MOJI_GOI_CONTEXT: 30_000,
  MOJI_GOI_SYNONYM: 30_000,
  MOJI_GOI_WORD_USAGE: 30_000,
  BUNPOU_GRAMMAR: 45_000,
  BUNPOU_SENTENCE_COMPOSITION: 60_000,
  BUNPOU_TEXT_GRAMMAR: 90_000,
  DOKKAI_SHORT_TEXT: 90_000,
  DOKKAI_MEDIUM_TEXT: 150_000,
  DOKKAI_LONG_TEXT: 240_000,
  DOKKAI_INTEGRATED: 240_000,
  DOKKAI_MAIN_IDEA: 180_000,
  DOKKAI_INFORMATION_RETRIEVAL: 120_000,
} as const;

export type ClashMondaiType = keyof typeof CLASH_DURATIONS_MS;
export const CLASH_MONDAI_TYPES = Object.keys(CLASH_DURATIONS_MS) as [
  ClashMondaiType,
  ...ClashMondaiType[],
];

export const CLASH_CATEGORIES = {
  MOJI_GOI: CLASH_MONDAI_TYPES.filter((type) => type.startsWith("MOJI_GOI_")),
  BUNPOU: CLASH_MONDAI_TYPES.filter((type) => type.startsWith("BUNPOU_")),
  DOKKAI: CLASH_MONDAI_TYPES.filter((type) => type.startsWith("DOKKAI_")),
} as const;
