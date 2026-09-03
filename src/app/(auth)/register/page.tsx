import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RegisterForm } from "@/features/auth/components/register-form";
import { GoogleOAuthButton } from "@/features/auth/components/google-oauth-button";
import { getSafeRedirectPath } from "@/features/auth/lib/safe-redirect";
import { GOOGLE_OAUTH_ENABLED } from "@/constants";

export const metadata: Metadata = {
  title: "Daftar",
  description: "Daftar akun Tanoshii Japanese untuk menyimpan progres belajar, antrean review, dan history latihan.",
};

const GOOGLE_NOTICE: Record<string, string> = {
  cancelled: "Pendaftaran dengan Google dibatalkan.",
  "expired-state": "Permintaan Google sudah berakhir. Silakan mulai ulang.",
  "invalid-callback": "Callback Google tidak valid.",
  "verification-failed": "Google account belum dapat diverifikasi. Silakan coba lagi.",
  "provider-conflict": "Google account tersebut sudah terhubung dengan akun lain.",
  "credential-account":
    "Email ini sudah terdaftar dengan password. Masuk menggunakan password, lalu hubungkan Google melalui Profil > Keamanan.",
  "account-unavailable": "Akun tidak tersedia untuk pendaftaran.",
  "rate-limited": "Terlalu banyak percobaan Google OAuth. Silakan coba lagi nanti.",
  "not-configured": "Google OAuth belum dikonfigurasi pada environment ini.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    google?: string | string[];
  }>;
}) {
  const { next, google } = await searchParams;
  const nextPath = getSafeRedirectPath(next);
  const session = await getSession();

  if (session) {
    const userExists = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true },
    });
    if (userExists) redirect(nextPath);
  }

  return (
    <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="register-title">
      <p className="neo-kicker bg-neo-green">Akun multi-user</p>
      <h1 id="register-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
        BUAT RUANG BELAJARMU.
      </h1>
      <p className="mt-4 leading-7 text-foreground/70">
        Simpan attempt, catatan soal, history, dan progres pada akunmu sendiri.
      </p>
      {typeof google === "string" && GOOGLE_NOTICE[google] ? (
        <p role="alert" className="mt-5 border-[3px] border-black bg-neo-coral p-3 font-bold text-black shadow-neo-sm">
          {GOOGLE_NOTICE[google]}
        </p>
      ) : null}
      <div className="mt-8">
        {GOOGLE_OAUTH_ENABLED ? (
          <>
            <GoogleOAuthButton intent="register" label="Daftar dengan Google" nextPath={nextPath} />
            <div className="my-6 flex items-center gap-3" aria-hidden="true">
              <span className="h-0.5 flex-1 bg-black" />
              <span className="font-mono text-xs font-black uppercase">atau email</span>
              <span className="h-0.5 flex-1 bg-black" />
            </div>
          </>
        ) : null}
        <RegisterForm nextPath={nextPath} />
      </div>

      <p className="mt-7 border-t-2 border-neo-ink pt-5 text-center text-sm text-foreground/70">
        Sudah punya akun?{" "}
        <Link
          href={{ pathname: "/login", query: nextPath === "/dashboard" ? undefined : { next: nextPath } }}
          className="font-extrabold text-foreground underline decoration-2 decoration-neo-blue underline-offset-4"
        >
          Masuk di sini
        </Link>
      </p>
    </section>
  );
}
