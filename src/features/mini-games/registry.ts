import type { FeatureFlags } from "@/constants";

const MINI_GAMES = [{
  slug: "kotoba-clash", name: "Kotoba Clash", feature: "kotobaClash" as const,
  description: "Latihan kuis JLPT sendiri atau adu cepat bersama teman. Kejar poin, sambung streak, dan pelajari pembahasan soal.",
  href: "/mini-games/kotoba-clash", players: "Solo / 2-20 pemain", levels: "N5-N1",
}, {
  slug: "kana-word-race", name: "Kana Word Race", feature: "kanaWordRace" as const,
  description: "Tebak kata Jepang sendiri atau balapan bersama teman. Baca petunjuk posisi, ketik kana, dan temukan jawabannya dalam enam kesempatan.",
  href: "/mini-games/kana-word-race", players: "Solo / 2-20 pemain", levels: "3-7 kana",
}, {
  slug: "onigiri-kitchen", name: "Onigiri Kitchen", feature: "onigiriKitchen" as const,
  description: "Bangun kedai Jepang kecil tanpa batas waktu. Masak, selesaikan quest, rekrut pelayan, dan perluas teras. Selingan santai dengan sedikit kosakata Jepang.",
  href: "/mini-games/onigiri-kitchen", players: "Solo · Tanpa login", levels: "Quest & upgrade",
}];

export function availableMiniGames(features: FeatureFlags) {
  return features.miniGames ? MINI_GAMES.filter((game) => features[game.feature]) : [];
}
