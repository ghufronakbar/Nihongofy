import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { ImportTestPackageForm } from "@/features/admin/test-package/components/import-form";

export const metadata: Metadata = { title: "Import Paket - Admin" };

export default async function AdminTestPackageImportPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/test-package"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-foreground/60 hover:text-neo-blue"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar
        </Link>
        <h1 className="mt-2 text-2xl font-black uppercase text-neo-ink sm:text-3xl">
          Import Fixture
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          Memakai kontrak dan jalur tulis yang sama persis dengan{" "}
          <code className="font-mono">npm run seed:test-package</code>. Kontraknya
          didokumentasikan di <code className="font-mono">docs/seed.md</code>.
        </p>
      </div>

      <ul className="neo-surface flex list-disc flex-col gap-1.5 border-[3px] border-neo-ink bg-neo-paper p-5 pl-9 text-xs font-semibold text-foreground/80 shadow-neo">
        <li>Satu file JSON berisi satu paket tes. Nama paket di dalam JSON yang menjadi kunci, bukan nama filenya.</li>
        <li>Import berjalan dalam satu transaksi dengan advisory lock per nama paket; paket separuh jadi tidak mungkin tertinggal.</li>
        <li>Paket yang sudah ada dan isinya cocok akan dilewati. Yang berbeda ditolak sampai kamu sengaja memilih mengganti.</li>
        <li>Penggantian selalu ditolak bila paket sudah punya attempt, supaya hasil pengerjaan user tidak ikut hilang.</li>
      </ul>

      <ImportTestPackageForm />
    </div>
  );
}
