"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, LogOut, ShieldCheck, ShieldOff, Timer, Undo2 } from "lucide-react";
import {
  cancelUserDeletionAction,
  resetUserRateLimitAction,
  revokeUserSessionAction,
  setUserRoleAction,
  type UserActionResult,
} from "../actions";

export function UserActions({
  userId,
  role,
  isSelf,
  hasDeletionSchedule,
  sessions,
  currentSessionId,
}: {
  userId: number;
  role: "USER" | "ADMIN";
  isSelf: boolean;
  hasDeletionSchedule: boolean;
  sessions: { sessionId: string; deviceName: string; lastSeenAt: string }[];
  currentSessionId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<UserActionResult | null>(null);

  function run(work: () => Promise<UserActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      setNotice(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {notice && (
        <p
          className={`flex items-start gap-2 border-[3px] border-neo-ink px-4 py-2.5 text-sm font-bold shadow-neo-sm ${
            notice.ok ? "bg-white text-neo-ink" : "bg-neo-coral text-white"
          }`}
        >
          {notice.ok && (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 stroke-[2.5] text-neo-blue" />
          )}
          {notice.message}
        </p>
      )}

      <section className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
        <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
          Role
        </p>
        <p className="text-xs font-semibold text-foreground/70">
          Role dibaca dari database setiap request, jadi perubahannya berlaku seketika tanpa user
          perlu login ulang.
        </p>
        <div className="flex flex-wrap gap-2">
          {role === "USER" ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => setUserRoleAction({ userId, role: "ADMIN" }))}
              className="neo-button bg-neo-coral text-xs font-extrabold text-white"
            >
              <ShieldCheck className="size-4" />
              Jadikan Admin
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending || isSelf}
              onClick={() => run(() => setUserRoleAction({ userId, role: "USER" }))}
              className="neo-button bg-white text-xs font-extrabold text-black disabled:opacity-50"
            >
              <ShieldOff className="size-4" />
              Turunkan ke User
            </button>
          )}
          {isSelf && role === "ADMIN" && (
            <span className="self-center font-mono text-[11px] font-bold text-foreground/50">
              Tidak dapat menurunkan role sendiri.
            </span>
          )}
        </div>
      </section>

      <section className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
        <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
          Perangkat aktif ({sessions.length})
        </p>
        {sessions.length === 0 ? (
          <p className="text-xs font-semibold text-foreground/60">
            Tidak ada session aktif di registry.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li
                key={session.sessionId}
                className="flex flex-wrap items-center gap-2 border-2 border-neo-ink/20 px-3 py-2"
              >
                <span className="text-xs font-bold">{session.deviceName}</span>
                {session.sessionId === currentSessionId && (
                  <span className="inline-flex items-center border-2 border-neo-ink bg-neo-yellow px-1.5 py-0 font-mono text-[10px] font-black">
                    session ini
                  </span>
                )}
                <span className="font-mono text-[10px] text-foreground/50">
                  aktif {session.lastSeenAt.slice(0, 16).replace("T", " ")}
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(() => revokeUserSessionAction({ userId, sessionId: session.sessionId }))
                  }
                  className="ml-auto neo-button bg-white text-[11px] font-extrabold text-black"
                >
                  Cabut
                </button>
              </li>
            ))}
          </ul>
        )}
        {sessions.length > 0 && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => revokeUserSessionAction({ userId }))}
            className="neo-button self-start bg-neo-coral text-xs font-extrabold text-white"
          >
            <LogOut className="size-4" />
            Cabut Semua
          </button>
        )}
      </section>

      <section className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
        <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
          Rate limit
        </p>
        <p className="text-xs font-semibold text-foreground/70">
          Mengosongkan bucket yang terikat akun ini: login, register, lupa password, kirim ulang
          verifikasi, dan lifecycle akun. Bucket per alamat IP tidak ikut karena IP mentah memang
          tidak pernah disimpan — bucket itu hilang sendiri setelah jendelanya lewat.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => resetUserRateLimitAction({ userId }))}
          className="neo-button self-start bg-white text-xs font-extrabold text-black"
        >
          <Timer className="size-4" />
          Reset Rate Limit Akun
        </button>
      </section>

      {hasDeletionSchedule && (
        <section className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-neo-coral/10 p-5 shadow-neo">
          <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            Penghapusan akun terjadwal
          </p>
          <p className="text-xs font-semibold text-foreground/70">
            Admin hanya dapat membatalkan, tidak menjadwalkan. Meminta penghapusan akun adalah
            keputusan pemiliknya.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => cancelUserDeletionAction({ userId }))}
            className="neo-button self-start bg-white text-xs font-extrabold text-black"
          >
            <Undo2 className="size-4" />
            Batalkan Penghapusan
          </button>
        </section>
      )}
    </div>
  );
}
