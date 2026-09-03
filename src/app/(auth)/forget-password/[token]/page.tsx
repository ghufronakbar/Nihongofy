import type { Metadata } from "next";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { connection } from "next/server";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getPasswordResetTokenPageData } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Buat Password Baru",
  description: "Atur ulang password akun Tanoshii Japanese.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const data = await getPasswordResetTokenPageData(token);

  if (!data) {
    return (
      <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="reset-title">
        <p className="neo-kicker bg-neo-coral">Link tidak berlaku</p>
        <h1 id="reset-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
          MINTA LINK BARU.
        </h1>
        <p className="mt-4 leading-7 text-foreground/70">
          Link reset mungkin sudah digunakan, diganti, atau melewati batas waktu 15 menit.
        </p>
        <Link href="/forget-password" className="mt-8 neo-button w-full bg-neo-yellow">
          Kirim link reset baru
        </Link>
      </section>
    );
  }

  const expiryLabel = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(data.expiresAt));

  return (
    <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="reset-title">
      <p className="neo-kicker bg-neo-green">Link reset valid</p>
      <h1 id="reset-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
        PASSWORD BARU.
      </h1>
      <p className="mt-4 leading-7 text-foreground/70">
        Buat password baru untuk <strong>{data.email}</strong>. Semua perangkat akan logout setelah
        perubahan berhasil.
      </p>
      <p className="mt-3 flex items-center gap-2 text-sm font-bold text-foreground/65">
        <Clock3 className="size-4" aria-hidden="true" /> Berlaku sampai {expiryLabel} WIB dan hanya dapat digunakan sekali.
      </p>
      <div className="mt-8"><ResetPasswordForm token={token} /></div>
    </section>
  );
}
