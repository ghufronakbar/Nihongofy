import type { PrintBranding } from "./types";

// Font sistem, bukan web font: di macOS hasilnya Hiragino (sama dengan contoh
// yang sudah direview), di Windows jatuh ke Yu Mincho/Yu Gothic.
const MINCHO = `"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", "MS Mincho", serif`;
const GOTHIC = `"Hiragino Kaku Gothic ProN", "Yu Gothic", "YuGothic", "Noto Sans JP", "Meiryo", sans-serif`;

function cssString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/</g, "\\3c ").replace(/[\r\n]+/g, " ")}"`;
}

export function printStyles(branding: PrintBranding | null): string {
  // Margin box @page atas DAN bawah selalu ada. Chrome hanya mencetak header
  // bawaannya (tanggal + judul) bila tidak ada margin box atas, dan footer bawaannya
  // (URL halaman admin + nomor halaman) bila tidak ada margin box bawah — walau
  // opsi "Headers and footers" di dialog cetak masih tercentang. Diuji di Chrome 157.
  const brandFooter = branding
    ? `@bottom-left { content: ${cssString(`${branding.name} · ${branding.host}`)}; font: 7.5pt ${GOTHIC}; color: #444; }`
    : "";

  return `
@page { size: A4; margin: 9mm 11mm 11mm;
  @top-center { content: ""; }
  @bottom-center { content: counter(page) " / " counter(pages); font: 8pt ${GOTHIC}; color: #444; }
  ${brandFooter}
}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${MINCHO}; font-size: 10pt; line-height: 1.5; color: #000; background: #fff; }
img { max-width: 100%; }
.doc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 4mm; margin: 0 0 1.5mm; padding-bottom: 1mm; border-bottom: 1.5pt solid #000; }
h1 { font: 600 12.5pt ${GOTHIC}; margin: 0; }
.brand { font: 700 10pt ${GOTHIC}; white-space: nowrap; }
.brand small { font-weight: 400; font-size: 7.5pt; margin-left: 1.5mm; color: #444; }
h2 { font: 600 10.5pt ${GOTHIC}; margin: 3mm 0 1.5mm; padding: .5mm 0; border-top: 1.2pt solid #000; border-bottom: .6pt solid #000; break-after: avoid; }
h2.new-page { break-before: page; margin-top: 0; }
.doc-head + h2 { margin-top: 1mm; }
ruby rt { font-size: .5em; }
u { text-decoration-thickness: .8pt; text-underline-offset: 2.5pt; }
.mondai { margin-bottom: 2mm; }
.mh { margin: 1.6mm 0 1mm; break-after: avoid; line-height: 1.75; }
.mn { font: 600 9.5pt ${GOTHIC}; border: .8pt solid #000; padding: 0 1.4mm; margin-right: 1.6mm; }
.ins { font-size: 8.5pt; }
.keep { break-inside: avoid; }
.q { break-inside: avoid; margin: 0 0 1.2mm; }
.q.line { display: grid; grid-template-columns: auto 1fr repeat(4, var(--cw)); column-gap: 1.8mm; align-items: baseline; line-height: 1.75; }
.q.line .ch { display: contents; }
.stem { display: flex; align-items: baseline; gap: 1.8mm; line-height: 1.75; }
.qn { flex: none; display: inline-block; min-width: 6.2mm; text-align: center; border: .8pt solid #000; font: 600 8.5pt/1.35 ${GOTHIC}; }
.ch { display: grid; column-gap: 3mm; padding-left: 8mm; line-height: 1.75; }
.c4 { grid-template-columns: repeat(4, 1fr); } .c4a { grid-template-columns: repeat(4, auto); justify-content: start; }
.c2 { grid-template-columns: repeat(2, 1fr); } .c1 { grid-template-columns: 1fr; }
.cn { font: 600 8.5pt ${GOTHIC}; margin-right: 1.4mm; }
.chimg { display: block; max-height: 28mm; margin: .5mm 0 1mm; }
.q.row { display: flex; align-items: baseline; gap: 1.8mm; }
.q.row .ch { padding-left: 0; flex: 1; }
.qimg { display: block; max-height: 60mm; margin: .5mm 0 1mm 8mm; }
.slot { display: inline-block; width: 4.2em; border-bottom: .8pt solid #000; text-align: center; margin: 0 .25em; line-height: 1.2; }
.blank { display: inline-block; min-width: 3.2em; border: .8pt solid #000; text-align: center; font: 600 8.5pt/1.35 ${GOTHIC}; margin: 0 .2em; }
.passage { border: .8pt solid #000; padding: 1mm 2.5mm; margin: 0 0 1.2mm; line-height: 1.75; }
.passage .p + .p, .passage .p + table, .passage table + .p { margin-top: .6mm; }
.passage .sec { border-top: .6pt dashed #000; margin-top: 1mm; padding-top: .6mm; }
.passage .sec-label { font: 600 9pt ${GOTHIC}; }
.pimg { display: block; max-height: 150mm; margin: 1mm auto; }
table { border-collapse: collapse; margin: 1mm 0; font-size: 9pt; line-height: 1.4; }
th, td { border: .6pt solid #000; padding: .4mm 1.6mm; text-align: left; }
th { font-weight: 600; }
.ban { font: 600 9pt ${GOTHIC}; border: .8pt solid #000; padding: 0 1.2mm; flex: none; white-space: nowrap; }
.cols { columns: 2; column-gap: 7mm; }
.cq { break-inside: avoid; margin-bottom: 2mm; }
.cq > .ban { display: inline-block; margin-bottom: .8mm; }
.cq.row { display: flex; align-items: baseline; gap: 2.5mm; }
.cq.row > .ban { margin-bottom: 0; }
.cq.row .ch { flex: 1; padding-left: 0; }
.cimg { display: block; max-width: 100%; max-height: 49mm; margin: 0 auto; }
.ex { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm 3.5mm; }
.ex figure { margin: 0; break-inside: avoid; }
.ex figcaption { display: flex; align-items: center; justify-content: space-between; margin-bottom: .6mm; }
.ex img { display: block; width: 100%; max-height: 40mm; object-fit: contain; }
.bub { display: inline-flex; gap: 1.6mm; }
.bub span { display: inline-block; width: 4.6mm; height: 4.6mm; border: .7pt solid #000; border-radius: 50%; text-align: center; font: 8pt/4.4mm ${GOTHIC}; }
.qr { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6mm 6mm; }
.qr > div { display: flex; align-items: center; gap: 2.5mm; }

.as { break-before: page; font-family: ${GOTHIC}; font-size: 8.5pt; line-height: 1.35; }
.as-head { display: flex; justify-content: space-between; align-items: baseline; gap: 4mm; border-bottom: 1.5pt solid #000; padding-bottom: 1mm; margin-bottom: 2mm; }
.as-title { font-size: 13pt; font-weight: 600; } .as-title small { font-size: 9pt; font-weight: 400; margin-left: 1.5mm; }
.as-pkg { font-size: 9.5pt; font-weight: 600; text-align: right; }
.as-pkg .brand { display: block; font-size: 8pt; }
.as-id { display: flex; gap: 5mm; margin-bottom: 2mm; }
.as-f { display: flex; align-items: center; gap: 2mm; flex: 1.6; } .as-f.num { flex: 1; }
.as-f > span { font-weight: 600; font-size: 8pt; line-height: 1.2; white-space: nowrap; } .as-f small { font-weight: 400; font-size: 7pt; }
.as-box { flex: 1; height: 8.5mm; border: .8pt solid #000; }
.as-note { border: .6pt solid #000; padding: 1.2mm 2.5mm; margin-bottom: 2.5mm; display: grid; grid-template-columns: 1fr auto; column-gap: 4mm; align-items: center; font-size: 7.5pt; }
.as-note b { grid-column: 1 / -1; font-size: 8pt; }
.as-note ol { margin: .3mm 0 0; padding-left: 4.5mm; }
.as-ex { display: grid; grid-template-columns: auto auto; gap: 1mm 2mm; align-items: center; }
.as-grid { display: grid; column-gap: 5mm; align-items: start; }
.as-st { font-weight: 600; font-size: 8.5pt; text-align: center; border: .8pt solid #000; background: #e9e9e9; padding: .6mm 0; margin-bottom: 1.5mm; }
.as-body { column-gap: 3mm; }
.as-m { width: 100%; border-collapse: collapse; margin: 0 0 1.6mm; font-size: 8pt; break-inside: avoid; }
.as-m th, .as-m td { border: .5pt solid #555; padding: 0; text-align: center; }
.as-m thead th { border: .8pt solid #000; background: #f0f0f0; padding: .2mm 0; font-weight: 600; }
.as-m tbody th { width: 9mm; font-weight: 600; border-left: .8pt solid #000; white-space: nowrap; }
.as-m td { height: 5.3mm; border-right: .8pt solid #000; }
.as-m tbody tr:last-child th, .as-m tbody tr:last-child td { border-bottom: .8pt solid #000; }
.as-b { display: inline-flex; gap: 2.6mm; vertical-align: middle; }
.as-m .as-b { display: flex; justify-content: center; }
.as-b > span { width: 4.2mm; height: 4.2mm; border: .7pt solid #000; border-radius: 50%; text-align: center; font: 6.5pt/4mm ${GOTHIC}; color: #444; background: #fff; }
.as-b > span.none { border-color: transparent; background: transparent; }
.as-b > span.fill { background: #000; }
.as-b > span.half { background: linear-gradient(90deg, #000 50%, #fff 50%); }
/* Kunci jawaban: dokumen sendiri (tanpa halaman baru di depan), jawaban benar dihitamkan. */
.as.key { break-before: auto; }
.as-b > span.ans { background: #000; color: #fff; font-weight: 700; }

.toolbar { display: none; }
@media screen {
  html { background: #d9d9d9; }
  body { width: 210mm; margin: 0 auto 12mm; padding: 9mm 11mm 11mm; box-shadow: 0 1px 6px rgba(0, 0, 0, .25); }
  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 4mm; margin: -9mm -11mm 6mm; padding: 3mm 11mm; background: #fff8d6; border-bottom: 1pt solid #000; font: 9pt/1.5 ${GOTHIC}; }
  .toolbar button { font: 700 9pt ${GOTHIC}; padding: 1.5mm 4mm; border: 1.2pt solid #000; background: #000; color: #fff; cursor: pointer; }
}
`;
}
