import { formatAnswerTime, formatQuizDate, formatQuizDuration } from "../quiz/engine";
import { formatBabs, formatKotobaLength, getKotobaResults, groupKotobaRows, KOTOBA_WEAK_BAB_ACCURACY, kotobaLengthLimit, type KotobaQuizSession } from "./engine";

const INK = "#111111";
const BLUE = "#5294ff";
const YELLOW = "#ffd23f";
const PAPER = "#eef5ff";
const GREEN = "#d2f8e4";
const CORAL = "#ffe0df";
const AMBER = "#fff1c2";
const ORANGE = "#ffe4cc";
const MUTED = "#465064";
const FONT = '"Arial", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, "Noto Sans JP", "Noto Sans CJK JP", sans-serif';

const WIDTH = 1080;
const LEFT = 64;
const INNER = WIDTH - LEFT * 2;
const ROW_HEIGHT = 76;
const GROUP_HEIGHT = 44;
const PREVIEW_MISTAKES = 10;
/**
 * Safari menolak canvas di atas ±16,7 juta piksel (1080 × ~15.500). Laporan lengkap dibatasi
 * sejumlah baris ini (sudah termasuk ruang judul untuk 25 bab); selebihnya dipersingkat menjadi
 * kata yang perlu diulang saja.
 */
export const KOTOBA_REPORT_MAX_ROWS = 160;

export type KotobaImageKind = "summary" | "full";
type KotobaResult = ReturnType<typeof getKotobaResults>;
type KotobaRow = KotobaResult["rows"][number];

/**
 * Baris yang masuk laporan lengkap. Semua kata bila muat; bila tidak, hanya kata yang perlu
 * diulang (dipotong di batas) supaya informasi untuk pengajar tetap utuh sebisa mungkin.
 */
export function selectKotobaReportRows(result: KotobaResult, maxRows = KOTOBA_REPORT_MAX_ROWS) {
  // Diurutkan per bab lebih dulu supaya bila dipotong, yang hilang adalah bab terakhir secara utuh.
  const byBab = (rows: readonly KotobaRow[]) => groupKotobaRows(rows).flatMap((group) => group.rows);
  if (result.rows.length <= maxRows) return { rows: byBab(result.rows), mistakesOnly: false, hidden: 0 };
  const rows = byBab(result.mistakes).slice(0, maxRows);
  return { rows, mistakesOnly: true, hidden: result.mistakes.length - rows.length };
}

export function kotobaReportLabels(session: KotobaQuizSession): string[] {
  return [
    formatBabs(session.babs),
    session.front === "kanji" ? "Depan kanji" : "Depan kana",
    session.mode === "flip" ? "Balik kartu" : "4 pilihan",
    ...(kotobaLengthLimit(session.length)?.perBab ? [formatKotobaLength(session.length)] : []),
    ...(session.scope === "inti" ? ["Kata inti"] : []),
    ...(session.timeLimit === null ? [] : [`Timer ${session.timeLimit} dtk`]),
  ];
}

export function kotobaRowVerdict(session: KotobaQuizSession, row: KotobaRow): string {
  if (row.timedOut) return "Waktu habis";
  if (row.skipped) return "Dilewati";
  if (row.correct) return "Benar";
  return session.mode === "flip" || !row.selected ? "Salah" : `Salah: ${row.selected.meaning}`;
}

export function kotobaImageFileName(session: KotobaQuizSession, kind: KotobaImageKind): string {
  const safeNickname = session.nickname.replace(/[^\p{L}\p{N}_-]/gu, "_").slice(0, 40) || "siswa";
  const babs = session.babs.length === 1 ? `bab-${session.babs[0]}` : `${session.babs.length}-bab`;
  return `tebak-kotoba-${babs}-${safeNickname}-${kind === "summary" ? "ringkasan" : "laporan"}.png`;
}

