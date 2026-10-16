import type { FeatureFlags } from "@/constants";

const MINI_GAMES = [{
  slug: "kotoba-clash", name: "Kotoba Clash", feature: "kotobaClash" as const,
  description: "Adu cepat dan tepat menjawab soal JLPT bersama teman. Buat room, bagikan undangan, lalu rebut peringkat pertama.",
  href: "/mini-games/kotoba-clash", players: "2-20 pemain", levels: "N5-N1",
}];

export function availableMiniGames(features: FeatureFlags) {
  return features.miniGames ? MINI_GAMES.filter((game) => features[game.feature]) : [];
}
