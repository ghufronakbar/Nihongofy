import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

/**
 * Seed katalog deck bawaan.
 *
 * Satu file JSON = satu deck (lihat docs/seed-flashcard.md). Idempoten by slug:
 * menjalankan ulang memperbarui deck dan note yang ada, menambah yang baru, dan
 * menghapus note yang sudah tidak ada di file — tanpa menyentuh koleksi user,
 * karena deck bawaan di-COPY saat ditambahkan, bukan dirujuk.
 */

const prisma = new PrismaClient();
const dataDir = fileURLToPath(new URL("../src/flashcard-deck-data/", import.meta.url));
const validateOnly = process.argv.includes("--validate-only");

// Harus sinkron dengan FLASHCARD_NOTE_TYPES di src/features/flashcard/note-types.ts.
const NOTE_TYPE_FIELDS = {
  BASIC: ["front", "back"],
  BASIC_REVERSED: ["front", "back"],
  VOCAB_JP: ["word", "reading", "meaning", "example", "exampleMeaning", "note"],
  KANJI: ["kanji", "onyomi", "kunyomi", "meaning", "example"],
  KANA: ["char", "romaji", "example"],
  CLOZE: ["text", "note"],
};
const REQUIRED_FIELD_INDEXES = {
  BASIC: [0, 1],
  BASIC_REVERSED: [0, 1],
  VOCAB_JP: [0, 2],
  KANJI: [0, 3],
  KANA: [0, 1],
  CLOZE: [0],
};
const JLPT_LEVELS = new Set(["N5", "N4", "N3", "N2", "N1"]);

