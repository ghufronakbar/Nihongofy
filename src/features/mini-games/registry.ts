import type { FeatureFlags } from "@/constants";

const MINI_GAMES = [{
  slug: "kotoba-clash", name: "Kotoba Clash", feature: "kotobaClash" as const,
  description: "Adu cepat dan tepat menjawab soal JLPT bersama teman. Buat room, bagikan undangan, lalu rebut peringkat pertama.",
  href: "/mini-games/kotoba-clash", players: "2-20 pemain", levels: "N5-N1",
}, {
  slug: "kana-word-race", name: "Kana Word Race", feature: "kanaWordRace" as const,
  description: "Balapan menebak kata Jepang dengan papan pribadi. Baca petunjuk posisi, ketik kana, dan temukan jawabannya dalam enam kesempatan.",
  href: "/mini-games/kana-word-race", players: "2-20 pemain", levels: "3-7 kana",
}];

export function availableMiniGames(features: FeatureFlags) {
  return features.miniGames ? MINI_GAMES.filter((game) => features[game.feature]) : [];
}
