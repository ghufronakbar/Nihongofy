import Link from "next/link";
import { PageContainer } from "@/components/marketing/page-container";
import { ClashEntry } from "@/features/kotoba-clash/components/entry";
import { ClashShowcase } from "@/features/kotoba-clash/components/arena-ui";
import { ArrowLeft, Swords } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Kotoba Clash", description: "Latihan kuis JLPT N5-N1 sendiri atau battle bersama 2-20 pemain. Undang teman melalui kode atau link, termasuk guest.", path: "/mini-games/kotoba-clash" });

export default async function KotobaClashPage() {
  const session = await getSessionUser();
  return (
    <PageContainer className="py-8 md:py-12">
      <Link href="/mini-games" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4"><ArrowLeft className="size-4" />Semua Mini Games</Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-14">
        <div>
          <span className="clash-sticker mb-5 text-xs"><Swords className="size-4" />TEMAN BELAJAR. LAWAN TANDING.</span>
          <h1 className="text-6xl leading-[0.88] font-black tracking-[-0.06em] sm:text-8xl">KOTOBA<br /><span className="text-neo-blue">CLASH.</span></h1>
          <p className="mt-6 max-w-md text-lg leading-7 font-medium text-pretty">Asah kemampuan JLPT sendiri atau ajak teman beradu cepat dan tepat merebut podium.</p>
          <dl className="my-7 grid grid-cols-3 border-y-[3px] border-neo-ink py-4">
            <div><dt className="clash-label">Pemain</dt><dd className="mt-1 text-lg font-black sm:text-2xl">Solo / 2-20</dd></div>
            <div><dt className="clash-label">Level</dt><dd className="mt-1 text-2xl font-black">N5-N1</dd></div>
            <div><dt className="clash-label">Soal</dt><dd className="mt-1 text-2xl font-black">5-20</dd></div>
          </dl>
          <ClashShowcase />
        </div>
        <ClashEntry authenticated={Boolean(session)} displayName={session?.user.displayName} />
      </div>
      <ol className="mt-10 grid gap-5 border-t-[3px] border-neo-ink pt-6 sm:grid-cols-3">
        {[{ title: "Pilih cara main", text: "Main sendiri atau bagikan undangan ke teman. Guest juga bisa ikut multiplayer." }, { title: "Atur tantangan", text: "Pilih level dan tipe soal. Solo langsung mulai; multiplayer menunggu semua ready." }, { title: "Sambung streak", text: "Jawab tepat, kejar poin, dan pelajari pembahasan setiap soal." }].map((step, index) => <li key={step.title} className="flex gap-3"><span className="font-mono text-3xl font-black text-neo-blue">0{index + 1}</span><div><h2 className="font-black">{step.title}</h2><p className="mt-1 text-sm leading-6 text-neo-ink/70">{step.text}</p></div></li>)}
      </ol>
    </PageContainer>
  );
}
