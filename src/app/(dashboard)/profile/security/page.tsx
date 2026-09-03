import type { Metadata } from "next";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { getActiveSessionsAction, getProfileAccountAction } from "@/features/profile/actions";
import { ActiveSessions } from "@/features/profile/components/active-sessions";
import { ChangePasswordForm } from "@/features/profile/components/change-password-form";

export const metadata: Metadata = {
  title: "Security Akun",
  description: "Ganti password dan rotasi sesi akun JLPT.",
};

export default async function SecurityPage() {
  const [account, activeSessions] = await Promise.all([
    getProfileAccountAction(),
    getActiveSessionsAction(),
  ]);
  const formatter = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
  const sessions = activeSessions.map((session) => ({
    sessionId: session.sessionId,
    deviceName: session.deviceName,
    createdAtLabel: formatter.format(new Date(session.createdAt)),
    lastSeenAtLabel: formatter.format(new Date(session.lastSeenAt)),
    expiresAtLabel: formatter.format(new Date(session.expiresAt)),
    current: session.current,
  }));

  return (
    <main className="grid max-w-4xl gap-6">
      <header>
        <p className="font-mono text-xs font-black tracking-widest uppercase">PROFILE / SECURITY</p>
        <h1 className="mt-2 text-4xl sm:text-6xl">Security akun</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Perbarui password dengan verifikasi password saat ini. OAuth tidak ditambahkan karena belum menjadi bagian arsitektur.</p>
      </header>

      <section className="neo-surface grid overflow-hidden bg-white md:grid-cols-[0.8fr_1.2fr]" aria-labelledby="password-heading">
        <div className="border-b-[3px] border-black bg-neo-blue p-6 md:border-r-[3px] md:border-b-0 md:p-8">
          <ShieldCheck className="size-14" aria-hidden="true" />
          <h2 id="password-heading" className="mt-6 text-3xl">Ganti password</h2>
          <p className="mt-3 font-semibold text-black/65">Akun aktif: {account.email ?? account.username ?? "akun legacy"}</p>
          <div className="mt-8 border-[3px] border-black bg-white p-4 shadow-neo-sm">
            <Fingerprint className="size-7" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">Setelah berhasil, cookie sesi aktif dibuat ulang dengan masa berlaku baru.</p>
          </div>
        </div>
        <div className="p-5 sm:p-8">
          <ChangePasswordForm />
        </div>
      </section>

      <section className="neo-surface bg-white p-5 sm:p-8" aria-label="Daftar perangkat aktif">
        <ActiveSessions sessions={sessions} />
      </section>
    </main>
  );
}
