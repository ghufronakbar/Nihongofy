import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Terminal } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import {
  getExplanationCounts,
  getMissingBySection,
  listExplanationQueue,
  listPackageExplanationCoverage,
} from "@/features/admin/explanation/queries";
import { ExplanationQueueFilterSchema } from "@/features/admin/explanation/schemas";
import { mondaiTypeFullLabel } from "@/constants/jlpt";

export const metadata: Metadata = { title: "Pembahasan - Admin" };

const TABS = [
  { value: "unreviewed", label: "AI belum direview" },
  { value: "doubt", label: "Kunci meragukan" },
  { value: "missing", label: "Belum ada" },
  { value: "reviewed", label: "Sudah direview" },
] as const;

export default async function AdminExplanationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; pkg?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const parsed = ExplanationQueueFilterSchema.safeParse(params.filter);
  const filter = parsed.success ? parsed.data : "unreviewed";
  const packageIdRaw = Number(params.pkg);
  const packageId =
    Number.isInteger(packageIdRaw) && packageIdRaw > 0 ? packageIdRaw : undefined;

  const [counts, queue, coverage, missingBySection] = await Promise.all([
    getExplanationCounts(),
    listExplanationQueue(filter, packageId),
    listPackageExplanationCoverage(),
    getMissingBySection(),
  ]);

  const countFor = (value: (typeof TABS)[number]["value"]) => counts[value];
  const activePackage = coverage.find((row) => row.id === packageId);
  const incomplete = coverage.filter((row) => row.missing > 0);

  function hrefFor(nextFilter: string, nextPackage?: number) {
    const search = new URLSearchParams({ filter: nextFilter });
    if (nextPackage) search.set("pkg", String(nextPackage));
    return `/admin/explanation?${search.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">Pembahasan</h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {counts.total.toLocaleString("id-ID")} soal · {counts.missing.toLocaleString("id-ID")}{" "}
          belum punya pembahasan · {counts.unreviewed.toLocaleString("id-ID")} tulisan AI belum
          direview · {counts.reviewed.toLocaleString("id-ID")} sudah disetujui
        </p>
      </div>

      {counts.doubt > 0 && (
        <Link
          href={hrefFor("doubt")}
          className="flex items-center gap-2 border-[3px] border-neo-ink bg-neo-coral px-4 py-2.5 text-sm font-bold text-white shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px]"
        >
          <AlertTriangle className="size-4 shrink-0 stroke-[2.5]" />
          {counts.doubt} soal punya kunci jawaban yang ditandai meragukan generator. Periksa ini
          lebih dulu — pembahasannya tidak dapat disetujui sampai keraguannya ditutup.
        </Link>
      )}

      <div className="neo-surface flex flex-col gap-2 border-[3px] border-neo-ink bg-neo-paper p-5 shadow-neo">
        <p className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
          <Terminal className="size-3.5" />
          Pembuatan pembahasan tetap lewat CLI
        </p>
        <p className="text-xs font-semibold text-foreground/80">
          Generator membaca dan menulis file fixture di{" "}
          <code className="font-mono">src/test-package-data/</code> dan tidak menyentuh database,
          sehingga hasilnya perlu ikut masuk repository. Karena itu tidak ada tombol generate di
          sini; jalankan dari mesin kamu, lalu impor hasilnya.
        </p>
        <pre className="overflow-x-auto border-2 border-neo-ink bg-white p-3 font-mono text-[11px] font-semibold">
          {`npm run gen:explanation -- --file <nama-file>.json\nnpm run seed:question-explanation`}
        </pre>
        <p className="text-xs font-semibold text-foreground/60">
          Layar ini untuk memutuskan file mana yang dikerjakan, lalu meninjau hasilnya.
        </p>
      </div>

      {filter === "missing" && missingBySection.choukai > 0 && (
        <div className="neo-surface flex flex-col gap-2 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <p className="text-sm font-black text-neo-ink">
            {missingBySection.choukai.toLocaleString("id-ID")} dari{" "}
            {counts.missing.toLocaleString("id-ID")} soal tanpa pembahasan adalah CHOUKAI
          </p>
          <p className="text-xs font-semibold text-foreground/70">
            Generator melewati CHOUKAI secara bawaan: fixture hanya menyimpan URL audio tanpa
            transkrip, jadi model tidak punya bahan dan hanya akan mengarang. Sisa ini tertahan
            oleh transkripsi audio, bukan oleh kapasitas review — mengejarnya lewat layar ini
            tidak akan menggerakkan angkanya.
            {missingBySection.otherTotal > 0
              ? ` Sisanya ${missingBySection.otherTotal.toLocaleString("id-ID")} soal non-CHOUKAI memang dapat digenerate sekarang.`
              : " Tidak ada soal non-CHOUKAI yang tertinggal."}
          </p>
        </div>
      )}

      {incomplete.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
            Paket yang belum lengkap
          </h2>
          <div className="flex flex-wrap gap-2">
            {incomplete.map((row) => (
              <Link
                key={row.id}
                href={hrefFor("missing", row.id)}
                className={`inline-flex items-center gap-2 border-2 border-neo-ink px-3 py-1.5 text-xs font-bold shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${
                  packageId === row.id ? "bg-neo-ink text-white" : "bg-white text-black"
                }`}
              >
                <span className="font-mono text-[10px] font-black">{row.jlptLevel}</span>
                {row.name}
                <span className="font-mono text-[10px] opacity-70">
                  {row.missing}/{row.total} kosong
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={hrefFor(tab.value, packageId)}
            className={`inline-flex items-center gap-2 border-2 border-neo-ink px-3 py-1 font-mono text-xs font-black uppercase shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${
              filter === tab.value ? "bg-neo-ink text-white" : "bg-white text-black"
            }`}
          >
            {tab.label}
            <span className="opacity-70">{countFor(tab.value).toLocaleString("id-ID")}</span>
          </Link>
        ))}
      </div>

      {activePackage && (
        <p className="text-sm font-semibold text-foreground/70">
          Difilter ke {activePackage.name}.{" "}
          <Link href={hrefFor(filter)} className="font-black underline">
            Semua paket
          </Link>
        </p>
      )}

      {queue.rows.length === 0 ? (
        <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
          Tidak ada soal pada kategori ini.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.rows.map((row) => (
            <li
              key={row.id}
              className="neo-surface flex flex-col gap-2 border-[3px] border-neo-ink bg-white p-4 shadow-neo"
            >
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold text-foreground/60">
                <span className="inline-flex items-center border-2 border-neo-ink bg-neo-yellow px-1.5 py-0 font-black">
                  {row.testPackageItem.testPackage.jlptLevel}
                </span>
                <span>{row.testPackageItem.testPackage.name}</span>
                <span>· {mondaiTypeFullLabel(row.testPackageItem.mondaiType)}</span>
                <span>· soal {row.order}</span>
                <span className="ml-auto">kunci {row.questionAnswer}</span>
              </div>

              <Link
                href={`/admin/explanation/${row.id}?filter=${filter}`}
                className="font-japanese line-clamp-2 font-semibold text-neo-ink underline-offset-4 hover:underline"
              >
                {row.questionText.trim() || (
                  <span className="font-sans text-foreground/50">(tanpa teks — soal audio)</span>
                )}
              </Link>

              {row.explanation?.summary && (
                <p className="font-japanese line-clamp-2 text-xs font-semibold text-foreground/60">
                  {row.explanation.summary}
                </p>
              )}

              {row.explanation?.answerKeyDoubt && row.explanation.answerKeyDoubtNote && (
                <p className="flex items-start gap-1.5 text-xs font-bold text-neo-coral">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 stroke-[2.5]" />
                  {row.explanation.answerKeyDoubtNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {queue.truncated && (
        <p className="text-xs font-semibold text-foreground/60">
          Menampilkan {queue.pageSize} dari {queue.matching.toLocaleString("id-ID")} soal yang
          cocok. Persempit dengan memilih paket — pagination belum ada.
        </p>
      )}
    </div>
  );
}
