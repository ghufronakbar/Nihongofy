import "server-only";

import nodemailer from "nodemailer";
import { env, SITE_URL } from "@/constants";

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailShell({
  preheader,
  title,
  greeting,
  description,
  buttonLabel,
  url,
  expiryText,
}: {
  preheader: string;
  title: string;
  greeting: string;
  description: string;
  buttonLabel: string;
  url: string;
  expiryText: string;
}) {
  return `<!doctype html>
<html lang="id">
  <body style="margin:0;background:#eaf2ff;color:#111;font-family:Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>
    <div style="max-width:620px;margin:0 auto;padding:32px 18px">
      <div style="border:3px solid #111;background:#fff;box-shadow:7px 7px 0 #111;padding:30px">
        <div style="display:inline-block;border:2px solid #111;background:#facc00;padding:6px 10px;font-size:12px;font-weight:800;letter-spacing:.12em">TANOSHII JAPANESE</div>
        <h1 style="font-size:34px;line-height:1.05;margin:24px 0 16px">${escapeHtml(title)}</h1>
        <p style="font-size:16px;line-height:1.7;margin:0 0 12px">${escapeHtml(greeting)}</p>
        <p style="font-size:16px;line-height:1.7;margin:0 0 24px">${escapeHtml(description)}</p>
        <a href="${escapeHtml(url)}" style="display:inline-block;border:3px solid #111;background:#5294ff;color:#111;padding:13px 18px;font-weight:800;text-decoration:none;box-shadow:4px 4px 0 #111">${escapeHtml(buttonLabel)}</a>
        <p style="font-size:13px;line-height:1.6;color:#465064;margin:24px 0 0">${escapeHtml(expiryText)} Jika bukan Anda yang meminta, abaikan email ini.</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendMail({
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

export async function sendEmailVerificationMail({
  email,
  displayName,
  token,
  isEmailChange = false,
}: {
  email: string;
  displayName: string;
  token: string;
  isEmailChange?: boolean;
}) {
  const url = new URL(`/verify-email/${encodeURIComponent(token)}`, SITE_URL).toString();
  const title = isEmailChange ? "Konfirmasi email baru" : "Konfirmasi email Anda";
  const description = isEmailChange
    ? "Klik tombol berikut untuk menyelesaikan perubahan alamat email akun Anda."
    : "Klik tombol berikut agar akun belajar Anda aktif dan dapat digunakan untuk masuk.";
  const expiryText = "Tautan ini berlaku selama 30 menit dan hanya dapat digunakan sekali.";

  await sendMail({
    to: email,
    subject: `${title} - Tanoshii Japanese`,
    text: `Halo ${displayName},\n\n${description}\n\n${url}\n\n${expiryText}`,
    html: emailShell({
      preheader: title,
      title,
      greeting: `Halo ${displayName},`,
      description,
      buttonLabel: isEmailChange ? "Konfirmasi email baru" : "Konfirmasi email",
      url,
      expiryText,
    }),
  });
}

export async function sendPasswordResetMail({
  email,
  displayName,
  token,
}: {
  email: string;
  displayName: string;
  token: string;
}) {
  const url = new URL(`/forget-password/${encodeURIComponent(token)}`, SITE_URL).toString();
  const description = "Klik tombol berikut untuk membuat password baru akun Anda.";
  const expiryText = "Tautan ini berlaku selama 15 menit dan hanya dapat digunakan sekali.";

  await sendMail({
    to: email,
    subject: "Reset password - Tanoshii Japanese",
    text: `Halo ${displayName},\n\n${description}\n\n${url}\n\n${expiryText}`,
    html: emailShell({
      preheader: "Permintaan reset password",
      title: "Buat password baru",
      greeting: `Halo ${displayName},`,
      description,
      buttonLabel: "Reset password",
      url,
      expiryText,
    }),
  });
}

export async function verifySmtpConnection() {
  return transporter.verify();
}
