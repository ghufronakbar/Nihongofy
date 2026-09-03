import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, MailCheck } from "lucide-react";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";
import { getPendingVerificationPageData } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Periksa Email",
  description: "Konfirmasi alamat email untuk mengaktifkan akun Tanoshii Japanese.",
  robots: { index: false, follow: false },
};

const DELIVERY_MESSAGES = {
  sent: { ok: true, text: "Email verifikasi telah dikirim." },
  cooldown: { ok: true, text: "Email terbaru masih berlaku. Periksa kotak masuk Anda." },
  limited: { ok: false, text: "Batas pengiriman tercapai. Coba kembali beberapa saat lagi." },
  failed: { ok: false, text: "Email belum dapat dikirim. Anda dapat mencoba kembali." },
} as const;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ delivery?: string | string[] }>;
}) {
  const [{ delivery }, data] = await Promise.all([
    searchParams,
    getPendingVerificationPageData(),
  ]);
  const deliveryKey = typeof delivery === "string" ? delivery : "";
  const initialMessage =
    deliveryKey in DELIVERY_MESSAGES
      ? DELIVERY_MESSAGES[deliveryKey as keyof typeof DELIVERY_MESSAGES]
      : null;
  const expiryLabel = data?.expiresAt
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(data.expiresAt))
    : null;

  if (!data) {
    return (
      <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="verify-title">
        <p className="neo-kicker bg-neo-coral">Verifikasi tidak tersedia</p>
        <h1 id="verify-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
          MASUK UNTUK MENGIRIM ULANG.
        </h1>
        <p className="mt-4 leading-7 text-foreground/70">
          Permintaan di browser ini sudah berakhir. Login dengan password yang benar akan
          mengirimkan email verifikasi baru.
        </p>
        <Link href="/login" className="mt-8 neo-button w-full bg-neo-blue">
          Kembali ke login
        </Link>
      </section>
    );
  }

  return (
    <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="verify-title">
      <p className="neo-kicker bg-neo-yellow">Satu langkah lagi</p>
      <h1 id="verify-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
        PERIKSA EMAILMU.
      </h1>
      <p className="mt-4 leading-7 text-foreground/70">
        Kami mengirim tautan konfirmasi ke <strong>{data.email}</strong>.
      </p>
      {expiryLabel ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-foreground/65">
          <Clock3 className="size-4" aria-hidden="true" />
          Link berlaku sampai {expiryLabel} WIB.
        </p>
      ) : null}
      <div className="mt-8">
        {data.verified ? (
          <div className="grid gap-4">
            <div className="border-[3px] border-black bg-neo-green p-4 font-bold text-black shadow-neo-sm">
              <MailCheck className="mb-3 size-7" aria-hidden="true" />
              Email sudah terverifikasi. Silakan masuk ke akun Anda.
            </div>
            <Link href="/login" className="neo-button w-full bg-neo-blue">Masuk</Link>
          </div>
        ) : (
          <VerifyEmailPanel
            initialCooldownSeconds={data.cooldownSeconds}
            initialMessage={initialMessage}
          />
        )}
      </div>
    </section>
  );
}