export async function createKotobaImage(session: KotobaQuizSession, kind: KotobaImageKind, quizUrl: string): Promise<File> {
  if (session.finishedAt === null) throw new Error("Selesaikan quiz terlebih dahulu.");
  await document.fonts.ready;
  const result = getKotobaResults(session);
  const flip = session.mode === "flip";
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser belum mendukung ekspor gambar.");
  const ctx = context;

  function setFont(size: number, weight: number) {
    ctx.font = `${weight} ${size}px ${FONT}`;
  }

  function text(value: string, x: number, y: number, size = 28, weight = 600, color = INK) {
    setFont(size, weight);
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }

  /** Memecah teks per kata (atau per karakter untuk kata yang terlalu panjang), maksimal `maxLines`. */
  function lines(value: string, maxWidth: number, size: number, weight: number, maxLines = Infinity): string[] {
    setFont(size, weight);
    const result: string[] = [];
    let line = "";
    const push = () => { result.push(line.trimEnd()); line = ""; };
    for (const token of value.split(/(\s+)/)) {
      if (!token || (!line && /^\s+$/.test(token))) continue;
      if (ctx.measureText(line + token).width <= maxWidth) { line += token; continue; }
      if (/^\s+$/.test(token)) { push(); continue; }
      if (line.trim()) push();
      if (ctx.measureText(token).width <= maxWidth) { line = token; continue; }
      for (const char of Array.from(token)) {
        if (ctx.measureText(line + char).width > maxWidth && line) push();
        line += char;
      }
    }
    if (line.trim()) push();
    if (result.length <= maxLines) return result;
    const kept = result.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = Array.from(last).slice(0, -1).join("");
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }

  /** Mengecilkan font sampai teks muat dalam satu baris, lalu memotongnya bila masih kepanjangan. */
  function fitted(value: string, maxWidth: number, size: number, minSize: number, weight: number): { value: string; size: number } {
    let current = size;
    setFont(current, weight);
    while (current > minSize && ctx.measureText(value).width > maxWidth) setFont(--current, weight);
    return { value: lines(value, maxWidth, current, weight, 1)[0] ?? "", size: current };
  }

  function panel(x: number, y: number, width: number, height: number, color: string, shadow = false) {
    if (shadow) { ctx.fillStyle = INK; ctx.fillRect(x + 8, y + 8, width, height); }
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
  }

  // Ukur bagian dengan tinggi dinamis lebih dulu; mengubah ukuran canvas mengosongkan isinya.
  const nicknameLines = lines(session.nickname, INNER, 46, 800, 2);
  const labelLines = lines(kotobaReportLabels(session).join("  ·  "), INNER, 23, 800, 3);
  const stats: [string, string][] = [
    ["TOTAL WAKTU", formatQuizDuration(result.totalMs)],
    ["RATA-RATA", formatAnswerTime(result.averageMs)],
    ["SALAH", `${result.wrongCount} kata`],
    ...(flip ? [] : [["DILEWATI", `${result.skippedCount} kata`] as [string, string]]),
    ...(session.timeLimit === null ? [] : [["WAKTU HABIS", `${result.timedOutCount} kata`] as [string, string]]),
  ];
  const grouped = result.byBab.length > 1;
  const babStats = new Map(result.byBab.map((item) => [item.bab, item]));
  const babRows = grouped ? Math.ceil(result.byBab.length / 5) : 0;
  const preview = groupKotobaRows(result.mistakes).flatMap((group) => group.rows).slice(0, PREVIEW_MISTAKES);
  const report = selectKotobaReportRows(result);
  const reportGroups = grouped ? groupKotobaRows(report.rows) : [{ bab: null, rows: report.rows }];

  const nameY = 282;
  const labelsY = nameY + (nicknameLines.length - 1) * 54 + 52;
  const dateY = labelsY + (labelLines.length - 1) * 32 + 44;
  const scoreY = dateY + 40;
  const statsY = scoreY + 186 + 62;
  const bodyY = statsY + 80;
  const babHeight = babRows ? 52 + babRows * 96 : 0;
  const footerHeight = 96;
  const summaryBody = babHeight + 60 + (preview.length ? Math.ceil(preview.length / 2) * 92 + (result.mistakes.length > preview.length ? 40 : 0) : 50);
  const groupHeaders = reportGroups.filter((group) => group.bab !== null).length * GROUP_HEIGHT;
  const fullBody = (report.mistakesOnly ? 44 : 0) + 52 + groupHeaders + Math.max(1, report.rows.length) * ROW_HEIGHT + (report.hidden ? 44 : 0);
  canvas.width = WIDTH;
  canvas.height = bodyY + (kind === "summary" ? summaryBody : fullBody) + footerHeight;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#dce5f2";
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }

  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, WIDTH, 166);
  text("NIHONGOFY / KANA LAB", LEFT, 56, 23, 800);
  text("TEBAK KOTOBA", LEFT, 122, 52, 900);
  text(kind === "summary" ? "HASIL TEBAK KOTOBA" : "LAPORAN LENGKAP", LEFT, 224, 21, 800);
  nicknameLines.forEach((line, index) => text(line, LEFT, nameY + index * 54, 46, 800));
  labelLines.forEach((line, index) => text(line, LEFT, labelsY + index * 32, 23, 800));
  text(formatQuizDate(session.finishedAt), LEFT, dateY, 25, 500, MUTED);

  panel(LEFT, scoreY, INNER, 186, "#ffffff", true);
  text(`${result.correctCount}`, 90, scoreY + 130, 108, 900);
  setFont(108, 900);
  const scoreWidth = ctx.measureText(`${result.correctCount}`).width;
  text(`/ ${result.total}`, 100 + scoreWidth, scoreY + 128, 47, 700);
  text(flip ? "DITANDAI BENAR" : "JAWABAN BENAR", 92, scoreY + 163, 18, 800);
  ctx.textAlign = "right";
  text(`${result.accuracy}%`, LEFT + INNER - 28, scoreY + 108, 66, 900);
  text("AKURASI", LEFT + INNER - 28, scoreY + 151, 20, 700);
  ctx.textAlign = "left";

  const statWidth = INNER / stats.length;
  stats.forEach(([label, value], index) => {
    const x = LEFT + index * statWidth;
    text(label, x, statsY, 19, 800);
    const fit = fitted(value, statWidth - 16, 36, 22, 800);
    text(fit.value, x, statsY + 46, fit.size, 800);
  });

  let y = bodyY;
  if (kind === "summary") {
    if (babRows) {
      text("PER BAB", LEFT, y + 24, 25, 900);
      result.byBab.forEach((item, index) => {
        const x = LEFT + (index % 5) * 192;
        const top = y + 44 + Math.floor(index / 5) * 96;
        panel(x, top, 184, 84, item.correct === item.total ? GREEN : item.accuracy < KOTOBA_WEAK_BAB_ACCURACY ? CORAL : "#ffffff");
        text(`BAB ${item.bab}`, x + 16, top + 30, 18, 800);
        ctx.textAlign = "right";
        text(`${item.accuracy}%`, x + 168, top + 30, 18, 800, MUTED);
        ctx.textAlign = "left";
        text(`${item.correct} / ${item.total}`, x + 16, top + 68, 30, 900);
      });
      y += babHeight;
    }
    text(`KATA YANG PERLU DIULANG (${result.mistakes.length})`, LEFT, y + 30, 25, 900);
    y += 60;
    if (!preview.length) text("Semua kata benar. Hebat!", LEFT, y + 32, 28, 700);
    preview.forEach((row, index) => {
      const x = LEFT + (index % 2) * (INNER / 2 + 8);
      const top = y + Math.floor(index / 2) * 92;
      const width = INNER / 2 - 8;
      panel(x, top, width, 82, row.timedOut ? ORANGE : row.skipped ? AMBER : CORAL);
      if (grouped) {
        ctx.textAlign = "right";
        text(`BAB ${row.entry.bab}`, x + width - 14, top + 26, 15, 800, MUTED);
        ctx.textAlign = "left";
      }
      const word = fitted(row.entry.kanji ? `${row.entry.kana}  ${row.entry.kanji}` : row.entry.kana, width - (grouped ? 112 : 32), 30, 18, 700);
      text(word.value, x + 16, top + 38, word.size, 700);
      text(lines(row.entry.meaning, width - 32, 20, 700, 1)[0] ?? "", x + 16, top + 68, 20, 700, MUTED);
    });
    if (result.mistakes.length > preview.length) {
      const more = result.mistakes.length - preview.length;
      text(report.hidden ? `+${more} kata lagi (${report.rows.length} pertama ada di laporan lengkap).` : `+${more} kata lagi ada di laporan lengkap.`, LEFT, y + Math.ceil(preview.length / 2) * 92 + 26, 22, 600, MUTED);
    }
  } else {
    if (report.mistakesOnly) {
      text(`Daftar dipersingkat: ${result.rows.length} kata terlalu banyak untuk satu gambar, jadi hanya kata yang perlu diulang.`, LEFT, y + 26, 20, 600, MUTED);
      y += 44;
    }
    const columns = { number: 80, word: 136, meaning: 432, verdict: 700, time: LEFT + INNER - 16 };
    panel(LEFT, y, INNER, 52, BLUE);
    text("NO.", columns.number, y + 34, 20, 800);
    text("KATA", columns.word, y + 34, 20, 800);
    text("ARTI", columns.meaning, y + 34, 20, 800);
    text(flip ? "PENILAIANMU" : "JAWABANMU", columns.verdict, y + 34, 20, 800);
    ctx.textAlign = "right";
    text("WAKTU", columns.time, y + 34, 20, 800);
    ctx.textAlign = "left";
    y += 52;
    if (!report.rows.length) text("Semua kata benar.", columns.word, y + 46, 26, 700);
    let index = 0;
    for (const group of reportGroups) {
      const stats = group.bab === null ? undefined : babStats.get(group.bab);
      if (stats) {
        ctx.fillStyle = stats.correct === stats.total ? GREEN : stats.accuracy < KOTOBA_WEAK_BAB_ACCURACY ? CORAL : YELLOW;
        ctx.fillRect(LEFT, y, INNER, GROUP_HEIGHT);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(LEFT, y + GROUP_HEIGHT); ctx.lineTo(LEFT + INNER, y + GROUP_HEIGHT); ctx.stroke();
        text(`BAB ${stats.bab}`, columns.number, y + 30, 22, 900);
        ctx.textAlign = "right";
        text(`${stats.correct} / ${stats.total} benar · ${stats.accuracy}% · ${stats.mistakes.length ? `${stats.mistakes.length} perlu diulang` : "semua benar"}`, columns.time, y + 30, 19, 800);
        ctx.textAlign = "left";
        y += GROUP_HEIGHT;
      }
      for (const row of group.rows) {
        const top = y;
        y += ROW_HEIGHT;
        ctx.fillStyle = row.correct ? (index % 2 ? "#f5fbff" : "#ffffff") : row.timedOut ? ORANGE : row.skipped ? AMBER : CORAL;
        ctx.fillRect(LEFT, top, INNER, ROW_HEIGHT);
        ctx.strokeStyle = "#c9d4e1";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(LEFT, top + ROW_HEIGHT); ctx.lineTo(LEFT + INNER, top + ROW_HEIGHT); ctx.stroke();
        text(String(row.number).padStart(2, "0"), columns.number, top + 36, 21, 500, MUTED);
        const kana = fitted(row.entry.kana, 280, 28, 16, 700);
        text(kana.value, columns.word, row.entry.kanji ? top + 34 : top + 46, kana.size, 700);
        if (row.entry.kanji) text(fitted(row.entry.kanji, 280, 19, 14, 500).value, columns.word, top + 62, 19, 500, MUTED);
        lines(row.entry.meaning, 250, 20, 700, 2).forEach((line, lineIndex) => text(line, columns.meaning, top + 32 + lineIndex * 26, 20, 700));
        lines(kotobaRowVerdict(session, row), 200, 20, 800, 2).forEach((line, lineIndex) => text(line, columns.verdict, top + 32 + lineIndex * 26, 20, 800));
        ctx.textAlign = "right";
        text(formatAnswerTime(row.elapsedMs), columns.time, top + 36, 21, 500);
        ctx.textAlign = "left";
        index++;
      }
    }
    if (!report.rows.length) y += ROW_HEIGHT;
    if (report.hidden) text(`+${report.hidden} kata lain yang perlu diulang tidak muat di gambar ini.`, LEFT, y + 30, 20, 600, MUTED);
  }

  // Laporan dibuat di perangkat; tidak ada data hasil yang disematkan di URL.
  const footerY = canvas.height - footerHeight;
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, footerY + 24, WIDTH, 4);
  text(`${new URL(quizUrl).host}/kana/kotoba`, LEFT, footerY + 62, 20, 800);
  ctx.textAlign = "right";
  text(flip ? "Waktu dihitung sampai kartu dibalik." : "Waktu dihitung sampai arti dipilih.", LEFT + INNER, footerY + 62, 18, 500, MUTED);
  ctx.textAlign = "left";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Gambar gagal dibuat. Coba lagi.")), "image/png");
  });
  return new File([blob], kotobaImageFileName(session, kind), { type: "image/png" });
}

export { downloadQuizImage as downloadKotobaImage } from "../quiz/image-export";
