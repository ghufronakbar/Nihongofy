import { DICTIONARY_LIMITS } from "@/constants/dictionary";
import { candidateMatchesPos, dictionaryCandidates, type DictionaryCandidate } from "./deinflect";
import { normalizeDictionaryQuery, type DictionaryRecord } from "./schemas";
import type { DictionaryHit, DictionaryResult } from "./types";

export type DictionaryReader = {
  version: string;
  sourceDate: string;
  tags: Record<string, string>;
  findTerms(terms: string[]): Promise<Map<string, string[]>>;
  readEntries(ids: string[]): Promise<DictionaryRecord[]>;
};

function permits(restrictions: string[], value: string | null) {
  return restrictions.includes("*") || (value !== null && restrictions.includes(value));
}

function hitsFor(record: DictionaryRecord, candidate: DictionaryCandidate, tags: Record<string, string>): DictionaryHit[] {
  const label = (tag: string) => tags[tag] ?? tag;
  const kanjiMatches = record.kanji.filter((k) => normalizeDictionaryQuery(k.text) === candidate.term);
  const kanaMatches = record.kana.filter((k) => normalizeDictionaryQuery(k.text) === candidate.term);
  const readings = kanjiMatches.length ? record.kana : kanaMatches;
  const hits: DictionaryHit[] = [];
  for (const reading of readings) {
    const allowedKanji = record.kanji.filter((k) => permits(reading.appliesToKanji, k.text));
    const preferKana = reading.common && !allowedKanji.some((k) => k.common) && record.sense.some((sense) =>
      sense.appliesToKanji.includes("*") && permits(sense.appliesToKana, reading.text));
    const spellings = kanjiMatches.length ? kanjiMatches.filter((k) => permits(reading.appliesToKanji, k.text)) : preferKana ? [] :
      allowedKanji.toSorted((a, b) => Number(b.common) - Number(a.common)).slice(0, 1);
    // [] in appliesToKanji is a kana-only reading, NOT a wildcard.
    const words = spellings.length ? spellings : kanjiMatches.length ? [] : [null];
    for (const spelling of words) {
      const word = spelling?.text ?? reading.text;
      const senses = record.sense.filter((sense) =>
        permits(sense.appliesToKanji, spelling?.text ?? null) && permits(sense.appliesToKana, reading.text) &&
        candidateMatchesPos(candidate, sense.partOfSpeech));
      if (!senses.length) continue;
      hits.push({
        id: `${record.id}:${word}:${reading.text}`,
        word, reading: reading.text,
        common: spelling ? spelling.common && reading.common : reading.common,
        formLabels: [...new Set([...(spelling?.tags ?? []), ...reading.tags])].map(label),
        senses: senses.slice(0, DICTIONARY_LIMITS.senses).map((sense) => ({
          glosses: sense.gloss,
          partsOfSpeech: sense.partOfSpeech.map(label),
          labels: [...sense.field, ...sense.dialect, ...sense.misc].map(label),
          notes: sense.info,
        })),
        sensesTruncated: senses.length > DICTIONARY_LIMITS.senses,
        match: candidate.kana ? "kana" : candidate.reasons.length ? "deinflected" : "exact",
        reasons: candidate.reasons,
      });
    }
  }
  return hits;
}

export async function lookupDictionary(query: string, reader: DictionaryReader): Promise<DictionaryResult> {
  const candidates = dictionaryCandidates(query);
  const postings = await reader.findTerms([...new Set(candidates.map((candidate) => candidate.term))]);
  // Per-term postings are common-first. Cap entry reads independently of client
  // input and candidate count, even for highly ambiguous one-character queries.
  const ids = [...new Set(candidates.flatMap((candidate) => postings.get(candidate.term) ?? []))].slice(0, 160);
  const records = new Map((await reader.readEntries(ids)).map((record) => [record.id, record]));
  const found = new Map<string, DictionaryHit>();
  for (const candidate of candidates) {
    for (const id of postings.get(candidate.term) ?? []) {
      const record = records.get(id);
      if (!record) continue;
      for (const hit of hitsFor(record, candidate, reader.tags)) if (!found.has(hit.id)) found.set(hit.id, hit);
    }
  }
  const rank = (hit: DictionaryHit) => ({ exact: 0, deinflected: 1, kana: 2 })[hit.match];
  const ordered = [...found.values()].sort((a, b) => rank(a) - rank(b) || a.reasons.length - b.reasons.length || Number(b.common) - Number(a.common));
  const hits = ordered.slice(0, DICTIONARY_LIMITS.results);
  const result: DictionaryResult = { query, language: "eng", version: reader.version, sourceDate: reader.sourceDate,
    hits, truncated: ordered.length > hits.length || ids.length === 160 };
  // Never serialize an unbounded entry. Preserve complete senses; remove from
  // the tail with an explicit truncation signal if the response budget is hit.
  while (new TextEncoder().encode(JSON.stringify(result)).length > DICTIONARY_LIMITS.responseBytes) {
    const last = hits.at(-1);
    if (!last) break;
    if (last.senses.length > 1) { last.senses.pop(); last.sensesTruncated = true; }
    else { hits.pop(); result.truncated = true; }
  }
  return result;
}
