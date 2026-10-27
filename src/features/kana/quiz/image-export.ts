import { formatAnswerTime, formatQuizDate, formatQuizDuration, getQuizResults, QUIZ_LENGTH, type QuizSession } from "./engine";

const INK = "#111111";
const BLUE = "#5294ff";
const PAPER = "#eef5ff";
const GREEN = "#d2f8e4";
const CORAL = "#ffe0df";
const FONT = '"Arial", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif';

export type QuizImageKind = "summary" | "full";

export async function createQuizImage(session: QuizSession, kind: QuizImageKind, quizUrl: string): Promise<File> {
  if (session.finishedAt === null) throw new Error("Selesaikan quiz terlebih dahulu.");
  await document.fonts.ready;
  const result = getQuizResults(session);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = kind === "summary" ? 1470 : 860 + QUIZ_LENGTH * 58;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser belum mendukung ekspor gambar.");
  const ctx = context;

  function text(value: string, x: number, y: number, size = 28, weight = 600, color = INK) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }

  function panel(x: number, y: number, width: number, height: number, color: string, shadow = false) {
    if (shadow) { ctx.fillStyle = INK; ctx.fillRect(x + 8, y + 8, width, height); }
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
  }

  function wrap(value: string, x: number, y: number, maxWidth: number, size: number, lineHeight: number) {
    ctx.font = `800 ${size}px ${FONT}`;
    let line = "";
    let baseline = y;
    for (const char of Array.from(value)) {
      if (ctx.measureText(line + char).width > maxWidth && line) {
        text(line, x, baseline, size, 800);
        line = char;
        baseline += lineHeight;
      } else line += char;
    }
    text(line, x, baseline, size, 800);
  }

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#dce5f2";
  ctx.lineWidth = 1;
  for (let x = 0; x < 1080; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); }

  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, 1080, 166);
  text("NIHONGOFY / KANA LAB", 64, 56, 23, 800);
  text(`QUIZ ${session.script.toUpperCase()}`, 64, 122, 52, 900);
  text(kind === "summary" ? "HASIL QUIZ" : "LAPORAN LENGKAP", 64, 224, 21, 800);
  wrap(session.nickname, 64, 282, 952, 46, 52);
  text(formatQuizDate(session.finishedAt), 64, 376, 25, 500, "#465064");

  panel(64, 412, 952, 186, "#ffffff", true);
  text(`${result.correctCount}`, 90, 542, 108, 900);
  const scoreWidth = ctx.measureText(`${result.correctCount}`).width;
  text(`/ ${QUIZ_LENGTH}`, 100 + scoreWidth, 540, 47, 700);
  text("JAWABAN BENAR", 92, 575, 18, 800);
  text(`${result.accuracy}%`, 762, 520, 66, 900);
  text("AKURASI", 766, 563, 20, 700);
  text("TOTAL MENJAWAB", 64, 662, 20, 800);
  text(formatQuizDuration(result.totalMs), 64, 710, 40, 800);
  text("RATA-RATA / KANA", 432, 662, 20, 800);
  text(formatAnswerTime(result.averageMs), 432, 710, 40, 800);
  text("PERLU DIULANG", 790, 662, 20, 800);
  text(`${result.mistakes.length} kana`, 790, 710, 40, 800);

  if (kind === "summary") {
    text("PETA 46 KANA", 64, 790, 25, 900);
    result.chart.forEach((row, index) => {
      const x = 64 + (index % 10) * 96;
      const y = 818 + Math.floor(index / 10) * 100;
      panel(x, y, 88, 92, row.correct ? GREEN : CORAL);
      ctx.textAlign = "center";
      text(row.card.char, x + 44, y + 49, 44, 700);
      text(`${row.correct ? "OK" : "X"}  ${row.card.romaji}`, x + 44, y + 76, 18, 800);
      ctx.textAlign = "left";
    });
    panel(64, 1340, 22, 22, GREEN);
    text("Benar", 98, 1360, 22);
    panel(220, 1340, 22, 22, CORAL);
    text("Perlu diulang", 254, 1360, 22);
    text("Kirim laporan lengkap agar pengajar bisa melihat jawaban & waktumu.", 64, 1406, 22, 500);
  } else {
    const tableY = 754;
    panel(64, tableY, 952, 52, BLUE);
    const columns = [80, 152, 296, 490, 662, 842];
    ["NO.", "KANA", "JAWABANMU", "KUNCI", "WAKTU", "HASIL"].forEach((label, index) => text(label, columns[index], tableY + 34, 20, 800));
    result.rows.forEach((row, index) => {
      const y = tableY + 52 + index * 58;
      ctx.fillStyle = row.correct ? (index % 2 ? "#f5fbff" : "#ffffff") : CORAL;
      ctx.fillRect(64, y, 952, 58);
      ctx.strokeStyle = "#c9d4e1";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(64, y + 58); ctx.lineTo(1016, y + 58); ctx.stroke();
      text(String(row.number).padStart(2, "0"), columns[0], y + 39, 23, 500);
      text(row.card.char, columns[1], y + 42, 36, 700);
      text(row.selectedRomaji, columns[2], y + 39, 28, 700);
      text(row.card.romaji, columns[3], y + 39, 28, 700);
      text(formatAnswerTime(row.elapsedMs), columns[4], y + 39, 25, 500);
      text(row.correct ? "Benar" : "Salah", columns[5], y + 39, 25, 800);
    });
    text("Waktu per kana mencakup waktu saat berpindah tab atau memuat ulang.", 64, canvas.height - 22, 21, 500);
  }

  // The report is generated locally. No result data is embedded in its URL.
  const label = new URL(quizUrl).host + "/kana/quiz";
  if (kind === "summary") text(label, 64, 1445, 20, 800);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Gambar gagal dibuat. Coba lagi.")), "image/png");
  });
  const safeNickname = session.nickname.replace(/[^\p{L}\p{N}_-]/gu, "_").slice(0, 40) || "siswa";
  return new File([blob], `quiz-${session.script}-${safeNickname}-${kind === "summary" ? "ringkasan" : "laporan"}.png`, { type: "image/png" });
}

export function downloadQuizImage(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