function validateDeck(fileName, deck) {
  const errors = [];
  const fail = (message) => errors.push(`${fileName}: ${message}`);

  if (typeof deck?.slug !== "string" || !/^[a-z0-9-]{3,120}$/.test(deck.slug)) {
    fail("`slug` wajib huruf kecil/angka/strip, 3-120 karakter.");
  }
  if (typeof deck?.name !== "string" || deck.name.trim() === "") {
    fail("`name` wajib diisi.");
  } else if (deck.name.split("::").some((part) => part.trim() === "")) {
    fail("setiap bagian `name` yang dipisah :: tidak boleh kosong.");
  }
  if (typeof deck?.license !== "string" || deck.license.trim() === "") {
    // Atribusi sumber CC BY-SA mengikat; tanpa ini deck tidak boleh terbit.
    fail("`license` wajib diisi dan akan ditampilkan di UI.");
  }
  if (deck?.jlptLevel != null && !JLPT_LEVELS.has(deck.jlptLevel)) {
    fail(`\`jlptLevel\` "${deck.jlptLevel}" tidak dikenal.`);
  }

  const fields = NOTE_TYPE_FIELDS[deck?.noteType];
  if (!fields) {
    fail(`\`noteType\` "${deck?.noteType}" tidak dikenal.`);
    return errors;
  }

  if (!Array.isArray(deck.notes) || deck.notes.length === 0) {
    fail("`notes` wajib berupa array tidak kosong.");
    return errors;
  }

  const seenGuids = new Set();
  deck.notes.forEach((note, index) => {
    const at = `notes[${index}]`;
    if (typeof note?.guid !== "string" || note.guid.trim() === "" || note.guid.length > 48) {
      fail(`${at}.guid wajib diisi, maksimal 48 karakter.`);
    } else if (seenGuids.has(note.guid)) {
      fail(`${at}.guid "${note.guid}" duplikat.`);
    } else {
      seenGuids.add(note.guid);
    }

    if (!Array.isArray(note?.fields) || note.fields.length !== fields.length) {
      fail(`${at}.fields harus tepat ${fields.length} elemen (${fields.join(", ")}).`);
      return;
    }
    if (note.fields.some((value) => typeof value !== "string")) {
      fail(`${at}.fields harus berisi string semua.`);
      return;
    }
    for (const required of REQUIRED_FIELD_INDEXES[deck.noteType]) {
      if (note.fields[required].trim() === "") {
        fail(`${at}.fields[${required}] (${fields[required]}) wajib diisi.`);
      }
    }
    if (deck.noteType === "CLOZE" && !/\{\{c\d{1,3}::/.test(note.fields[0])) {
      fail(`${at}.fields[0] harus memuat minimal satu {{c1::...}}.`);
    }
    if (note.tags != null && !Array.isArray(note.tags)) {
      fail(`${at}.tags harus berupa array.`);
    }
  });

  return errors;
}

async function main() {
  const files = (await readdir(dataDir)).filter((file) => file.endsWith(".json")).sort();
  if (files.length === 0) {
    console.info("[seed:flashcard-deck] tidak ada file di src/flashcard-deck-data/");
    return;
  }

  const decks = [];
  const allErrors = [];
  const slugs = new Map();

  for (const file of files) {
    const raw = await readFile(new URL(file, `file://${dataDir}`), "utf8");
    if (raw.trim() === "") continue; // file kosong sengaja dilewati, sama seperti seed bank soal

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      allErrors.push(`${file}: JSON tidak valid — ${error.message}`);
      continue;
    }

    const errors = validateDeck(file, parsed);
    if (errors.length > 0) {
      allErrors.push(...errors);
      continue;
    }
    if (slugs.has(parsed.slug)) {
      allErrors.push(`${file}: slug "${parsed.slug}" sudah dipakai ${slugs.get(parsed.slug)}.`);
      continue;
    }
    slugs.set(parsed.slug, file);
    decks.push({ file, deck: parsed });
  }

  if (allErrors.length > 0) {
    console.error(`[seed:flashcard-deck] ${allErrors.length} error validasi:`);
    for (const error of allErrors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  const totalNotes = decks.reduce((sum, item) => sum + item.deck.notes.length, 0);
  if (validateOnly) {
    console.info(
      `[seed:flashcard-deck] valid: ${decks.length} deck, ${totalNotes} note (validate-only).`,
    );
    return;
  }

  for (const { deck } of decks) {
    const record = await prisma.flashcardSystemDeck.upsert({
      where: { slug: deck.slug },
      update: {
        name: deck.name,
        description: deck.description ?? "",
        jlptLevel: deck.jlptLevel ?? null,
        noteType: deck.noteType,
        license: deck.license,
        order: deck.order ?? 0,
        isPublished: deck.isPublished ?? true,
      },
      create: {
        slug: deck.slug,
        name: deck.name,
        description: deck.description ?? "",
        jlptLevel: deck.jlptLevel ?? null,
        noteType: deck.noteType,
        license: deck.license,
        order: deck.order ?? 0,
        isPublished: deck.isPublished ?? true,
      },
      select: { id: true },
    });

    for (const [index, note] of deck.notes.entries()) {
      await prisma.flashcardSystemNote.upsert({
        where: { deckId_guid: { deckId: record.id, guid: note.guid } },
        update: { fields: note.fields, tags: note.tags ?? [], order: note.order ?? index },
        create: {
          deckId: record.id,
          guid: note.guid,
          fields: note.fields,
          tags: note.tags ?? [],
          order: note.order ?? index,
        },
      });
    }

    // Note yang dihapus dari file ikut hilang dari katalog, supaya file benar-benar
    // menjadi sumber kebenaran.
    const removed = await prisma.flashcardSystemNote.deleteMany({
      where: { deckId: record.id, guid: { notIn: deck.notes.map((note) => note.guid) } },
    });

    console.info(
      `[seed:flashcard-deck] ${deck.slug}: ${deck.notes.length} note` +
        (removed.count > 0 ? `, ${removed.count} dihapus` : ""),
    );
  }

  console.info(`[seed:flashcard-deck] selesai: ${decks.length} deck, ${totalNotes} note.`);
}

main()
  .catch((error) => {
    console.error("[seed:flashcard-deck] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
