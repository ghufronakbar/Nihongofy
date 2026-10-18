/** Offline import only. Runtime never downloads or parses the source archive. */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { unzipSync } from "fflate";
import { z } from "zod";
import { DICTIONARY_SOURCE } from "../src/constants/dictionary";
import { dictionaryManifestSchema, dictionaryTermsSchema, jmdictWordSchema, normalizeDictionaryQuery,
  type DictionaryRecord } from "../src/features/dictionary/schemas";
import { entryBucket, termBucket } from "../src/features/dictionary/index-format";

const PINNED_URL = "https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261012204142/jmdict-eng-3.6.2%2B20261012204142.json.zip";
const PINNED_SHA256 = "9a04fc1d0facf87645f8ec7cdaa370647d4a8f59131f6e2a614bcd680f855b85";
async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const sourcePath = path.resolve(option("source") ?? "data/sources/dictionary/jmdict-eng-3.6.2+20261012204142.json.zip");
  const sourceUrl = z.url().parse(option("url") ?? PINNED_URL);
  const expectedHash = option("sha256") ?? PINNED_SHA256;
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error("--sha256 must be the verified source archive SHA-256.");
  const output = path.resolve(option("output") ?? "assets/dictionary");
  // Protect source and unrelated project folders from the atomic directory swap.
  if (output === process.cwd() || output === path.parse(output).root || path.dirname(output) === output ||
    !path.basename(output).includes("dictionary")) throw new Error("Output must be a dedicated dictionary directory.");

  if (args.includes("--download")) {
    if (new URL(sourceUrl).protocol !== "https:") throw new Error("Use an HTTPS release archive.");
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Source download failed (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 30 * 1024 * 1024) throw new Error("Unexpected archive size.");
    if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("Source checksum mismatch; existing index unchanged.");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, bytes);
  }
  const archive = await readFile(sourcePath);
  const sourceSha256 = createHash("sha256").update(archive).digest("hex");
  if (sourceSha256 !== expectedHash) throw new Error("Source checksum mismatch; existing index unchanged.");
  const files = unzipSync(archive);
  const jsonFiles = Object.keys(files).filter((name) => name.endsWith(".json"));
  if (jsonFiles.length !== 1) throw new Error("Expected one full-English JMdict JSON document.");
  const raw: unknown = JSON.parse(new TextDecoder().decode(files[jsonFiles[0]]));
  const source = z.object({
    version: z.string(), dictDate: z.iso.date(), commonOnly: z.literal(false),
    languages: z.tuple([z.literal("eng")]), tags: z.record(z.string(), z.string()), words: z.array(z.unknown()),
  }).parse(raw);
  if (source.words.length < 200_000) throw new Error("Full JMdict English expected (at least 200,000 entries).");

  const entries = new Map<string, Map<string, DictionaryRecord>>();
  const terms = new Map<string, { id: string; common: boolean }[]>();
  for (const word of source.words) {
    const parsed = jmdictWordSchema.parse(word);
    const record: DictionaryRecord = { ...parsed, sense: parsed.sense.map((sense) => ({ ...sense,
      gloss: sense.gloss.map((gloss) => [gloss.text, gloss.type && `(${gloss.type})`, gloss.gender && `(${gloss.gender})`].filter(Boolean).join(" ")),
    })) };
    const bucket = entryBucket(record.id);
    if (!entries.has(bucket)) entries.set(bucket, new Map());
    if (entries.get(bucket)!.has(record.id)) throw new Error("Duplicate JMdict entry ID.");
    entries.get(bucket)!.set(record.id, record);
    const spellings = new Map<string, boolean>();
    for (const form of [...record.kanji, ...record.kana]) {
      const term = normalizeDictionaryQuery(form.text);
      spellings.set(term, (spellings.get(term) ?? false) || form.common);
    }
    for (const [term, common] of spellings) {
      if (!terms.has(term)) terms.set(term, []);
      terms.get(term)!.push({ id: record.id, common });
    }
  }
  const termShards = new Map<string, Map<string, string[]>>();
  for (const [term, posting] of terms) {
    const bucket = termBucket(term);
    if (!termShards.has(bucket)) termShards.set(bucket, new Map());
    termShards.get(bucket)!.set(term, posting.sort((a, b) => Number(b.common) - Number(a.common) || Number(a.id) - Number(b.id)).map((item) => item.id));
  }

  const version = `eng-${source.version}+${source.dictDate.replaceAll("-", "")}-f1-${sourceSha256.slice(0, 12)}`;
  const manifest = dictionaryManifestSchema.parse({ format: 1, version, language: "eng", commonOnly: false,
    sourceDate: source.dictDate, sourceUrl, sourceSha256, converterVersion: source.version,
    licence: DICTIONARY_SOURCE.licenceId, entryCount: source.words.length, termCount: terms.size, tags: source.tags, files: {} });
  const staging = `${output}.staging-${process.pid}`;
  let compressedBytes = 0;
  let uncompressedBytes = 0;
  try {
    await mkdir(staging, { recursive: false });
    for (const [kind, shards] of [["entries", entries], ["terms", termShards]] as const) {
      await mkdir(path.join(staging, kind));
      for (const [bucket, items] of [...shards].sort(([a], [b]) => a.localeCompare(b))) {
        const data = Object.fromEntries([...items].sort(([a], [b]) => a.localeCompare(b)));
        if (kind === "terms") dictionaryTermsSchema.parse(data);
        const json = Buffer.from(JSON.stringify(data));
        const compressed = gzipSync(json, { level: 9 });
        const file = `${kind}/${bucket}.json.gz`;
        manifest.files[file] = { bytes: compressed.length, sha256: createHash("sha256").update(compressed).digest("hex") };
        compressedBytes += compressed.length;
        uncompressedBytes += json.length;
        await writeFile(path.join(staging, file), compressed);
      }
    }
    // Hashes cover every shard; the manifest is written last before publication.
    await writeFile(path.join(staging, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    await writeFile(path.join(staging, "NOTICE.md"), `# JMdict English derived index\n\nCopyright EDRDG contributors. ${DICTIONARY_SOURCE.licenceId}.\n\nSource: ${DICTIONARY_SOURCE.url}\nLicence: ${DICTIONARY_SOURCE.licence}\nConverter: ${DICTIONARY_SOURCE.converter}\n\nSource release: ${sourceUrl}\nSource date: ${source.dictDate}\nSource archive SHA-256: ${sourceSha256}\n\nChanges: English glosses retained, references/examples omitted, spellings indexed with NFKC, entries and postings split into gzip shards. Ejaan–bacaan–sense restrictions and usage labels are retained.\n\nThis data is distributed under CC BY-SA 4.0, separately from application code. Rebuild with scripts/dictionary-import.ts and distribute manifest, NOTICE and all shards together.\n`);
    const backup = `${output}.previous-${process.pid}`;
    const exists = await stat(output).then(() => true, () => false);
    if (exists) await rename(output, backup);
    try { await rename(staging, output); }
    catch (error) { if (exists) await rename(backup, output); throw error; }
    if (exists) await rm(backup, { recursive: true });
    console.log(JSON.stringify({ version, entries: manifest.entryCount, terms: terms.size, shards: Object.keys(manifest.files).length,
      compressedBytes, uncompressedBytes, output }, null, 2));
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
