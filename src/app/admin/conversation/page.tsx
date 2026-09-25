import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, EyeOff, Timer } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { FEATURES } from "@/constants";
import {
  getConversationOverview,
  listFlaggedTurns,
} from "@/features/admin/conversation/queries";

export const metadata: Metadata = { title: "Conversation - Admin" };

function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds} detik`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

export default async function AdminConversationPage() {
  await requireAdmin();

  const [overview, flaggedTurns] = await Promise.all([
    getConversationOverview(),
    listFlaggedTurns(),
  ]);

  const { totals, sessions, flagged, staleRetention, quotaRows } = overview;
  const totalTokens = totals.inputTokens + totals.outputTokens;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">Conversation</h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          Pemakaian 30 hari terakhir: {totals.turns.toLocaleString("id-ID")} turn ·{" "}
          {formatDuration(totals.audioSeconds)} audio · {totalTokens.toLocaleString("id-ID")} token
        </p>
      </div>

      {!FEATURES.conversation && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow px-4 py-2.5 text-sm font-bold text-black shadow-neo-sm">
          Modul percakapan sedang nonaktif untuk publik (FEATURES_CONVERSATION=false). Data lama
          tetap ada dan terbaca di sini.
        </p>
      )}

      <div className="neo-surface flex flex-col gap-2 border-[3px] border-neo-ink bg-neo-paper p-5 shadow-neo">
        <p className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
          <EyeOff className="size-3.5" />
          Consent user mengikat admin
        </p>
        <p className="text-xs font-semibold text-foreground/80">
          Isi percakapan hanya ditampilkan untuk session yang izin penyimpanan transcript-nya aktif.
          Angka pemakaian di bawah tetap terkumpul walau transcript tidak disimpan — itu memang
          alasan <code className="font-mono">ConversationQuota</code> dipisah dari isi turn.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="neo-surface border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            Session
          </p>
          <p className="mt-2 text-2xl font-black text-neo-ink">
            {sessions.reduce((sum, row) => sum + row._count._all, 0)}
          </p>
          <p className="mt-1 text-xs font-semibold text-foreground/70">
            {sessions.map((row) => `${row.status.toLowerCase()} ${row._count._all}`).join(" · ") ||
              "belum ada"}
          </p>
        </div>

        <div className="neo-surface border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            Turn ditandai moderation
          </p>
          <p className="mt-2 text-2xl font-black text-neo-ink">{flagged}</p>
          <p className="mt-1 text-xs font-semibold text-foreground/70">
            {flagged === 0 ? "tidak ada" : "perlu ditinjau"}
          </p>
        </div>

        <div className="neo-surface border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <p className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
            Retensi lewat
          </p>
          <p className="mt-2 text-2xl font-black text-neo-ink">{staleRetention}</p>
          <p className="mt-1 text-xs font-semibold text-foreground/70">
            session yang transcript-nya melewati masa simpan
          </p>
        </div>
      </div>

      {staleRetention > 0 && (
        <p className="flex items-start gap-2 border-[3px] border-neo-ink bg-neo-coral px-4 py-2.5 text-sm font-bold text-white shadow-neo-sm">
          <Timer className="mt-0.5 size-4 shrink-0 stroke-[2.5]" />
          {staleRetention} session sudah melewati <code className="font-mono">retentionExpiresAt</code>{" "}
          tetapi transcript-nya masih tersimpan. Pembersihannya belum otomatis dan belum ada aksi
          di layar ini — lihat Tahap 7 di docs/plan.md.
        </p>
      )}

      {flaggedTurns.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
            Turn ditandai moderation
          </h2>
          <ul className="flex flex-col gap-3">
            {flaggedTurns.map((turn) => (
              <li
                key={turn.id}
                className="neo-surface flex flex-col gap-2 border-[3px] border-neo-ink bg-white p-4 shadow-neo"
              >
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold text-foreground/60">
                  <AlertTriangle className="size-3.5 stroke-[2.5] text-neo-coral" />
                  <span>{turn.role}</span>
                  <Link
                    href={`/admin/user/${turn.session.user.id}`}
                    className="font-black text-neo-ink underline-offset-4 hover:underline"
                  >
                    {turn.session.user.displayName}
                  </Link>
                  <span>
                    · {turn.session.mode} · {turn.session.jlptLevel}
                  </span>
                  <span className="ml-auto">
                    {turn.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                {turn.contentJa ? (
                  <p className="font-japanese text-sm font-semibold whitespace-pre-wrap text-foreground/85">
                    {turn.contentJa}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-foreground/50">
                    Isi tidak ditampilkan: user tidak mengizinkan penyimpanan transcript untuk
                    session ini.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Pemakaian harian per user
        </h2>
        {quotaRows.length === 0 ? (
          <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
            Belum ada pemakaian dalam 30 hari terakhir.
          </div>
        ) : (
          <div className="neo-surface min-w-0 overflow-x-auto border-[3px] border-neo-ink bg-white shadow-neo">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b-[3px] border-neo-ink bg-neo-paper text-left">
                  <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Tanggal</th>
                  <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">User</th>
                  <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Turn</th>
                  <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Audio</th>
                  <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Token</th>
                </tr>
              </thead>
              <tbody>
                {quotaRows.map((row) => (
                  <tr key={row.id} className="border-b-2 border-neo-ink/15 last:border-b-0">
                    <td className="px-4 py-2 font-mono text-[11px]">
                      {row.quotaDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/user/${row.user.id}`}
                        className="font-bold text-neo-ink underline-offset-4 hover:underline"
                      >
                        {row.user.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 tabular-nums font-semibold">{row.turnCount}</td>
                    <td className="px-4 py-2 tabular-nums font-semibold">
                      {formatDuration(row.audioSeconds)}
                    </td>
                    <td className="px-4 py-2 tabular-nums font-semibold">
                      {(row.inputTokens + row.outputTokens).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs font-semibold text-foreground/60">
          Kuota dicatat tetapi belum ditegakkan — tidak ada batas yang menolak turn baru. Lihat
          catatan di <code className="font-mono">ConversationQuota</code>.
        </p>
      </section>
    </div>
  );
}
