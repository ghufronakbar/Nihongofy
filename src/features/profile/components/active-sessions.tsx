"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Laptop, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { logoutOtherSessionsAction, revokeSessionAction } from "../actions";

type SessionItem = {
  sessionId: string;
  deviceName: string;
  createdAtLabel: string;
  lastSeenAtLabel: string;
  expiresAtLabel: string;
  current: boolean;
};

export function ActiveSessions({ sessions }: { sessions: SessionItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  function runAction(action: () => Promise<{ ok: boolean; message: string }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) router.refresh();
    });
  }

  const otherSessionCount = sessions.filter((session) => !session.current).length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 border-b-[3px] border-black pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl">Perangkat aktif</h2>
          <p className="mt-1 text-sm font-semibold text-foreground/65">
            Session berakhir otomatis setelah tujuh hari.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending || otherSessionCount === 0}
          onClick={() => runAction(logoutOtherSessionsAction)}
          className="neo-button bg-neo-coral text-white"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Logout semua perangkat lain
        </button>
      </div>

      {notice ? (
        <p
          role={notice.ok ? "status" : "alert"}
          className={`border-[3px] border-black p-3 font-bold text-black shadow-neo-sm ${notice.ok ? "bg-neo-green" : "bg-neo-coral"}`}
        >
          {notice.message}
        </p>
      ) : null}

      <div className="grid gap-4">
        {sessions.map((session) => {
          const DeviceIcon = /iOS|Android/.test(session.deviceName) ? Smartphone : Laptop;
          return (
            <article
              key={session.sessionId}
              className={`grid gap-4 border-[3px] border-black p-4 shadow-neo-sm sm:grid-cols-[auto_1fr_auto] sm:items-center ${session.current ? "bg-neo-green" : "bg-white"}`}
            >
              <span className="grid size-11 place-items-center border-[3px] border-black bg-neo-paper shadow-neo-sm">
                <DeviceIcon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg">{session.deviceName}</h3>
                  {session.current ? (
                    <span className="inline-flex items-center gap-1 border-2 border-black bg-white px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                      <ShieldCheck className="size-3" aria-hidden="true" /> Saat ini
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs font-semibold text-foreground/70">
                  Dibuat {session.createdAtLabel} · Aktivitas {session.lastSeenAtLabel}
                </p>
                <p className="mt-1 text-xs font-semibold text-foreground/55">
                  Kedaluwarsa {session.expiresAtLabel}
                </p>
              </div>
              {!session.current ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction(() => revokeSessionAction({ sessionId: session.sessionId }))
                  }
                  className="neo-button bg-white"
                >
                  Keluarkan
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
