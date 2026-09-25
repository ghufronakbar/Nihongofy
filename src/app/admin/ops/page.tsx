import Link from "next/link";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { FEATURES } from "@/constants";
import { INVALIDATABLE_TAGS, type InvalidatableTag } from "@/features/admin/ops/cache-tags";
import { getAuditLogTotal, listAdminAuditLog } from "@/features/admin/ops/queries";
import { CacheInvalidator } from "@/features/admin/ops/components/cache-invalidator";

export const metadata: Metadata = { title: "Operasional - Admin" };

export default async function AdminOpsPage() {
  await requireAdmin();

  const [auditLog, auditTotal] = await Promise.all([listAdminAuditLog(), getAuditLogTotal()]);
  const flags = Object.entries(FEATURES) as [string, boolean][];
  const tags = (Object.keys(INVALIDATABLE_TAGS) as InvalidatableTag[]).map((key) => ({
    key,
    value: INVALIDATABLE_TAGS[key],
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">Operasional</h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          Status feature flag, invalidasi cache manual, dan jejak aksi admin.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Feature flag
        </h2>
        <p className="flex items-start gap-2 text-xs font-semibold text-foreground/70">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Read-only. Flag dibaca sekali saat server start dari environment variable, jadi
          mengubahnya butuh ubah env lalu restart atau redeploy. Membuatnya dapat diubah dari sini
          berarti memindahkannya ke database atau Edge Config — perubahan arsitektur tersendiri.
        </p>
        <div className="neo-surface grid gap-x-6 gap-y-1 border-[3px] border-neo-ink bg-white p-5 shadow-neo sm:grid-cols-2">
          {flags.map(([name, enabled]) => (
            <div
              key={name}
              className="flex items-center justify-between border-b-2 border-neo-ink/10 py-1.5"
            >
              <span className="font-mono text-xs font-bold">{name}</span>
              <span
                className={`inline-flex items-center border-2 border-neo-ink px-2 py-0 font-mono text-[10px] font-black uppercase ${
                  enabled ? "bg-neo-paper" : "bg-neo-coral text-white"
                }`}
              >
                {enabled ? "aktif" : "mati"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Invalidasi cache
        </h2>
        <p className="text-xs font-semibold text-foreground/70">
          Hanya tag global. Tag per-entitas sudah diinvalidasi otomatis oleh action yang mengubah
          entitasnya, dan menyediakan tombolnya di sini hanya akan mengundang tebakan id.
        </p>
        <div className="neo-surface border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <CacheInvalidator tags={tags} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Jejak aksi admin ({auditTotal})
        </h2>
        <p className="text-xs font-semibold text-foreground/70">
          Ditulis di transaksi yang sama dengan mutasinya bila aksinya menyentuh database, jadi
          tidak ada perubahan yang tersimpan tanpa catatannya. Baris log tidak pernah diubah atau
          dihapus oleh aplikasi.
        </p>
        {auditLog.length === 0 ? (
          <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
            Belum ada aksi admin yang tercatat.
          </div>
        ) : (
          <div className="neo-surface min-w-0 overflow-x-auto border-[3px] border-neo-ink bg-white shadow-neo">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b-[3px] border-neo-ink bg-neo-paper text-left">
                  <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Waktu</th>
                  <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Aktor</th>
                  <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Aksi</th>
                  <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((row) => (
                  <tr key={row.id} className="border-b-2 border-neo-ink/15 align-top last:border-b-0">
                    <td className="px-4 py-2 font-mono text-[11px] whitespace-nowrap">
                      {row.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-2 text-xs font-bold">
                      {row.actorId ? (
                        <Link
                          href={`/admin/user/${row.actorId}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {row.actorName}
                        </Link>
                      ) : (
                        // Hanya terjadi bila baris User benar-benar hilang. Alur
                        // normal menganonimkan, bukan menghapus, sehingga actorId
                        // tetap ada dan actorName sudah diganti oleh anonimisasi.
                        <span className="text-foreground/50">{row.actorName} (akun hilang)</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center border-2 border-neo-ink bg-white px-1.5 py-0 font-mono text-[10px] font-black">
                        {row.action}
                      </span>
                      {row.targetId && (
                        <span className="ml-1.5 font-mono text-[10px] text-foreground/50">
                          {row.targetType} #{row.targetId}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs font-semibold text-foreground/80">
                      {row.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
