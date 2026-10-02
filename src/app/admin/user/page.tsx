import Link from "next/link";
import type { Metadata } from "next";
import { Search, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listAdminUsers } from "@/features/admin/user/queries";
import { UserFilterSchema } from "@/features/admin/user/schemas";

export const metadata: Metadata = { title: "User - Admin" };

const TABS = [
  { value: "all", label: "Semua", countKey: "all" },
  { value: "admin", label: "Admin", countKey: "admin" },
  { value: "unverified", label: "Belum verifikasi", countKey: "unverified" },
  { value: "oauth", label: "Punya Google", countKey: "oauth" },
  { value: "pendingDeletion", label: "Menunggu dihapus", countKey: "pendingDeletion" },
  { value: "postingSuspended", label: "Posting dibatasi", countKey: "postingSuspended" },
] as const;

export default async function AdminUserListPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const parsed = UserFilterSchema.safeParse(params.filter);
  const filter = parsed.success ? parsed.data : "all";
  const query = (params.q ?? "").trim();

  const { rows, matching, truncated, pageSize, counts } = await listAdminUsers(filter, query);

  function hrefFor(nextFilter: string) {
    const search = new URLSearchParams({ filter: nextFilter });
    if (query) search.set("q", query);
    return `/admin/user?${search.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">User</h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {counts.all} akun · {counts.admin} admin · {counts.unverified} belum verifikasi email
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={hrefFor(tab.value)}
              className={`inline-flex items-center gap-2 border-2 border-neo-ink px-3 py-1 font-mono text-xs font-black uppercase shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${
                filter === tab.value ? "bg-neo-ink text-white" : "bg-white text-black"
              }`}
            >
              {tab.label}
              <span className="opacity-70">{counts[tab.countKey]}</span>
            </Link>
          ))}
        </div>

        <form action="/admin/user" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="filter" value={filter} />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Cari nama, email, username"
            className="h-9 w-60 border-2 border-neo-ink bg-white px-3 text-sm font-semibold shadow-neo-sm outline-none focus:bg-neo-paper"
          />
          <button
            type="submit"
            aria-label="Cari user"
            className="neo-button bg-white text-xs font-extrabold text-black"
          >
            <Search className="size-4" />
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
          Tidak ada user yang cocok.
        </div>
      ) : (
        <div className="neo-surface min-w-0 overflow-x-auto border-[3px] border-neo-ink bg-white shadow-neo">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b-[3px] border-neo-ink bg-neo-paper text-left">
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Akun</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Status</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Aktivitas</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Bergabung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b-2 border-neo-ink/15 last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/user/${row.id}`}
                      className="inline-flex items-center gap-1.5 font-black text-neo-ink underline-offset-4 hover:underline"
                    >
                      {row.role === "ADMIN" && (
                        <ShieldCheck className="size-4 shrink-0 stroke-[2.5] text-neo-coral" />
                      )}
                      {row.displayName}
                    </Link>
                    <p className="font-mono text-[11px] text-foreground/60">
                      #{row.id} · {row.email ?? row.username ?? "tanpa email"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.emailVerifiedAt ? (
                        <span className="inline-flex items-center border-2 border-neo-ink bg-neo-paper px-1.5 py-0 font-mono text-[10px] font-black">
                          verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center border-2 border-neo-ink bg-white px-1.5 py-0 font-mono text-[10px] font-black">
                          belum verifikasi
                        </span>
                      )}
                      {row._count.oauthAccounts > 0 && (
                        <span className="inline-flex items-center border-2 border-neo-ink bg-white px-1.5 py-0 font-mono text-[10px] font-black">
                          google
                        </span>
                      )}
                      {row.deletionScheduledFor && (
                        <span className="inline-flex items-center border-2 border-neo-ink bg-neo-coral px-1.5 py-0 font-mono text-[10px] font-black text-white">
                          dijadwalkan hapus
                        </span>
                      )}
                      {row.postingSuspendedAt && (
                        <span className="inline-flex items-center border-2 border-neo-ink bg-neo-yellow px-1.5 py-0 font-mono text-[10px] font-black">
                          posting dibatasi
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold tabular-nums text-foreground/70">
                    {row._count.attempts} attempt · {row._count.questionComments} catatan
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-foreground/60">
                    {row.createdAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {truncated && (
        <p className="text-xs font-semibold text-foreground/60">
          Menampilkan {pageSize} dari {matching} akun yang cocok. Persempit dengan pencarian —
          pagination belum ada.
        </p>
      )}
    </div>
  );
}
