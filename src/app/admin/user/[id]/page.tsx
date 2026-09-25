import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getAdminUserDetail } from "@/features/admin/user/queries";
import { UserActions } from "@/features/admin/user/components/user-actions";

export const metadata: Metadata = { title: "Detail User - Admin" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 border-b-2 border-neo-ink/10 py-1.5 last:border-b-0">
      <span className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/50">
        {label}
      </span>
      <span className="ml-auto text-xs font-semibold text-foreground/85">{value}</span>
    </div>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) notFound();

  const detail = await getAdminUserDetail(userId);
  if (!detail) notFound();

  const { user, hasPassword, lastAttempt, sessions } = detail;
  const isSelf = user.id === actor.user.id;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/user"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">
            {user.displayName}
          </h1>
          {user.role === "ADMIN" && (
            <span className="inline-flex items-center gap-1 border-2 border-neo-ink bg-neo-coral px-2.5 py-0.5 font-mono text-xs font-black text-white shadow-neo-sm">
              <ShieldCheck className="size-3.5 stroke-[2.5]" />
              ADMIN
            </span>
          )}
          {isSelf && (
            <span className="inline-flex items-center border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black shadow-neo-sm">
              kamu
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-[11px] text-foreground/60">
          #{user.id} · {user.email ?? user.username ?? "tanpa email"}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="neo-surface flex flex-col border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <p className="mb-2 font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            Akun
          </p>
          <Row
            label="Email"
            value={user.emailVerifiedAt ? "terverifikasi" : "belum diverifikasi"}
          />
          <Row
            label="Metode masuk"
            value={
              <span className="inline-flex items-center gap-1.5">
                <KeyRound className="size-3.5" />
                {hasPassword ? "password" : "tanpa password"}
                {user.oauthAccounts.length > 0 &&
                  ` + ${user.oauthAccounts.map((account) => account.provider).join(", ")}`}
              </span>
            }
          />
          <Row label="Zona waktu" value={user.timeZone} />
          <Row
            label="Simpan audio"
            value={user.allowAudioStorage ? "diizinkan" : "tidak diizinkan"}
          />
          <Row
            label="Simpan transcript"
            value={user.allowConversationStorage ? "diizinkan" : "tidak diizinkan"}
          />
          <Row label="Bergabung" value={user.createdAt.toISOString().slice(0, 10)} />
          {user.deletionScheduledFor && (
            <Row
              label="Dihapus pada"
              value={user.deletionScheduledFor.toISOString().slice(0, 10)}
            />
          )}
        </section>

        <section className="neo-surface flex flex-col border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <p className="mb-2 font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            Aktivitas
          </p>
          <Row label="Attempt" value={user._count.attempts} />
          <Row
            label="Attempt terakhir"
            value={
              lastAttempt
                ? `${lastAttempt.startedAt.toISOString().slice(0, 10)} (${lastAttempt.status})`
                : "belum pernah"
            }
          />
          <Row label="Latihan cepat" value={user._count.practiceSessions} />
          <Row label="Catatan soal" value={user._count.questionComments} />
          <Row label="Kartu flashcard" value={user._count.flashcardCards} />
          <Row label="Sesi percakapan" value={user._count.conversationSessions} />
          <Row label="Token auth aktif" value={user._count.authTokens} />
        </section>
      </div>

      <p className="text-xs font-semibold text-foreground/60">
        Password dan isi token tidak pernah dibaca oleh layar ini — hanya keberadaannya yang
        dihitung.
      </p>

      <UserActions
        userId={user.id}
        role={user.role}
        isSelf={isSelf}
        hasDeletionSchedule={Boolean(user.deletionScheduledFor)}
        sessions={sessions.map((session) => ({
          sessionId: session.sessionId,
          deviceName: session.deviceName,
          lastSeenAt: session.lastSeenAt,
        }))}
        currentSessionId={actor.sessionId}
      />
    </div>
  );
}
