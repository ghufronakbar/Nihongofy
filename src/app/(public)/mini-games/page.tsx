import Link from "next/link";
import { ArrowRight, Keyboard, Swords } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { FEATURES } from "@/constants";
import { availableMiniGames } from "@/features/mini-games/registry";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Mini Games", description: "Belajar bahasa Jepang sambil bermain bersama teman di Nihongofy.", path: "/mini-games" });

export default function MiniGamesPage() {
  const games = availableMiniGames(FEATURES);
  return (
    <section className="neo-grid-paper min-h-[70dvh] py-12 md:py-18">
      <PageContainer>
        <h1 className="page-reveal text-5xl font-black tracking-tight md:text-7xl">MINI GAMES.</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-foreground/75">Selingi belajarmu dengan tantangan. Ajak teman, pilih permainan, dan belajar bareng.</p>
        <div className="mt-12 grid gap-8">
          {games.map((game) => (
            <Link key={game.slug} href={game.href} className="neo-surface neo-interactive grid gap-6 bg-neo-yellow p-7 sm:grid-cols-[auto_1fr_auto] sm:items-center md:p-10">
              {game.slug === "kana-word-race" ? <Keyboard className="size-14" aria-hidden="true" /> : <Swords className="size-14" aria-hidden="true" />}
              <div><p className="text-sm font-bold">{game.players} / {game.levels}</p><h2 className="mt-2 text-3xl font-black md:text-4xl">{game.name}</h2><p className="mt-3 max-w-2xl leading-7">{game.description}</p></div>
              <ArrowRight className="size-8" aria-hidden="true" />
            </Link>
          ))}
          {games.length === 0 && <p className="neo-surface bg-white p-8">Belum ada permainan yang tersedia. Kembali lagi nanti.</p>}
        </div>
      </PageContainer>
    </section>
  );
}
