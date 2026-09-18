import type { ConversationTopic } from "../types";

// Fixture terkurasi. `key` adalah stable identity yang disimpan pada session;
// jangan mengubahnya setelah dipakai (§4.2).
export const CONVERSATION_TOPICS: readonly ConversationTopic[] = [
  { key: "self-introduction", label: "Perkenalan diri", labelJapanese: "自己紹介", icon: "👋" },
  { key: "daily-life", label: "Kehidupan sehari-hari", labelJapanese: "日常生活", icon: "🏠" },
  { key: "food", label: "Makanan dan restoran", labelJapanese: "食べ物", icon: "🍜" },
  { key: "shopping", label: "Belanja", labelJapanese: "買い物", icon: "🛍️" },
  { key: "travel", label: "Perjalanan", labelJapanese: "旅行", icon: "🚃" },
  { key: "work-school", label: "Pekerjaan dan sekolah", labelJapanese: "仕事・学校", icon: "💼" },
] as const;

export const CONVERSATION_TOPIC_KEYS = [
  "self-introduction",
  "daily-life",
  "food",
  "shopping",
  "travel",
  "work-school",
] as const;

export type ConversationTopicKey = (typeof CONVERSATION_TOPIC_KEYS)[number];

export function findTopic(key: string): ConversationTopic | null {
  return CONVERSATION_TOPICS.find((topic) => topic.key === key) ?? null;
}
