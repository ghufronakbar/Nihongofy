import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { RaceEntry } from "@/features/kana-word-race/components/entry";
import { getSessionUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Kana Word Race", description: "Adu cepat menebak kata Jepang dalam 6 kesempatan. Mainkan 3-7 kana bersama 2-20 teman melalui room privat.", path: "/mini-games/kana-word-race" });

export default async function KanaRacePage() {
  const session = await getSessionUser();
  return <PageContainer className="py-8 md:py-12">
    <Link href="/mini-games" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4"><ArrowLeft className="size-4" />Semua Mini Games</Link>
    <div className="mt-8 grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr]">
      <div><p className="race-eyebrow mb-4">Satu kata. Banyak kemungkinan.</p><h1 className="text-6xl leading-[.9] font-black tracking-[-.05em] sm:text-8xl">KANA<br />WORD<br /><span className="text-emerald-700 dark:text-emerald-400">RACE.</span></h1><p className="mt-6 max-w-md text-lg leading-8">Baca petunjuk warnanya, cari kata yang sama, lalu kejar waktu temanmu. Enam kesempatan. Seberapa cepat kamu menemukannya?</p>
        <dl className="my-8 grid grid-cols-3 border-y-2 border-current py-4"><div><dt className="race-eyebrow">Pemain</dt><dd className="mt-1 text-2xl font-black">2-20</dd></div><div><dt className="race-eyebrow">Karakter</dt><dd className="mt-1 text-2xl font-black">3-7</dd></div><div><dt className="race-eyebrow">Tebakan</dt><dd className="mt-1 text-2xl font-black">6</dd></div></dl>
        <div className="race-panel race-demo mx-3 max-w-sm"><p className="race-eyebrow mb-4">Contoh papan · target さくら</p><div className="grid grid-cols-3 gap-2" aria-label="さかな: さ tepat posisi, か tidak ada, な tidak ada">{Array.from("さかな").map((char, index) => <span key={index} lang="ja" className="race-tile" data-mark={index === 0 ? "correct" : "absent"}>{char}</span>)}</div><p className="mt-4 text-sm font-bold">Satu petunjuk, selangkah lebih dekat.</p></div>
      </div>
      <RaceEntry authenticated={Boolean(session)} displayName={session?.user.displayName} />
    </div>
    <ol className="mt-14 grid gap-6 border-t-2 border-current pt-7 sm:grid-cols-3">{[{ title: "Buka room", text: "Host masuk dengan akun. Teman bisa bergabung sebagai guest lewat link atau kode." }, { title: "Baca warnanya", text: "Hijau: tepat posisi. Kuning: kana ada di posisi lain. Abu-abu: tidak ada atau jumlahnya sudah terpakai." }, { title: "Temukan bersama", text: "Papanmu pribadi. Jawaban dibuka setelah semua selesai atau waktu habis, lengkap dengan arti katanya." }].map((step, i) => <li key={step.title}><p className="race-eyebrow mb-2">0{i + 1}</p><h2 className="font-black">{step.title}</h2><p className="mt-2 text-sm leading-7 opacity-75">{step.text}</p></li>)}</ol>
    <p className="mt-7 text-sm leading-7 opacity-75">Gunakan keyboard hiragana di layar atau ketik romaji. Kana kecil (ゃ, ゅ, ょ, っ), kana bersuara, dan tanda panjang ー masing-masing dihitung satu kotak.</p>
  </PageContainer>;
}
