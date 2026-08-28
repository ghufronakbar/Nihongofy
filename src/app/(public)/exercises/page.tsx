import { BrainCircuit, ShieldCheck, Sparkles } from "lucide-react";
import { getPracticeCatalog } from "@/features/practice/actions";
import { PracticeConfigurator } from "@/features/practice/components/practice-configurator";

export default async function ExercisesPage() {
  const catalog = await getPracticeCatalog();
  const availableLevels = new Set(catalog.map((entry) => entry.jlptLevel)).size;
  const availableQuestions = catalog.reduce((total, entry) => total + entry.questionCount, 0);

  return (
    <main className="page-reveal mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <section className="neo-surface neo-grid-paper relative overflow-hidden p-6 sm:p-9">
        <div className="absolute -top-10 -right-8 size-40 rotate-12 border-[3px] border-neo-ink bg-neo-coral opacity-90" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <div className="neo-kicker">
            <Sparkles className="size-4" />
            Feedback langsung
          </div>
          <h1 className="mt-5 text-4xl leading-[0.95] font-black sm:text-6xl">
            Latihan singkat.
            <br />
            Koreksi saat itu juga.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-medium sm:text-lg">
            Pilih satu tipe soal, kerjakan tanpa timer, lalu lihat alasan jawaban setelah setiap
            submit. Hasil latihan ini terpisah dari skor mock JLPT.
          </p>
        </div>

        <div className="relative mt-8 flex flex-wrap gap-3 text-sm font-bold">
          <span className="flex items-center gap-2 border-[3px] border-neo-ink bg-white px-3 py-2 text-black shadow-neo-sm">
            <BrainCircuit className="size-4" />
            {availableLevels} level tersedia
          </span>
          <span className="flex items-center gap-2 border-[3px] border-neo-ink bg-neo-green px-3 py-2 text-black shadow-neo-sm">
            <ShieldCheck className="size-4" />
            {availableQuestions.toLocaleString("id-ID")} soal dari bank existing
          </span>
        </div>
      </section>

      {catalog.length === 0 ? (
        <section className="neo-surface p-8 text-center">
          <h2 className="text-2xl font-black">Bank soal belum siap untuk latihan cepat.</h2>
          <p className="mt-2 text-muted-foreground">
            Tambahkan paket beserta pilihan jawaban, lalu kembali ke halaman ini.
          </p>
        </section>
      ) : (
        <PracticeConfigurator catalog={catalog} />
      )}
    </main>
  );
}
