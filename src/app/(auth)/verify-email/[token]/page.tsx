import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, MailCheck, ShieldCheck } from "lucide-react";
import { connection } from "next/server";
import { ConfirmEmailForm } from "@/features/auth/components/confirm-email-form";
import { getEmailTokenPageData } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Konfirmasi Email",
  description: "Konfirmasi alamat email Tanoshii Japanese.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ConfirmEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const data = await getEmailTokenPageData(token);

  if (!data) {
    return (
      <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="confirm-title">
        <p className="neo-kicker bg-neo-coral">Link tidak berlaku</p>
        <h1 id="confirm-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
          TAUTAN SUDAH BERAKHIR.
        </h1>
        <p className="mt-4 leading-7 text-foreground/70">
          Link mungkin sudah digunakan, diganti oleh email yang lebih baru, atau melewati batas
          waktu.
        </p>
        <div className="mt-8 grid gap-3">
          <Link href="/verify-email" className="neo-button w-full bg-neo-yellow">Kirim ulang verifikasi</Link>
          <Link href="/login" className="neo-button w-full bg-white">Kembali ke login</Link>
        </div>
      </section>
    );
  }

  const expiryLabel = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(data.expiresAt));

  return (
    <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="confirm-title">
      <p className="neo-kicker bg-neo-green">Link valid</p>
      <h1 id="confirm-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
        AKTIFKAN AKUNMU.
      </h1>
      <p className="mt-4 leading-7 text-foreground/70">
        Alamat yang akan dikonfirmasi: <strong>{data.email}</strong>.
      </p>
      <div className="mt-6 grid gap-3 border-[3px] border-black bg-neo-paper p-4 shadow-neo-sm">
        <p className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-5" aria-hidden="true" /> Konfirmasi hanya dilakukan setelah tombol ditekan.</p>
        <p className="flex items-center gap-2 text-sm font-bold"><Clock3 className="size-5" aria-hidden="true" /> Berlaku sampai {expiryLabel} WIB dan hanya dapat digunakan sekali.</p>
        <p className="flex items-center gap-2 text-sm font-bold"><MailCheck className="size-5" aria-hidden="true" /> Email scanner tidak akan mengaktifkan akun secara otomatis.</p>
      </div>
      <div className="mt-8">
        <ConfirmEmailForm token={token} label="Konfirmasi dan masuk" />
      </div>
    </section>
  );
}
