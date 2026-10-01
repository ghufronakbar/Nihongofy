// Daftar kata flashcard yang ditandai ragu oleh generator AI (bacaan sumber
// keliru, tulisan salah ketik, dsb.) plus peringatan yang tidak menggagalkan
// seed. Hanya membaca fixture; tidak butuh database atau API.
//
//   npm run flashcard:doubts
//   npm run flashcard:doubts -- --level N3
//
// Setelah sumbernya diperbaiki (atau diputuskan benar), generate ulang dengan:
//   npm run gen:flashcard -- --only-doubts --overwrite

import { LEVELS, readVocabFile, vocabContentWarnings } from "./flashcard-vocab.mjs";

const levelIndex = process.argv.indexOf("--level");
const onlyLevel = levelIndex === -1 ? null : process.argv[levelIndex + 1]?.toUpperCase();
if (onlyLevel && !LEVELS.includes(onlyLevel)) {
  console.error(`--level harus salah satu dari ${LEVELS.join(", ")}`);
  process.exit(1);
}

let doubts = 0;
let warnings = 0;

for (const level of LEVELS) {
  if (onlyLevel && level !== onlyLevel) continue;
  const file = await readVocabFile(level);

  for (const note of file.notes) {
    if (note.ai?.doubt) {
      doubts += 1;
      console.log(`RAGU [${level}] ${note.key} — ${note.ai.doubt}`);
    }
    if (note.content) {
      for (const warning of vocabContentWarnings(note, note.content)) {
        warnings += 1;
        console.log(`WARN [${level}] ${note.key} — ${warning}`);
      }
    }
  }
}

console.log(`\n${doubts} kata ditandai ragu, ${warnings} peringatan.`);
