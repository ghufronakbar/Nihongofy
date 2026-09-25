import Link from "next/link";
import type { Metadata } from "next";
import { JlptLevel } from "@prisma/client";
import { Search, Upload } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { FEATURES } from "@/constants";
import { JLPT_LEVEL_ORDER } from "@/constants/jlpt";
import { listAdminTestPackages } from "@/features/admin/test-package/queries";

export const metadata: Metadata = { title: "Paket Tes - Admin" };

function percent(part: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function AdminTestPackageListPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const level = JLPT_LEVEL_ORDER.includes(params.level as JlptLevel)
    ? (params.level as JlptLevel)
    : undefined;
  const query = (params.q ?? "").trim();

  const packages = await listAdminTestPackages({ level, query });
  const totalQuestions = packages.reduce((sum, row) => sum + row.questionCount, 0);
  const totalExplained = packages.reduce((sum, row) => sum + row.explainedCount, 0);

  function hrefFor(nextLevel?: string) {
    const search = new URLSearchParams();
    if (nextLevel) search.set("level", nextLevel);
    if (query) search.set("q", query);
    const qs = search.toString();
    return `/admin/test-package${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">Paket Tes</h1>
          <p className="mt-1 text-sm font-semibold text-foreground/70">
            {packages.length} paket · {totalQuestions.toLocaleString("id-ID")} soal ·{" "}
            {percent(totalExplained, totalQuestions)} punya pembahasan
          </p>
        </div>
        <Link
          href="/admin/test-package/import"
          className="neo-button bg-neo-blue text-sm font-extrabold text-white"
        >
          <Upload className="size-4" />
          Import Fixture
        </Link>
      </div>

      {!FEATURES.testPackage && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow px-4 py-2.5 text-sm font-bold text-black shadow-neo-sm">
          Modul paket tes sedang nonaktif untuk publik (FEATURES_TEST_PACKAGE=false). Import dan
          perbaikan di sini tetap tersimpan.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={hrefFor()}
            className={`inline-flex items-center border-2 border-neo-ink px-3 py-1 font-mono text-xs font-black uppercase shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${
              level ? "bg-white text-black" : "bg-neo-ink text-white"
            }`}
          >
            Semua
          </Link>
          {JLPT_LEVEL_ORDER.map((item) => (
            <Link
              key={item}
              href={hrefFor(item)}
              className={`inline-flex items-center border-2 border-neo-ink px-3 py-1 font-mono text-xs font-black uppercase shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${
                level === item ? "bg-neo-ink text-white" : "bg-white text-black"
              }`}
            >
              {item}
            </Link>
          ))}
        </div>

        <form action="/admin/test-package" className="ml-auto flex items-center gap-2">
          {level && <input type="hidden" name="level" value={level} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Cari nama paket"
            className="h-9 w-52 border-2 border-neo-ink bg-white px-3 text-sm font-semibold shadow-neo-sm outline-none focus:bg-neo-paper"
          />
          <button
            type="submit"
            aria-label="Cari paket"
            className="neo-button bg-white text-xs font-extrabold text-black"
          >
            <Search className="size-4" />
          </button>
        </form>
      </div>

      {packages.length === 0 ? (
        <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
          Tidak ada paket yang cocok.
        </div>
      ) : (
        <div className="neo-surface min-w-0 overflow-x-auto border-[3px] border-neo-ink bg-white shadow-neo">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b-[3px] border-neo-ink bg-neo-paper text-left">
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Paket</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Level</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Isi</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Pembahasan</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Attempt</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((row) => (
                <tr key={row.id} className="border-b-2 border-neo-ink/15 last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/test-package/${row.id}`}
                      className="font-black text-neo-ink underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="font-mono text-[11px] text-foreground/50">id {row.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-[10px] font-black shadow-neo-sm">
                      {row.jlptLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold tabular-nums text-foreground/70">
                    {row.questionCount} soal · {row._count.testPackageItems} mondai ·{" "}
                    {row.sessionCount} sesi · {row._count.questionContexts} context
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center border-2 border-neo-ink px-2 py-0.5 font-mono text-[10px] font-black shadow-neo-sm ${
                        row.explainedCount === row.questionCount && row.questionCount > 0
                          ? "bg-neo-paper"
                          : "bg-white"
                      }`}
                    >
                      {percent(row.explainedCount, row.questionCount)}
                    </span>
                    <span className="ml-2 font-mono text-[11px] text-foreground/50">
                      {row.explainedCount}/{row.questionCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold tabular-nums text-foreground/70">
                    {row._count.attempts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
