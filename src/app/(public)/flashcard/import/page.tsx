import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ImportWizard } from "@/features/flashcard/components/import-wizard";

export const metadata: Metadata = { title: "Impor deck" };

export default async function ImportPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard/import");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/flashcard/add" className="text-sm font-black underline">
        ← Tambah deck
      </Link>

      <h1 className="mt-4 text-3xl font-black">Impor dari file</h1>
      <p className="mt-2 font-bold text-muted-foreground">
        File diproses di browser dan dikirim per batch, jadi ukuran file tidak dibatasi
        oleh server. Tidak ada baris yang masuk sebelum kamu menekan Impor.
      </p>

      <div className="mt-7">
        <ImportWizard defaultDeckName="Impor" />
      </div>
    </main>
  );
}
