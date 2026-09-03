import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSafeRedirectPath } from "@/features/auth/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun Tanoshii Japanese untuk melanjutkan latihan, review jawaban, dan melacak progres.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    passwordReset?: string | string[];
  }>;
}) {
  const { next, passwordReset } = await searchParams;
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
      <div className="mt-8">
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
