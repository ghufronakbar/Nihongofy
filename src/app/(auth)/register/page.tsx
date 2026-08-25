import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Daftar",
  description: "Persiapkan akun JLPT Exam untuk menyimpan progres belajar pribadi.",
};

const PLANNED_FIELDS = [
  { label: "Nama tampilan", placeholder: "Nama kamu", icon: UserRound, type: "text" },
  { label: "Email", placeholder: "nama@email.com", icon: Mail, type: "email" },
  { label: "Password", placeholder: "Minimal 8 karakter", icon: LockKeyhole, type: "password" },
  { label: "Konfirmasi password", placeholder: "Ulangi password", icon: LockKeyhole, type: "password" },
];

export default async function RegisterPage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <section className="neo-surface bg-white p-6 sm:p-8" aria-labelledby="register-title">
      <p className="neo-kicker bg-neo-green">Akun multi-user</p>
      <h1 id="register-title" className="mt-6 text-4xl leading-none font-black sm:text-5xl">
        REGISTRASI SEDANG DISIAPKAN.
      </h1>
      <p className="mt-4 leading-7 text-foreground/70">
        Form ini akan memakai nama, email, dan password. Pendaftaran baru diaktifkan setelah migrasi akun lama dan keamanan database selesai.
      </p>

      <div className="mt-7 border-[3px] border-neo-ink bg-neo-yellow p-4 text-sm font-bold shadow-neo-sm" role="status">
        Belum ada akun baru yang dibuat pada Fase 1. Akun existing tetap dapat masuk seperti biasa.
      </div>

      <fieldset disabled className="mt-8 space-y-5 opacity-70" aria-describedby="register-status">
        <legend className="sr-only">Rancangan form registrasi</legend>
        {PLANNED_FIELDS.map((field, index) => (
          <label key={field.label} className="block text-sm font-extrabold">
            {field.label}
            <span className="relative mt-2 block">
              <field.icon className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2" aria-hidden="true" />
              <input
                type={field.type}
                placeholder={field.placeholder}
                className="neo-input h-12 pl-12 disabled:cursor-not-allowed disabled:bg-slate-100"
                autoComplete={index === 0 ? "name" : index === 1 ? "email" : "new-password"}
              />
            </span>
          </label>
        ))}
        <button type="button" className="neo-button w-full bg-neo-green py-3 text-base" disabled>
          Buat akun
        </button>
      </fieldset>
      <span id="register-status" className="sr-only">
        Registrasi belum aktif pada fase ini.
      </span>

      <p className="mt-7 border-t-2 border-neo-ink pt-5 text-center text-sm text-foreground/70">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-extrabold text-foreground underline decoration-2 decoration-neo-blue underline-offset-4">
          Masuk di sini
        </Link>
      </p>
    </section>
  );
}
