import type { Metadata } from "next";
import { Database, Download, LockKeyhole } from "lucide-react";
import { getPrivacySettingsAction } from "@/features/profile/privacy-actions";
import { AccountLifecycle } from "@/features/profile/components/account-lifecycle";
import { PrivacyPreferencesForm } from "@/features/profile/components/privacy-preferences-form";
import { formatInTimeZone } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Privasi dan Data",
  description: "Kelola izin penyimpanan, export data, dan lifecycle akun JLPT.",
};

const GOOGLE_NOTICE: Record<string, string> = {
  cancelled: "Verifikasi Google dibatalkan.",
  "verification-failed": "Google account belum dapat diverifikasi. Coba lagi.",
  "reauth-mismatch": "Pilih Google account yang sudah terhubung dengan akun ini.",
  "expired-state": "Permintaan verifikasi Google sudah berakhir. Mulai ulang.",
  "session-changed": "Session berubah selama verifikasi. Silakan mulai ulang.",
  "rate-limited": "Terlalu banyak percobaan Google OAuth. Coba lagi nanti.",
  "not-configured": "Google OAuth belum dikonfigurasi pada environment ini.",
  "not-connected": "Google account belum terhubung dengan akun ini.",
  "password-required": "Gunakan password saat ini untuk mengonfirmasi tindakan ini.",
  "deletion-not-pending": "Tidak ada jadwal penghapusan akun yang perlu dibatalkan.",
  "account-unavailable": "Akun tidak tersedia untuk verifikasi Google.",
};

export default async function ProfilePrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{
    google?: string | string[];
    googleReauth?: string | string[];
  }>;
}) {
  const { google, googleReauth } = await searchParams;
  const settings = await getPrivacySettingsAction();
  const scheduledForLabel = settings.deletionScheduledFor
    ? formatInTimeZone(settings.deletionScheduledFor, settings.timeZone, {
        dateStyle: "full",
        timeStyle: "short",
      })
    : null;

  return (
    <main className="grid max-w-4xl gap-6">
      <header>
        <p className="font-mono text-xs font-black tracking-widest uppercase">PROFILE / PRIVACY</p>
        <h1 className="mt-2 text-4xl sm:text-6xl">Privasi & data</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Tentukan data AI yang boleh disimpan, ambil salinan data akun, atau kelola penghapusan akun.
        </p>
      </header>

      <section className="neo-surface overflow-hidden bg-white" aria-labelledby="privacy-heading">
        <div className="flex items-center gap-4 border-b-[3px] border-black bg-neo-blue p-5 sm:p-6">
          <span className="grid size-12 place-items-center border-[3px] border-black bg-white shadow-neo-sm">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 id="privacy-heading" className="text-2xl">Izin penyimpanan AI</h2>
            <p className="text-sm font-semibold text-black/65">Default-deny sebelum modul AI digunakan.</p>
          </div>
        </div>
        <div className="p-5 sm:p-8">
          <PrivacyPreferencesForm
            preferences={{
              allowAudioStorage: settings.allowAudioStorage,
              allowConversationStorage: settings.allowConversationStorage,
            }}
          />
        </div>
      </section>

      <section className="neo-surface bg-white p-5 sm:p-8" aria-labelledby="export-heading">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center border-[3px] border-black bg-neo-yellow shadow-neo-sm">
              <Database className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 id="export-heading" className="text-2xl">Export data akun</h2>
              <p className="mt-1 max-w-xl text-sm font-semibold text-foreground/65">
                Unduh JSON berisi profil, preferensi, progress, attempt, latihan, catatan, dan interaksi artikel. Password, token, session, dan rate-limit tidak disertakan.
              </p>
            </div>
          </div>
          <a href="/api/account/export" download className="neo-button shrink-0 bg-neo-yellow">
            <Download className="size-5" aria-hidden="true" /> Unduh JSON
          </a>
        </div>
      </section>

      <section className="neo-surface overflow-hidden bg-white" aria-labelledby="delete-heading">
        <div className="border-b-[3px] border-black bg-black p-5 text-white sm:p-6">
          <h2 id="delete-heading" className="text-2xl">Hapus akun</h2>
          <p className="mt-1 text-sm font-semibold text-white/70">
            Data user-owned dihapus melalui cascade setelah grace period 7 hari.
          </p>
        </div>
        <div className="p-5 sm:p-8">
          <AccountLifecycle
            scheduledForLabel={scheduledForLabel}
            hasPassword={settings.hasPassword}
            googleConnected={settings.googleConnected}
            googleReauth={typeof googleReauth === "string" ? googleReauth : null}
            googleNotice={typeof google === "string" ? GOOGLE_NOTICE[google] ?? null : null}
          />
        </div>
      </section>
    </main>
  );
}
