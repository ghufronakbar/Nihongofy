import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSafeRedirectPath } from "@/features/auth/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun JLPT Exam untuk melanjutkan latihan dan review.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = getSafeRedirectPath(next);
  const session = await getSession();

  if (session) {
    redirect(nextPath);
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
      <div className="mt-8">
        <LoginForm nextPath={nextPath} />
      </div>
      <p className="mt-7 border-t-2 border-neo-ink pt-5 text-center text-sm text-foreground/70">
        Belum punya akun?{" "}
        <Link href="/register" className="font-extrabold text-foreground underline decoration-2 decoration-neo-blue underline-offset-4">
          Lihat halaman daftar
        </Link>
      </p>
    </section>
  );
}
