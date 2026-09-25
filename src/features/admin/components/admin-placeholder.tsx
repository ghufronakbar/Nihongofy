import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";

// Sidebar admin memuat seluruh area yang direncanakan, jadi area yang belum
// dikerjakan perlu halaman yang jujur menyebut statusnya alih-alih 404 yang
// tampak seperti bug. Hapus placeholder-nya begitu tahapnya selesai.
export function AdminPlaceholder({
  title,
  stage,
  description,
}: {
  title: string;
  stage: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">{title}</h1>
        <p className="mt-1 font-mono text-xs font-bold uppercase text-foreground/60">
          Belum dikerjakan
        </p>
      </div>

      <div className="neo-surface flex flex-col gap-4 border-[3px] border-neo-ink bg-white p-6 shadow-neo">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border-2 border-neo-ink bg-neo-yellow shadow-neo-sm">
            <Construction className="size-5 stroke-[2.5] text-black" />
          </div>
          <span className="inline-flex items-center border-2 border-neo-ink bg-neo-paper px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-neo-sm">
            {stage}
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground/80">{description}</p>
        <p className="text-xs font-semibold text-foreground/60">
          Checklist dan urutan pengerjaannya ada di{" "}
          <code className="font-mono font-bold">docs/plan.md</code>, rancangan lengkapnya di{" "}
          <code className="font-mono font-bold">docs/module/admin.md</code>.
        </p>
        <Link
          href="/admin"
          className="neo-button self-start bg-white text-xs font-extrabold text-black"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Overview
        </Link>
      </div>
    </div>
  );
}
