export type SpeechResult =
  | { ok: true }
  | { ok: false; message: string };

export function canSpeakJapanese() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export function speakJapanese(text: string): SpeechResult {
  if (!canSpeakJapanese()) {
    return {
      ok: false,
      message: "Suara tidak tersedia di browser ini. Kartu tetap dapat dipelajari tanpa audio.",
    };
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Audio gagal diputar. Lanjutkan belajar dengan teks yang tersedia.",
    };
  }
}
