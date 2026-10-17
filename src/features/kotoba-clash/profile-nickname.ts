export function clashProfileNickname(displayName?: string | null) {
  const normalized = (displayName ?? "").normalize("NFKC").replace(/[^\p{L}\p{N} _.-]/gu, " ").trim().replace(/\s+/gu, " ");
  let nickname = "";
  for (const character of normalized) {
    if (nickname.length + character.length > 24) break;
    nickname += character;
  }
  nickname = nickname.trim();
  return nickname.length >= 2 ? nickname : "";
}
