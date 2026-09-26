import "server-only";

import { SITE_URL } from "@/constants";
import { escapeHtml, sendMail } from "@/lib/mailer";
import { REPORT_CATEGORY_LABELS, type ReportCategoryValue } from "../constants";

// Email balasan laporan. Berbeda dari email auth, isinya bukan tautan aksi
// melainkan jawaban admin, jadi template-nya sendiri dan tanpa tombol.
//
// Yang PALING penting di file ini: isi laporan asli TIDAK pernah dikutip ke dalam
// email. Alamat balasan diketik sendiri oleh pengirim dan tidak diverifikasi,
// jadi seseorang dapat menuliskan alamat orang lain. Bila isi laporan ikut
// dikirim, teks kasar yang ia tulis akan sampai ke orang itu atas nama aplikasi
// ini. Yang boleh disebut hanya: ada laporan, kategorinya, tanggalnya, dan
// jawaban admin.

function replyShell({
  categoryLabel,
  createdAtLabel,
  replyMessage,
}: {
  categoryLabel: string;
  createdAtLabel: string;
  replyMessage: string;
}) {
  const paragraphs = replyMessage
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="font-size:16px;line-height:1.7;margin:0 0 12px">${escapeHtml(block).replaceAll("\n", "<br />")}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="id">
  <body style="margin:0;background:#eaf2ff;color:#111;font-family:Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">Balasan atas laporan Anda</div>
    <div style="max-width:620px;margin:0 auto;padding:32px 18px">
      <div style="border:3px solid #111;background:#fff;box-shadow:7px 7px 0 #111;padding:30px">
        <div style="display:inline-block;border:2px solid #111;background:#facc00;padding:6px 10px;font-size:12px;font-weight:800;letter-spacing:.12em">NIHONGOFY</div>
        <h1 style="font-size:30px;line-height:1.1;margin:24px 0 16px">Balasan atas laporan Anda</h1>
        <p style="font-size:14px;line-height:1.6;color:#465064;margin:0 0 20px">Laporan kategori <strong>${escapeHtml(categoryLabel)}</strong> yang dikirim pada ${escapeHtml(createdAtLabel)}.</p>
        ${paragraphs}
        <p style="font-size:13px;line-height:1.6;color:#465064;margin:24px 0 0">Anda menerima email ini karena alamat ini dipakai saat mengirim laporan di ${escapeHtml(SITE_URL.host)}. Jika bukan Anda, abaikan email ini — tidak ada tindakan yang perlu dilakukan.</p>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendReportReplyMail({
  to,
  category,
  createdAt,
  replyMessage,
}: {
  to: string;
  category: ReportCategoryValue;
  createdAt: Date;
  replyMessage: string;
}) {
  const categoryLabel = REPORT_CATEGORY_LABELS[category];
  const createdAtLabel = createdAt.toISOString().slice(0, 10);

  await sendMail({
    to,
    subject: "Balasan atas laporan Anda - Nihongofy",
    text: [
      `Balasan atas laporan Anda (kategori ${categoryLabel}, dikirim ${createdAtLabel}):`,
      "",
      replyMessage,
      "",
      `Anda menerima email ini karena alamat ini dipakai saat mengirim laporan di ${SITE_URL.host}. Jika bukan Anda, abaikan email ini.`,
    ].join("\n"),
    html: replyShell({ categoryLabel, createdAtLabel, replyMessage }),
  });
}
