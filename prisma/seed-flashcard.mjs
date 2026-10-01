// Seed katalog flashcard: fixture src/flashcard-data/ -> database.
//
//   npm run seed:flashcard:check   # validasi saja, tanpa database
//   npm run seed:flashcard
//
// - Deck bawaan dibentuk dari tag taxonomy yang bertanda `deck: true`. Deck
//   yang sudah tidak ada di taxonomy disembunyikan, tidak dihapus: langganan
//   user masih merujuknya.
// - Hanya kata yang sudah digenerate AI (`content` + `ai` terisi) yang
//   diterbitkan. Kata yang belum digenerate dilewati dan dilaporkan.
// - Kata yang hilang dari fixture, atau dipensiunkan sebagai duplikat oleh
//   fix:flashcard-doubts, diberi `retiredAt`, TIDAK dihapus: kartu dan
//   riwayat belajar user merujuk kata itu.
//
// Idempoten: menjalankan ulang memperbarui isi kata yang berubah.

import { PrismaClient } from "@prisma/client";
import {
  isRetiredNote,
  LEVELS,
  loadTaxonomy,
  readVocabFile,
  toVocabRow,
  vocabContentProblems,
  vocabContentWarnings,
} from "./flashcard-vocab.mjs";

const validateOnly = process.argv.includes("--validate-only");
const CHUNK_SIZE = 500;

function log(message) {
  console.log(`[seed:flashcard] ${message}`);
}

// Satu query per potongan, bukan satu upsert per kata: ribuan round trip lewat
// pooler Supabase akan memakan waktu belasan menit.
const UPSERT_VOCAB = `
INSERT INTO "FlashcardVocab" (
  "key", "level", "order", "word", "wordPlain", "reading", "meaningsId", "meaningsEn",
  "examples", "notes", "tags", "aiModel", "promptVersion", "generatedAt", "retiredAt", "updatedAt"
)
SELECT
  x."key", x."level"::"JlptLevel", x."order", x."word", x."wordPlain", x."reading",
  x."meaningsId", x."meaningsEn", x."examples", x."notes", x."tags", x."aiModel",
  x."promptVersion", (x."generatedAt"::timestamptz AT TIME ZONE 'UTC'), NULL,
  (now() AT TIME ZONE 'UTC')
FROM jsonb_to_recordset($1::jsonb) AS x(
  "key" text, "level" text, "order" int, "word" text, "wordPlain" text, "reading" text,
  "meaningsId" text[], "meaningsEn" text[], "examples" jsonb, "notes" text, "tags" text[],
  "aiModel" text, "promptVersion" text, "generatedAt" text
)
ON CONFLICT ("key") DO UPDATE SET
  "level" = EXCLUDED."level",
  "order" = EXCLUDED."order",
  "word" = EXCLUDED."word",
  "wordPlain" = EXCLUDED."wordPlain",
  "reading" = EXCLUDED."reading",
  "meaningsId" = EXCLUDED."meaningsId",
  "meaningsEn" = EXCLUDED."meaningsEn",
  "examples" = EXCLUDED."examples",
  "notes" = EXCLUDED."notes",
  "tags" = EXCLUDED."tags",
  "aiModel" = EXCLUDED."aiModel",
  "promptVersion" = EXCLUDED."promptVersion",
  "generatedAt" = EXCLUDED."generatedAt",
  "retiredAt" = NULL,
  "updatedAt" = EXCLUDED."updatedAt"
`;

const RETIRE_MISSING = `
UPDATE "FlashcardVocab"
SET "retiredAt" = (now() AT TIME ZONE 'UTC'), "updatedAt" = (now() AT TIME ZONE 'UTC')
WHERE "retiredAt" IS NULL AND NOT ("key" = ANY($1::text[]))
`;

