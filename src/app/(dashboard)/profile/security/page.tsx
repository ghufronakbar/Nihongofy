import type { Metadata } from "next";
import { Fingerprint, Link2, ShieldCheck } from "lucide-react";
import { GOOGLE_OAUTH_ENABLED } from "@/constants";
import {
  getActiveSessionsAction,
  getSecurityAccountAction,
} from "@/features/profile/actions";
import { ActiveSessions } from "@/features/profile/components/active-sessions";
import { ChangePasswordForm } from "@/features/profile/components/change-password-form";
import { GoogleAccountPanel } from "@/features/profile/components/google-account-panel";
import { SetPasswordForm } from "@/features/profile/components/set-password-form";

export const metadata: Metadata = {
  title: "Security Akun",
  description: "Kelola password, Google account, dan perangkat aktif akun JLPT.",
};

const GOOGLE_NOTICE: Record<string, { ok: boolean; message: string }> = {
  connected: { ok: true, message: "Google account berhasil dihubungkan." },
  "already-connected": { ok: true, message: "Google account tersebut sudah terhubung." },
  cancelled: { ok: false, message: "Proses Google OAuth dibatalkan." },
  "email-mismatch": {
    ok: false,
    message: "Gunakan Google account dengan email yang sama persis dengan akun ini.",
  },
  "provider-conflict": {
    ok: false,
    message: "Google account tersebut sudah terhubung dengan akun lain.",
  },
  "reauth-mismatch": {
    ok: false,
    message: "Pilih Google account yang sudah terhubung dengan akun ini.",
  },
  "verification-failed": {
    ok: false,
    message: "Google account belum dapat diverifikasi. Silakan coba lagi.",
  },
  "invalid-state": { ok: false, message: "State Google OAuth tidak valid." },
  "expired-state": {
    ok: false,
    message: "Permintaan Google OAuth sudah berakhir. Silakan mulai ulang.",
  },
  "session-changed": {
    ok: false,
    message: "Session berubah selama proses Google OAuth. Silakan mulai ulang.",
  },
  "rate-limited": {
    ok: false,
    message: "Terlalu banyak percobaan Google OAuth. Silakan coba lagi nanti.",
  },
  "not-configured": {
    ok: false,
    message: "Google OAuth belum dikonfigurasi pada environment ini.",
  },
  "account-unavailable": {
    ok: false,
    message: "Akun tidak memiliki email yang dapat dihubungkan dengan Google.",
  },
  "not-connected": {
    ok: false,
    message: "Google account belum terhubung dengan akun ini.",
  },
  "password-exists": {
    ok: false,
    message: "Akun sudah memiliki password.",
  },
};

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{
    google?: string | string[];
    googleReauth?: string | string[];
  }>;
}) {
  const { google, googleReauth } = await searchParams;
  const [account, activeSessions] = await Promise.all([
    getSecurityAccountAction(),
    getActiveSessionsAction(),
  ]);
  const formatter = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: account.timeZone,
  });
  const sessions = activeSessions.map((session) => ({
    sessionId: session.sessionId,
    deviceName: session.deviceName,
    createdAtLabel: formatter.format(new Date(session.createdAt)),
    lastSeenAtLabel: formatter.format(new Date(session.lastSeenAt)),
    expiresAtLabel: formatter.format(new Date(session.expiresAt)),
    current: session.current,
  }));
  const googleNotice = typeof google === "string" ? GOOGLE_NOTICE[google] : undefined;
  const passwordReauthenticated = googleReauth === "set-password";

  return (
    <main className="grid max-w-4xl gap-6">
      <header>
        <p className="font-mono text-xs font-black tracking-widest uppercase">PROFILE / SECURITY</p>
        <h1 className="mt-2 text-4xl sm:text-6xl">Security akun</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Kelola metode login dan keluarkan session perangkat yang tidak dikenal.
        </p>
      </header>

      {googleNotice ? (
        <p
          role={googleNotice.ok ? "status" : "alert"}
          className={`border-[3px] border-black p-4 font-bold shadow-neo-sm ${googleNotice.ok ? "bg-neo-green" : "bg-neo-coral"}`}
        >
          {googleNotice.message}
        </p>
      ) : null}

      <section
        className="neo-surface grid overflow-hidden bg-white md:grid-cols-[0.8fr_1.2fr]"
        aria-labelledby="password-heading"
      >
        <div className="border-b-[3px] border-black bg-neo-blue p-6 md:border-r-[3px] md:border-b-0 md:p-8">
          <ShieldCheck className="size-14" aria-hidden="true" />
          <h2 id="password-heading" className="mt-6 text-3xl">
            {account.hasPassword ? "Ganti password" : "Buat password"}
          </h2>
          <p className="mt-3 font-semibold text-black/65">
            Akun aktif: {account.email ?? account.username ?? "akun legacy"}
          </p>
          <div className="mt-8 border-[3px] border-black bg-white p-4 shadow-neo-sm">
            <Fingerprint className="size-7" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">
              Perubahan credential merotasi session aktif dan mencabut session lama.
            </p>
          </div>
        </div>
        <div className="p-5 sm:p-8">
          {account.hasPassword ? (
            <ChangePasswordForm />
          ) : passwordReauthenticated ? (
            <SetPasswordForm />
          ) : (
            <div className="grid gap-5">
              <p className="font-semibold text-foreground/70">
                Akun ini masuk melalui Google dan belum memiliki password. Verifikasi ulang Google sebelum membuat password pertama.
              </p>
              {GOOGLE_OAUTH_ENABLED ? (
                <a
                  href="/api/auth/google/start?intent=set-password"
                  className="neo-button w-full bg-neo-blue sm:w-fit"
                >
                  Verifikasi Google
                </a>
              ) : (
                <p role="status" className="border-[3px] border-black bg-neo-yellow p-3 font-bold shadow-neo-sm">
                  Google OAuth belum dikonfigurasi pada environment ini.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section
        className="neo-surface grid overflow-hidden bg-white md:grid-cols-[0.8fr_1.2fr]"
        aria-labelledby="google-heading"
      >
        <div className="border-b-[3px] border-black bg-neo-yellow p-6 md:border-r-[3px] md:border-b-0 md:p-8">
          <Link2 className="size-14" aria-hidden="true" />
          <h2 id="google-heading" className="mt-6 text-3xl">Google account</h2>
          <p className="mt-3 font-semibold text-black/65">
            Hubungkan satu Google identity dengan email akun yang sama.
          </p>
        </div>
        <div className="p-5 sm:p-8">
          <GoogleAccountPanel
            connectedEmail={account.googleAccountEmail}
            hasPassword={account.hasPassword}
            enabled={GOOGLE_OAUTH_ENABLED}
          />
        </div>
      </section>

      <section className="neo-surface bg-white p-5 sm:p-8" aria-label="Daftar perangkat aktif">
        <ActiveSessions sessions={sessions} />
      </section>
    </main>
  );
}
