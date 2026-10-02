// Print unresolved extraction/content doubts and generation progress.

import { LEVELS, readAllPointFiles, readComparisons } from "./bunpou-data.mjs";

async function main() {
  const files = await readAllPointFiles();
  const comparisons = await readComparisons();
  let pointCount = 0;
  let pending = 0;
  let doubts = 0;

  for (const level of LEVELS) {
    const file = files.get(level);
    let levelPending = 0;
    let levelDoubts = 0;
    for (const point of file.points) {
      pointCount += 1;
      if (!point.content || !point.ai) {
        pending += 1;
        levelPending += 1;
      }
      if (point.extract.doubt) {
        doubts += 1;
        levelDoubts += 1;
        console.log(`[${level}] ${point.key} EXTRACT: ${point.extract.doubt}`);
      }
      if (point.ai?.doubt) {
        doubts += 1;
        levelDoubts += 1;
        console.log(`[${level}] ${point.key} CONTENT: ${point.ai.doubt}`);
      }
    }
    console.log(`[${level}] ${file.points.length} point, ${levelPending} pending, ${levelDoubts} doubt`);
  }

  let comparisonPending = 0;
  let comparisonDoubts = 0;
  for (const comparison of comparisons.comparisons) {
    if (!comparison.content || !comparison.ai) comparisonPending += 1;
    if (comparison.ai?.doubt) {
      comparisonDoubts += 1;
      console.log(`[comparison] ${comparison.key}: ${comparison.ai.doubt}`);
    }
  }

  console.log(
    `[bunpou:doubts] ${pointCount} point; ${pending} pending; ${doubts} doubt; ` +
      `${comparisons.comparisons.length} comparison (${comparisonPending} pending, ${comparisonDoubts} doubt)`,
  );
}

main().catch((error) => {
  console.error("[bunpou:doubts] gagal", error);
  process.exitCode = 1;
});