async function collect(taxonomy) {
  const rows = [];
  const errors = [];
  const warnings = [];
  const pendingByLevel = new Map();
  const seenKeys = new Map();

  for (const level of LEVELS) {
    const file = await readVocabFile(level);
    let pending = 0;

    for (const note of file.notes) {
      const where = `${level} ${note.key}`;
      if (seenKeys.has(note.key)) {
        errors.push(`${where}: key ganda (juga ada di ${seenKeys.get(note.key)})`);
        continue;
      }
      seenKeys.set(note.key, level);

      if (isRetiredNote(note)) continue;
      if (!note.content || !note.ai) {
        if (note.content || note.ai) errors.push(`${where}: content dan ai harus terisi bersama`);
        pending += 1;
        continue;
      }

      const problems = vocabContentProblems(note, note.content, taxonomy, { doubt: note.ai.doubt });
      if (problems.length > 0) {
        errors.push(`${where}: ${problems.join("; ")}`);
        continue;
      }
      for (const warning of vocabContentWarnings(note, note.content)) warnings.push(`${where}: ${warning}`);
      rows.push(toVocabRow(level, note));
    }
    pendingByLevel.set(level, pending);
  }

  return { rows, errors, warnings, pendingByLevel };
}

function deckDefinitions(taxonomy) {
  return taxonomy.tags
    .filter((tag) => tag.deck)
    .map((tag, index) => ({
      slug: tag.slug,
      kind: taxonomy.dimensionById.get(tag.dimension).deckKind,
      name: tag.deckName ?? tag.label,
      nameJa: tag.labelJa,
      description: tag.description,
      order: index,
    }));
}

async function main() {
  const taxonomy = await loadTaxonomy();
  const { rows, errors, warnings, pendingByLevel } = await collect(taxonomy);
  const decks = deckDefinitions(taxonomy);

  for (const level of LEVELS) {
    const published = rows.filter((row) => row.level === level).length;
    log(`${level}: ${published} kata siap terbit, ${pendingByLevel.get(level)} belum digenerate`);
  }

  const counts = new Map(decks.map((deck) => [deck.slug, 0]));
  for (const row of rows) {
    for (const tag of row.tags) if (counts.has(tag)) counts.set(tag, counts.get(tag) + 1);
  }
  const hidden = decks.filter((deck) => counts.get(deck.slug) < taxonomy.deckMinNotes);
  log(
    `${decks.length} deck bawaan; ${decks.length - hidden.length} tampil, ` +
      `${hidden.length} disembunyikan karena kurang dari ${taxonomy.deckMinNotes} kata`,
  );

  if (warnings.length > 0) {
    log(`${warnings.length} peringatan (tidak menggagalkan seed):`);
    for (const warning of warnings.slice(0, 20)) log(`  WARN ${warning}`);
  }
  if (errors.length > 0) {
    console.error(`[seed:flashcard] ${errors.length} error validasi:`);
    for (const error of errors.slice(0, 50)) console.error(`  - ${error}`);
    if (errors.length > 50) console.error(`  ... dan ${errors.length - 50} lainnya`);
    process.exitCode = 1;
    return;
  }

  if (validateOnly) {
    log(`valid: ${rows.length} kata (validate-only, database tidak disentuh).`);
    return;
  }

  const prisma = new PrismaClient();
  try {
    for (const deck of decks) {
      await prisma.flashcardDeck.upsert({
        where: { slug: deck.slug },
        update: { ...deck, isPublished: true },
        create: { ...deck, isPublished: true },
      });
    }
    const unpublished = await prisma.flashcardDeck.updateMany({
      where: { slug: { notIn: decks.map((deck) => deck.slug) }, isPublished: true },
      data: { isPublished: false },
    });

    for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
      await prisma.$executeRawUnsafe(UPSERT_VOCAB, JSON.stringify(rows.slice(index, index + CHUNK_SIZE)));
    }

    // Selalu dijalankan setelah semua upsert berhasil. Dengan fixture yang
    // belum digenerate sama sekali, semua kata katalog akan dipensiunkan —
    // itu memang isi fixture saat itu.
    const retired = await prisma.$executeRawUnsafe(RETIRE_MISSING, rows.map((row) => row.key));

    log(
      `selesai: ${decks.length} deck (${unpublished.count} deck lama disembunyikan), ` +
        `${rows.length} kata terbit, ${retired} kata dipensiunkan.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed:flashcard] gagal", error);
  process.exitCode = 1;
});
