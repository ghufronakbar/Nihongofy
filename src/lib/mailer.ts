import "server-only";

import nodemailer from "nodemailer";
import { env } from "@/constants";

// Satu transporter untuk seluruh aplikasi. Modul yang mengirim email
// (auth, balasan laporan) menumpang di sini alih-alih membuat transport sendiri:
// dua transport berarti dua pool koneksi SMTP ke server yang sama.
//
// Template email-nya TIDAK di sini. Isi dan nada surat milik modul
// masing-masing; yang dibagi hanya jalur kirimnya.
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_APP_PASSWORD,
  },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  await transporter.sendMail({
    from: { name: env.SMTP_FROM_NAME, address: env.SMTP_FROM_EMAIL },
    to,
    subject,
    text,
    html,
  });
}

export async function verifySmtpConnection() {
  return transporter.verify();
}
