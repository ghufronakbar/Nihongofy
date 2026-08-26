import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getSafeRedirectPath } from "@/features/auth/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Daftar",
  description: "Persiapkan akun JLPT Exam untuk menyimpan progres belajar pribadi.",
};

export default async function RegisterPage({
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
    <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="register-title">
      <p className="neo-kicker bg-neo-green">Akun multi-user</p>
      <h1 id="register-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
        BUAT RUANG BELAJARMU.
      </h1>
      <p className="mt-4 leading-7 text-foreground/70">
        Simpan attempt, catatan soal, history, dan progres pada akunmu sendiri.
      </p>
      <div className="mt-8">
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
