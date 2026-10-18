import Link from "next/link";
import { ArrowLeft, Keyboard } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { RaceEntry } from "@/features/kana-word-race/components/entry";
import { getSessionUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Kana Word Race", description: "Adu cepat menebak kata Jepang dalam 6 kesempatan. Mainkan 3-7 kana sendiri atau bersama 2-20 pemain melalui room privat.", path: "/mini-games/kana-word-race" });

export default async function KanaRacePage() {
  const session = await getSessionUser();
  return <PageContainer className="py-8 md:py-12">
    <Link href="/mini-games" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4"><ArrowLeft className="size-4" />Semua Mini Games</Link>
    <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
      <div><span className="race-sticker mb-5 text-xs"><Keyboard className="size-4" />SATU KATA. ENAM KESEMPATAN.</span><h1 className="text-6xl leading-[.88] font-black tracking-[-.06em] sm:text-8xl">KANA<br />WORD<br /><span className="text-emerald-700 dark:text-emerald-400">RACE.</span></h1><p className="mt-6 max-w-md text-lg leading-7 font-medium text-pretty">Baca petunjuk warnanya, temukan katanya, lalu kejar waktu. Main sendiri atau adu cepat bersama teman. Seberapa cepat kamu menemukannya?</p>
        <dl className="my-7 grid grid-cols-3 border-y-[3px] border-current py-4"><div><dt className="race-eyebrow">Pemain</dt><dd className="mt-1 text-2xl font-black">1-20</dd></div><div><dt className="race-eyebrow">Karakter</dt><dd className="mt-1 text-2xl font-black">3-7</dd></div><div><dt className="race-eyebrow">Tebakan</dt><dd className="mt-1 text-2xl font-black">6</dd></div></dl>
        <div className="race-panel race-demo"><div className="mb-5 flex flex-wrap items-center justify-between gap-2"><p className="race-eyebrow">Pratinjau papan</p><span className="race-tag" lang="ja">Target contoh: さくら</span></div><div className="mx-auto grid max-w-xs grid-cols-3 gap-3" aria-label="さかな: さ tepat posisi, か tidak ada, な tidak ada">{Array.from("さかな").map((char, index) => <span key={index} lang="ja" className="race-tile" data-mark={index === 0 ? "correct" : "absent"}>{char}</span>)}</div><div className="mt-6 border-t-[3px] border-neo-ink bg-white p-4"><p className="text-sm font-extrabold">Satu petunjuk, selangkah lebih dekat.</p><p className="mt-1 text-xs leading-5 opacity-70">Hijau tepat posisi. Kuning ada di posisi lain. Abu-abu tidak ada.</p></div></div>
      </div>
      <RaceEntry authenticated={Boolean(session)} displayName={session?.user.displayName} />
    </div>
    <ol className="mt-10 grid gap-5 border-t-[3px] border-current pt-6 sm:grid-cols-3">{[{ title: "Pilih cara main", text: "Masuk untuk latihan solo atau membuat room. Teman bisa bergabung sebagai guest lewat link atau kode." }, { title: "Baca warnanya", text: "Hijau: tepat posisi. Kuning: kana ada di posisi lain. Abu-abu: tidak ada atau jumlahnya sudah terpakai." }, { title: "Temukan katanya", text: "Papanmu pribadi. Jawaban dan arti dibuka saat selesai atau waktu habis. Dalam room, tunggu semua pemain selesai." }].map((step, i) => <li key={step.title} className="flex gap-3"><span className="font-mono text-3xl font-black text-emerald-700 dark:text-emerald-400">0{i + 1}</span><div><h2 className="font-black">{step.title}</h2><p className="mt-1 text-sm leading-6 opacity-75">{step.text}</p></div></li>)}</ol>
    <p className="mt-7 text-sm leading-7 opacity-75">Gunakan keyboard hiragana di layar atau ketik romaji. Kana kecil (ゃ, ゅ, ょ, っ), kana bersuara, dan tanda panjang ー masing-masing dihitung satu kotak.</p>
  </PageContainer>;
}
