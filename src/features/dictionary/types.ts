export type DictionarySense = {
  glosses: string[];
  partsOfSpeech: string[];
  labels: string[];
  notes: string[];
};

// Setiap hasil adalah SATU pasangan ejaan–bacaan. Sense tidak digabung antarbacaan.
export type DictionaryHit = {
  id: string;
  word: string;
  reading: string;
  common: boolean;
  formLabels: string[];
  senses: DictionarySense[];
  sensesTruncated: boolean;
  match: "exact" | "deinflected" | "kana";
  reasons: string[];
};

export type DictionaryResult = {
  query: string;
  version: string;
  sourceDate: string;
  language: "eng";
  hits: DictionaryHit[];
  truncated: boolean;
};

export type DictionaryResponse =
  | { ok: true; result: DictionaryResult }
  | { ok: false; code: "disabled" | "invalid" | "busy" | "unavailable"; message: string; retryAfterSeconds?: number };
