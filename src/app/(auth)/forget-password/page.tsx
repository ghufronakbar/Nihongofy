import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Lupa Password",
  description: "Minta tautan sekali pakai untuk membuat password baru.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="forgot-title">
      <p className="neo-kicker bg-neo-yellow">Pemulihan akun</p>
      <h1 id="forgot-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
        LUPA PASSWORD?
      </h1>
      <p className="mt-4 leading-7 text-foreground/70">
        Masukkan email akun. Tautan reset berlaku 15 menit dan link lama akan dibatalkan saat
        link baru dibuat.
      </p>
      <div className="mt-8"><ForgotPasswordForm /></div>
      <p className="mt-7 border-t-2 border-neo-ink pt-5 text-center text-sm text-foreground/70">
        Ingat password?{" "}
        <Link href="/login" className="font-extrabold text-foreground underline decoration-2 decoration-neo-blue underline-offset-4">
          Kembali ke login
        </Link>
      </p>
    </section>
  );
}
