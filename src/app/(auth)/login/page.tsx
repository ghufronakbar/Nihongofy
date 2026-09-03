import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/features/auth/components/login-form";
import { GoogleOAuthButton } from "@/features/auth/components/google-oauth-button";
import { getSafeRedirectPath } from "@/features/auth/lib/safe-redirect";
import { GOOGLE_OAUTH_ENABLED } from "@/constants";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun Tanoshii Japanese untuk melanjutkan latihan, review jawaban, dan melacak progres.",
};

const GOOGLE_NOTICE: Record<string, string> = {
  cancelled: "Login Google dibatalkan.",
  "invalid-state": "State login Google tidak valid. Silakan mulai ulang.",
  "expired-state": "Permintaan login Google sudah berakhir. Silakan mulai ulang.",
  "invalid-callback": "Callback Google tidak valid.",
  "verification-failed": "Google account belum dapat diverifikasi. Silakan coba lagi.",
  "provider-conflict": "Google account tersebut sudah terhubung dengan akun lain.",
  "credential-account":
    "Email ini sudah terdaftar dengan password. Masuk menggunakan password, lalu hubungkan Google melalui Profil > Keamanan.",
  "account-unavailable": "Akun tidak tersedia untuk login.",
  "rate-limited": "Terlalu banyak percobaan Google OAuth. Silakan coba lagi nanti.",
  "not-configured": "Google OAuth belum dikonfigurasi pada environment ini.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    passwordReset?: string | string[];
    accountDeletion?: string | string[];
    google?: string | string[];
  }>;
}) {
  const { next, passwordReset, accountDeletion, google } = await searchParams;
  const nextPath = getSafeRedirectPath(next);
  const session = await getSession();

  if (session) {
    const userExists = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, deletionScheduledFor: true },
    });
    if (userExists?.deletionScheduledFor && userExists.deletionScheduledFor > new Date()) {
      redirect("/profile/privacy?deletion=pending");
    }
    if (userExists && !userExists.deletionScheduledFor) redirect(nextPath);
  }

  return (
    <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="login-title">
      <p className="neo-kicker bg-neo-yellow">Selamat datang kembali</p>
      <h1 id="login-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
        MASUK DAN LANJUTKAN.
      </h1>
      <p className="mt-4 leading-7 text-foreground/70">
        Akses paket ujian, history, review jawaban, dan progres belajarmu.
      </p>
      {passwordReset === "success" ? (
        <p role="status" className="mt-5 border-[3px] border-black bg-neo-green p-3 font-bold text-black shadow-neo-sm">
          Password berhasil diperbarui. Semua session lama sudah dicabut.
        </p>
      ) : null}
      {accountDeletion === "requested" ? (
        <p role="status" className="mt-5 border-[3px] border-black bg-neo-yellow p-3 font-bold text-black shadow-neo-sm">
          Penghapusan akun dijadwalkan. Login kembali dalam 7 hari untuk membatalkannya.
        </p>
      ) : null}
      {typeof google === "string" && GOOGLE_NOTICE[google] ? (
        <p role="alert" className="mt-5 border-[3px] border-black bg-neo-coral p-3 font-bold text-black shadow-neo-sm">
          {GOOGLE_NOTICE[google]}
        </p>
      ) : null}
      <div className="mt-8">
        {GOOGLE_OAUTH_ENABLED ? (
          <>
            <GoogleOAuthButton label="Lanjutkan dengan Google" nextPath={nextPath} />
            <div className="my-6 flex items-center gap-3" aria-hidden="true">
              <span className="h-0.5 flex-1 bg-black" />
              <span className="font-mono text-xs font-black uppercase">atau password</span>
              <span className="h-0.5 flex-1 bg-black" />
            </div>
          </>
        ) : null}
        <LoginForm nextPath={nextPath} />
      </div>
      <p className="mt-7 border-t-2 border-neo-ink pt-5 text-center text-sm text-foreground/70">
        Belum punya akun?{" "}
        <Link
          href={{ pathname: "/register", query: nextPath === "/dashboard" ? undefined : { next: nextPath } }}
          className="font-extrabold text-foreground underline decoration-2 decoration-neo-blue underline-offset-4"
        >
          Daftar sekarang
        </Link>
      </p>
    </section>
  );
}
