import Link from "next/link";
import { PageContainer } from "@/components/marketing/page-container";
import { ClashEntry } from "@/features/kotoba-clash/components/entry";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Kotoba Clash", description: "Battle kuis JLPT N5-N1 untuk 2-20 pemain. Undang teman melalui kode atau link, termasuk guest.", path: "/mini-games/kotoba-clash" });

export default async function KotobaClashPage() {
  const session = await getSession();
  return (
    <PageContainer className="py-10 md:py-16">
      <Link href="/mini-games" className="text-sm font-bold underline underline-offset-4">Semua Mini Games</Link>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <h1 className="page-reveal text-5xl leading-none font-black tracking-tight sm:text-7xl">KOTOBA<br /><span className="text-neo-blue">CLASH.</span></h1>
          <p className="mt-6 max-w-lg text-lg leading-8">Tantang temanmu menjawab soal JLPT. Jawab benar, kejar waktu, bangun streak.</p>
          <dl className="mt-9 grid grid-cols-3 border-y-[3px] border-neo-ink py-5">
            <div><dt className="text-sm">Pemain</dt><dd className="mt-1 text-2xl font-black">2-20</dd></div>
            <div><dt className="text-sm">Level</dt><dd className="mt-1 text-2xl font-black">N5-N1</dd></div>
            <div><dt className="text-sm">Soal</dt><dd className="mt-1 text-2xl font-black">5-20</dd></div>
          </dl>
          <ol className="mt-8 space-y-4 leading-7">
            <li><strong>1. Kumpul di room.</strong> Host masuk akun; teman boleh bergabung sebagai guest.</li>
            <li><strong>2. Sepakati tantangan.</strong> Pilih level, tipe soal teks, dan jumlah soal. Semua ready.</li>
            <li><strong>3. Main serentak.</strong> Satu soal setiap ronde, lalu jawaban dan pembahasan terbuka bersama.</li>
          </ol>
        </div>
        <ClashEntry authenticated={Boolean(session)} />
      </div>
    </PageContainer>
  );
}
